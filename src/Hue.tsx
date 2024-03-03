import React, { useState, useEffect, useMemo } from 'react'
import {
  Canvas,
  Circle,
  Paint,
  type SkPoint,
  vec,
  Vertices,
  Vector,
  Path,
} from '@shopify/react-native-skia'
import { Button, View, useWindowDimensions } from 'react-native'
import {
  Easing,
  ReduceMotion,
  interpolate,
  runOnJS,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import cdt2d from 'cdt2d'
import {
  mixedColorPalette,
  mixedColorPalette2,
  palette,
  shufflePalette,
  yellowColorPalette,
} from './colorPalette'
import { NoiseFunction2D, createNoise2D } from './SimplexNoise'

const animationConfig = {
  duration: 2000,
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  reduceMotion: ReduceMotion.System,
}

const ACircle = ({
  initialVertex,
  targetVertex,
  color,
}: {
  initialVertex: SkPoint
  targetVertex: SkPoint
  color: string
}) => {
  const cx = useSharedValue(initialVertex.x)
  const cy = useSharedValue(initialVertex.y)

  // Respond to changes in targetVertex to trigger animation
  useEffect(() => {
    cx.value = withTiming(targetVertex.x, animationConfig)
    cy.value = withTiming(targetVertex.y, animationConfig)
  }, [targetVertex])

  return (
    <Circle cx={cx} cy={cy} r={20} color={color}>
      <Paint color="black" style="stroke" strokeWidth={1} />
    </Circle>
  )
}

const ATriangle = ({
  initialVertices,
  targetVertices,
  colors,
  onAnimationComplete,
  debug = false,
}: {
  initialVertices: SkPoint[]
  targetVertices: SkPoint[]
  colors: string[]
  onAnimationComplete: () => void
  debug?: boolean
}) => {
  const vertices_x = initialVertices.map(({ x }) => useSharedValue(x))
  const vertices_y = initialVertices.map(({ y }) => useSharedValue(y))

  let animationCount = useSharedValue(0)
  useEffect(() => {
    const onSingleAnimationComplete = () => {
      'worklet'
      animationCount.value += 1
      if (animationCount.value === targetVertices.length) {
        runOnJS(onAnimationComplete)() // Call the passed callback once all animations are complete
        animationCount.value = 0
      }
    }

    targetVertices.forEach((targetVertex, i) => {
      vertices_x[i].value = withTiming(
        targetVertex.x,
        animationConfig,
        onSingleAnimationComplete,
      )
      vertices_y[i].value = withTiming(targetVertex.y, animationConfig)
    })
  }, [targetVertices])

  const triangleVertices = targetVertices ?? initialVertices
  const triangles = useMemo(
    () => cdt2d(triangleVertices.map(({ x, y }) => [x, y])),
    [],
  )
  const indices = triangles.flat()

  const path = useDerivedValue(() => {
    const f = ({ x, y }: Vector) => [x, y].join(',')
    // combine vertices_x and vertices_y into a single array of vertices so that they can be indeced by the triangles array below
    const vertices = vertices_x.map((x, i) => ({
      x: x.value,
      y: vertices_y[i].value,
    }))

    return debug
      ? triangles
          .map(([a, b, c]: [number, number, number]) => {
            const v1 = vertices[a]
            const v2 = vertices[b]
            const v3 = vertices[c]
            return `M${f(v1)} L${f(v2)} L${f(v3)} Z`
          })
          .join('')
      : ''
  }, [vertices_x, vertices_y])

  // combine vertices_x and vertices_y into a single array of vertices and stored in derivedVertices
  const derivedVertices = useDerivedValue(() =>
    vertices_x.map((x, i) => ({ x: x.value, y: vertices_y[i].value })),
  )

  return (
    <>
      <Vertices
        vertices={derivedVertices}
        indices={indices}
        style="stroke"
        color="black"
        strokeWidth={2}
        colors={colors}
      />
      <Path path={path} strokeWidth={2} color="black" style="stroke" />
    </>
  )
}

// A function that finds a grid of ponts with R rows and C columns per width and let P mark the number of pages
// The grid is used to create a grid of circles
// The function returns an array of SkPoint, hsize and vSize
const createGrid = ({
  rows,
  cols,
  pages,
  width,
  height,
}: {
  rows: number
  cols: number
  pages: number
  width: number
  height: number
}) => {
  const hSize = width / cols
  const vSize = height / rows
  const totalWidth = pages * (hSize * cols)
  const totalColumns = Math.ceil(totalWidth / hSize) + 1
  const totalRows = rows + 1
  const grid = Array.from({ length: totalColumns }, (_, col) =>
    Array.from({ length: totalRows }, (_, row) =>
      vec(col * hSize, row * vSize),
    ),
  ).flat()

  return { grid, hSize, vSize, pageSize: hSize * cols, totalWidth }
}

export const Hue: React.FC = () => {
  const { width, height } = useWindowDimensions()
  const [debug, setDebug] = useState(true)

  const cols = 3,
    rows = 3,
    pages = 10
  const {
    grid: initialVertices,
    hSize,
    vSize,
    pageSize,
    totalWidth,
  } = useMemo(
    () => createGrid({ cols, rows, pages, width, height }),
    [width, height],
  )
  const [vertices, setVertices] = useState<SkPoint[]>(initialVertices)

  const callback = () => {
    console.log('Animation completed!')
  }

  const noises = useMemo(() => vertices.map(() => createNoise2D()), [vertices])

  const xAmplitude = hSize * 0.3
  const yAmplitude = vSize * 0.3
  const frequency = 0.1
  const panLeft = () => {
    const targetVertices = vertices.map((vertex, i) => {
      const targetVector = vec(vertex.x - pageSize, vertex.y)

      const isEdge =
        vertex.x === 0 ||
        vertex.x === width ||
        vertex.y === 0 ||
        vertex.y === height
      const isOneOfLastFourVertices = i >= vertices.length - (cols + 1)

      if (isEdge || isOneOfLastFourVertices) return targetVector

      const noise = noises[i]
      return vec(
        targetVector.x + xAmplitude * noise(targetVector.x * frequency, 0),
        targetVector.y + yAmplitude * noise(0, targetVector.y * frequency),
      )
    })
    setVertices(targetVertices)
  }

  const panRight = () => {
    const targetVertex = vertices.map(vertex =>
      vec(vertex.x + pageSize, vertex.y),
    )
    setVertices(targetVertex)
  }

  const colors = vertices.map(
    (_, i) => shufflePalette(mixedColorPalette)[i % mixedColorPalette.length],
  )

  return (
    <View style={{ flex: 1 }}>
      <Canvas style={{ flex: 1, backgroundColor: 'black' }}>
        <ATriangle
          initialVertices={initialVertices}
          targetVertices={vertices}
          colors={colors}
          onAnimationComplete={callback}
          debug={debug}
        />
        {debug &&
          vertices.map((vertex, i) => (
            <ACircle
              key={i}
              initialVertex={vertex}
              targetVertex={vertex}
              color={colors[i]}
            />
          ))}
      </Canvas>
      <View
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          position: 'absolute',
          top: '93%',
          bottom: 0,
          left: 0,
          right: 0,
          alignItems: 'center',
          justifyContent: 'flex-start',
          height: '7%',
          flexDirection: 'row',
        }}>
        <Button title="⬅️" onPress={panLeft} />
        <Button title="➡️" onPress={panRight} />
        <Button title="🔄" onPress={() => setVertices(initialVertices)} />
        <Button title={debug ? '🟢' : '🐛'} onPress={() => setDebug(!debug)} />
      </View>
    </View>
  )
}
