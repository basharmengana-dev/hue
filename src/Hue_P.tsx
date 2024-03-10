import React, { useState, useMemo, useEffect } from 'react'
import { Canvas, Circle, Paint, VertexMode } from '@shopify/react-native-skia'
import { View, useWindowDimensions } from 'react-native'
import {
  SharedValue,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated'
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler'

type Vertex = { x: number; y: number }
type ColoredVertex = Vertex & { color: string }

const ACircle = ({
  current,
  target,
  offset,
}: {
  current: ColoredVertex
  target: { x: SharedValue<number>; y: SharedValue<number> } & {
    color: SharedValue<string>
  }
  offset: SharedValue<number>
}) => {
  return (
    <Circle cx={target.x} cy={target.y} r={20} color={target.color}>
      <Paint color="black" style="stroke" strokeWidth={1} />
    </Circle>
  )
}

const createGrid = ({
  rows,
  cols,
  pages,
  width,
  height,
}: {
  rows: number
  cols: number
  pages: number // New parameter to specify how much wider the grid should be
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

const getNextTargetGrid = ({
  gridStreams,
  current,
}: {
  gridStreams: ColoredVertex[][]
  current: number[]
}) => getTargetGridAtStep({ gridStreams, current, step: -1 })

const printGridData = ({
  gridStreams,
  currentGrid,
  targetGrid,
}: {
  gridStreams: ColoredVertex[][]
  currentGrid: ColoredVertex[]
  targetGrid: ColoredVertex[]
}) => {
  // console.log('\n***** gridStreams *****\n')
  // gridStreams.forEach(stream => {
  //   console.log(
  //     `\n*** Stream start for x: ${stream.at(-1)?.x}, y: ${
  //       stream.at(-1)?.y
  //     } *** \n`,
  //   )
  //   stream
  //     .reverse()
  //     .forEach(vertex =>
  //       console.log({ x: vertex.x, y: vertex.y, c: vertex.color }),
  //     )
  //   console.log('\n*** Stream end *** \n')
  // })
  console.log('***************\n\n')
  console.log('\n***** currentGrid *****\n')
  currentGrid.forEach(vertex =>
    console.log({ _x: vertex.x, _y: vertex.y, c: vertex.color }),
  )
  console.log('\n\n')
  console.log('\n***** nextGrid *****\n')
  targetGrid.forEach(vertex =>
    console.log({ _x: vertex.x, _y: vertex.y, c: vertex.color }),
  )
  console.log('***************\n\n')
}

export const Hue: React.FC = () => {
  const { width, height } = useWindowDimensions()

  const cols = 1,
    rows = 1,
    pages = 2,
    colorStream = ['red', 'green', 'blue', 'orange'].reverse() // last element is current, red

  const initialGridStreams = createStreamedGrid({
    rows,
    cols,
    pages,
    width,
    height,
    colorStream,
  })

  const [gridStreams, seGridStreams] = useState(initialGridStreams)

  const [currentStreamStep, setCurrentGridStream] = useState(
    Array<number>(initialGridStreams.length).fill(0),
  )

  const currentGrid = useMemo(
    () => getCurrentGrid({ gridStreams, current: currentStreamStep }),
    [gridStreams, currentStreamStep],
  )
  const targetGrid = useMemo(
    () => getNextTargetGrid({ gridStreams, current: currentStreamStep }),
    [gridStreams, currentStreamStep],
  )

  printGridData({
    gridStreams,
    currentGrid: currentGrid,
    targetGrid: targetGrid,
  })

  const offset = useSharedValue(0)
  const disablePan = useSharedValue(false)

  const target = currentGrid.map((currentVertex, vertexIndex) => {
    const nextVertex = targetGrid[vertexIndex]

    const target = {
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

    return target
  })

  useAnimatedReaction(
    () => offset.value,
    () => {
      if (-offset.value > 0.5 && disablePan.value === false) {
        disablePan.value = true
        runOnJS(setCurrentGridStream)(currentStreamStep.map(c => c - 1))
      }
    },
  )

  const pan = Gesture.Pan()
    .onStart(() => {
      disablePan.value = false
      offset.value = 0
    })
    .onUpdate(event => {
      if (disablePan.value) return
      offset.value = (event.translationX / width) * 1
    })
    .onEnd(() => {
      offset.value = 0
    })

  return (
    <View style={{ flex: 1 }}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <GestureDetector gesture={pan}>
          <Canvas style={{ flex: 1, backgroundColor: 'white' }}>
            {currentGrid.map((vertex, i) => (
              <ACircle
                key={i}
                current={vertex}
                target={target[i]}
                offset={offset}
              />
            ))}
          </Canvas>
        </GestureDetector>
      </GestureHandlerRootView>
    </View>
  )
}
