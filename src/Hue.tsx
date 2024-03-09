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
  SharedValue,
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
import { createNoise2D } from './SimplexNoise'
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  PanGesture,
} from 'react-native-gesture-handler'

const animationConfig = {
  duration: 1300,
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  reduceMotion: ReduceMotion.System,
}

const ACircle = ({
  initialVertex,
  targetVertex,
  color,
  offset,
}: {
  initialVertex: SkPoint
  targetVertex: SkPoint
  color: string
  offset: SharedValue<number>
}) => {
  const cx = useSharedValue(initialVertex.x)
  const cy = useSharedValue(initialVertex.y)

  // // Respond to changes in targetVertex to trigger animation
  // useEffect(() => {
  //   // cx.value = withTiming(targetVertex.x, animationConfig)
  //   // cy.value = withTiming(targetVertex.y, animationConfig)
  //   progress.value = withTiming(1, animationConfig)
  // }, [targetVertex])

  // const xWithOffset = useDerivedValue(() => cx.value + offset.value)
  const xD = useDerivedValue(
    () => cx.value - (targetVertex.x - cx.value) * offset.value,
  )

  // move the circle manually using derived value
  // when user removes their finger from the screen, we want
  // to use withTiming to animate to the targetVertex.x position
  // when that poisition is reached then we want to use the net target vertex
  // the target vertex will either be left or right of the point
  // and each target vertex has a precomputed noise to it

  return (
    <Circle cx={xD} cy={cy} r={20} color={color}>
      <Paint color="black" style="stroke" strokeWidth={1} />
    </Circle>
  )
}

const ATriangle = ({
  initialVertices,
  targetVertices,
  colors,
  onAnimationComplete,
  offset,
  debug = false,
}: {
  initialVertices: SkPoint[]
  targetVertices: SkPoint[]
  colors: string[]
  onAnimationComplete: () => void
  offset: SharedValue<number>
  debug?: boolean
}) => {
  const vertices_x = initialVertices.map(({ x }) => useSharedValue(x))
  const vertices_y = initialVertices.map(({ y }) => useSharedValue(y))

  let animationCount = useSharedValue(0)
  useEffect(() => {
    const onSingleAnimationComplete = () => {
      'worklet'
      animationCount.value += 1
      // console.log(animationCount.value)
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
      x: x.value + offset.value,
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
    vertices_x.map((x, i) => ({
      x: x.value + offset.value,
      y: vertices_y[i].value,
    })),
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

const panGridLeft = ({
  vertices,
  hSize,
}: {
  vertices: SkPoint[]
  hSize: number
}) => vertices.map((vertex, i) => vec(vertex.x - hSize, vertex.y))

export const Hue: React.FC = () => {
  const { width, height } = useWindowDimensions()
  const [debug, setDebug] = useState(true)

  const cols = 1,
    rows = 1,
    pages = 1
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

  const leftGrid = panGridLeft({ vertices: initialVertices, hSize })

  const [vertices, setVertices] = useState<SkPoint[]>(initialVertices)

  const callback = () => {
    console.log('Animation completed!')
  }

  const noises = useMemo(() => vertices.map(() => createNoise2D()), [vertices])

  const xAmplitude = hSize * 0.3
  const yAmplitude = vSize * 0.3
  const frequency = 0.1
  const panLeft = () => {
    console.log('panLeft')
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
    console.log('panRight')
    const targetVertex = vertices.map(vertex =>
      vec(vertex.x + pageSize, vertex.y),
    )
    setVertices(targetVertex)
  }

  const colors = vertices.map(
    (_, i) => shufflePalette(palette)[i % palette.length],
  )

  const offset = useSharedValue(0)

  const pan = Gesture.Pan()
    .onStart(() => {
      // Store the current offset value when the gesture starts
      offset.value = 0
    })
    .onUpdate(event => {
      // Adjust the sensiivity of the movement
      // const sensitivity = 20 // Increase this value to make the movement slower
      // const scaledTranslationX = event.translationX / sensitivity

      // offset.value += scaledTranslationX // Accumulate the scaled translation to the offset
      offset.value = event.translationX / hSize
    })
    .onEnd(() => {
      // Optionally, you can handle logic here when the gesture ends
      offset.value = 0
    })

  return (
    <View style={{ flex: 1 }}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <GestureDetector gesture={pan}>
          <Canvas style={{ flex: 1, backgroundColor: 'white' }}>
            {/* <ATriangle
              initialVertices={initialVertices}
              targetVertices={vertices}
              colors={colors}
              onAnimationComplete={callback}
              offset={offset}
              debug={debug}
            /> */}
            {debug &&
              vertices.map((vertex, i) => (
                <ACircle
                  key={i}
                  initialVertex={vertex}
                  targetVertex={leftGrid[i]}
                  color={colors[i]}
                  offset={offset}
                />
              ))}
          </Canvas>
        </GestureDetector>
      </GestureHandlerRootView>
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
        <Button
          title="🔄"
          onPress={() => {
            offset.value = 0
            setVertices(initialVertices)
          }}
        />
        <Button title={debug ? '🟢' : '🐛'} onPress={() => setDebug(!debug)} />
      </View>
    </View>
  )
}
