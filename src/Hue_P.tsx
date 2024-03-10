import React, { useState, useMemo } from 'react'
import {
  Canvas,
  Circle,
  Paint,
  Path,
  Vertices,
} from '@shopify/react-native-skia'
import { View, useWindowDimensions } from 'react-native'
import {
  SharedValue,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler'
import cdt2d from 'cdt2d'

const colorStream = [
  'red',
  'green',
  'blue',
  'orange',
  'yellow',
  // 'red',
  // 'green',
  // 'blue',
  // 'orange',
  // 'yellow',
  // 'red',
  // 'green',
  // 'blue',
  // 'orange',
  // 'yellow',
].reverse()

const animationConfigForward = { duration: 400 }
const animationConfigBack = { duration: 200 }

const HueBackground = ({
  colors,
  target,
  derivedVertices,
}: {
  colors: Readonly<SharedValue<string[]>>
  target: {
    x: Readonly<SharedValue<number>>
    y: Readonly<SharedValue<number>>
    color: Readonly<SharedValue<string>>
  }[]
  derivedVertices: Readonly<
    SharedValue<
      {
        x: number
        y: number
      }[]
    >
  >
}) => {
  const triangles = useMemo(
    () => cdt2d(target.map(({ x, y }) => [x.value, y.value])),
    [],
  )
  const indices = triangles.flat()

  const path = useDerivedValue(() => {
    const f = ({ x, y }: Vertex) => [x, y].join(',')

    return triangles
      .map(([a, b, c]: [number, number, number]) => {
        const v1 = derivedVertices.value[a]
        const v2 = derivedVertices.value[b]
        const v3 = derivedVertices.value[c]
        return `M${f(v1)} L${f(v2)} L${f(v3)} Z`
      })
      .join('')
  })

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

type Vertex = { x: number; y: number }
type ColoredVertex = Vertex & { color: string }

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
  const totalWidth = width * pages
  const totalColumns = cols + Math.ceil(totalWidth / hSize)
  const totalRows = rows + 1

  const grid = Array.from({ length: totalColumns }, (_, col) =>
    Array.from(
      { length: totalRows },
      (_, row) =>
        ({
          x: col * hSize,
          y: row * vSize,
        } as Vertex),
    ),
  ).flat()

  return { grid, hSize, vSize, totalColumns }
}

const createStreamedGrid = ({
  rows,
  cols,
  pages,
  width,
  height,
  colorStream,
}: {
  rows: number
  cols: number
  pages: number
  width: number
  height: number
  colorStream: string[]
}) => {
  const {
    grid: baseGrid,
    hSize,
    totalColumns,
  } = createGrid({
    rows,
    cols,
    pages,
    width,
    height,
  })

  return baseGrid.map(({ x, y }) =>
    Array.from(
      { length: totalColumns + 1 },
      (_, i) =>
        ({
          x: x + hSize * (i - totalColumns),
          y: y,
          color: colorStream[i],
        } as ColoredVertex),
    ),
  )
}

const getCurrentGrid = ({
  gridStreams,
  current,
}: {
  gridStreams: ColoredVertex[][]
  current: number[]
}) =>
  gridStreams.map((stream, index) => stream[stream.length - 1 + current[index]])

const getTargetGridAtStep = ({
  gridStreams,
  current,
  step,
}: {
  gridStreams: ColoredVertex[][]
  current: number[]
  step: number
}) => {
  const updatedCurrent = current.map(c => c + step)

  const nextGrid = gridStreams.map((stream, index) => {
    const newPositionIndex = Math.max(
      0,
      Math.min(stream.length - 1, stream.length - 1 + updatedCurrent[index]),
    )
    return stream[newPositionIndex]
  })

  return nextGrid
}

const printGridData = ({
  gridStreams,
  currentGrid,
  targetGrid,
}: {
  gridStreams?: ColoredVertex[][]
  currentGrid?: ColoredVertex[]
  targetGrid?: ColoredVertex[]
}) => {
  if (gridStreams) {
    console.log('\n***** gridStreams *****\n')
    gridStreams.forEach(stream => {
      console.log(
        `\n*** Stream start for x: ${stream.at(-1)?.x}, y: ${
          stream.at(-1)?.y
        } *** \n`,
      )
      stream
        .reverse()
        .forEach(vertex =>
          console.log({ x: vertex.x, y: vertex.y, c: vertex.color }),
        )
      console.log('\n*** Stream end *** \n')
    })
    console.log('***************\n\n')
  }
  if (currentGrid) {
    console.log('\n***** currentGrid *****\n')
    currentGrid.forEach((vertex, i) =>
      console.log({ i, _x: vertex.x, _y: vertex.y, c: vertex.color }),
    )
  }
  if (targetGrid) {
    console.log('\n\n')
    console.log('\n***** nextGrid *****\n')
    targetGrid.forEach((vertex, i) =>
      console.log({ i, _x: vertex.x, _y: vertex.y, c: vertex.color }),
    )
    console.log('***************\n\n')
  }
}

export const Hue: React.FC = () => {
  const { width, height } = useWindowDimensions()

  const cols = 1,
    rows = 1,
    pages = 2

  const initialGridStreams = createStreamedGrid({
    rows,
    cols,
    pages,
    width,
    height,
    colorStream,
  })
  // Array<number>(initialGridStreams.length).fill(0),
  const initialStep = Array<number>(initialGridStreams.length).fill(0)

  //.slice(2, 3)
  const [gridStreams, _] = useState(initialGridStreams)
  const [step, setStep] = useState(initialStep)

  const currentGrid = useMemo(() => {
    return getCurrentGrid({ gridStreams, current: step })
  }, [gridStreams, step])
  const targetGrid = useMemo(
    () =>
      getTargetGridAtStep({
        gridStreams,
        current: step,
        step: -1,
      }),
    [gridStreams, step],
  )

  printGridData({
    currentGrid,
    // gridStreams,
    targetGrid,
  })

  const offset = useSharedValue(0)
  const isPanningRunning = useSharedValue(true)
  const isMouseDownForPanning = useSharedValue(false)

  const target = currentGrid.map((currentVertex, vertexIndex) => {
    const nextVertex = targetGrid[vertexIndex]

    return {
      x: useDerivedValue(
        () => currentVertex.x - (nextVertex.x - currentVertex.x) * offset.value,
      ),
      y: useDerivedValue(() => currentVertex.y),
      color: useDerivedValue(() =>
        interpolateColor(
          offset.value,
          [0, -1],
          [currentVertex.color, nextVertex.color],
        ),
      ),
    }
  })

  useAnimatedReaction(
    () => offset.value,
    () => {
      if (isPanningRunning.value === true) {
        if (-offset.value > 0.5) {
          isPanningRunning.value = false
          runOnJS(setStep)(step.map(c => c - 1))
        }
      }
    },
  )

  const pan = Gesture.Pan()
    .onStart(() => {
      isPanningRunning.value = true
      isMouseDownForPanning.value = true
      offset.value = 0
    })
    .onUpdate(event => {
      if (isPanningRunning.value == false) {
        return
      } else {
        offset.value = (event.translationX / width) * 1
      }
    })
    .onEnd(() => {
      isMouseDownForPanning.value = false
      offset.value = 0
    })

  const xInternal = currentGrid.map(c => useSharedValue(c.x))
  const yInternal = currentGrid.map(c => useSharedValue(c.y))

  useAnimatedReaction(
    () => target[0].x.value,
    () => {
      if (isPanningRunning.value === true) {
        if (isMouseDownForPanning.value === true) {
          xInternal.map((x, i) => (x.value = target[i].x.value))
        } else {
          xInternal.map(
            (x, i) =>
              (x.value = withTiming(currentGrid[i].x, animationConfigBack)),
          )
        }
      } else {
        xInternal.map(
          (x, i) =>
            (x.value = withTiming(target[i].x.value, animationConfigForward)),
        )
      }
    },
  )

  useAnimatedReaction(
    () => target[0].y.value,
    () => {
      if (isPanningRunning.value === true) {
        if (isMouseDownForPanning.value === true) {
          yInternal.map((y, i) => (y.value = target[i].y.value))
        } else {
          yInternal.map(
            (y, i) =>
              (y.value = withTiming(currentGrid[i].y, animationConfigBack)),
          )
        }
      } else {
        yInternal.map(
          (y, i) =>
            (y.value = withTiming(target[i].y.value, animationConfigForward)),
        )
      }
    },
  )

  const derivedVertices = useDerivedValue(() =>
    xInternal.map((x, i) => ({
      x: x.value,
      y: yInternal[i].value,
    })),
  )

  const colors = useDerivedValue(() => target.map(vertex => vertex.color.value))

  return (
    <View style={{ flex: 1 }}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <GestureDetector gesture={pan}>
          <Canvas style={{ flex: 1, backgroundColor: 'white' }}>
            <HueBackground
              colors={colors}
              target={target}
              derivedVertices={derivedVertices}
            />
            {xInternal.map((x, i) => (
              <Circle
                key={i}
                cx={x}
                cy={yInternal[i]}
                r={20}
                color={target[i].color}>
                <Paint color="black" style="stroke" strokeWidth={1} />
              </Circle>
            ))}
          </Canvas>
        </GestureDetector>
      </GestureHandlerRootView>
    </View>
  )
}
