import React, { useState, useEffect, useMemo } from 'react'
import {
  Canvas,
  Circle,
  Paint,
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
  interpolateColor,
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
import { create } from 'react-test-renderer'

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
  width,
  height,
}: {
  rows: number
  cols: number
  width: number
  height: number
}) => {
  const hSize = width / cols
  const vSize = height / rows
  const totalColumns = Math.ceil(width / hSize) + 1
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

  return { grid, hSize, vSize }
}

const createStreamedGrid = ({
  rows,
  cols,
  range,
  width,
  height,
  colorStream,
}: {
  rows: number
  cols: number
  range: number
  width: number
  height: number
  colorStream: string[]
}) => {
  const { grid: baseGrid, hSize } = createGrid({
    rows,
    cols,
    width,
    height,
  })

  return baseGrid.map(({ x, y }) =>
    Array.from(
      { length: range + 1 },
      (_, i) =>
        ({
          x: x + hSize * (i - range),
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

const getNextGrid = ({
  gridStreams,
  current,
  step,
}: {
  gridStreams: ColoredVertex[][]
  current: number[]
  step: number
}) => {
  // Apply the step to update the current positions
  const updatedCurrent = current.map(c => c + step)

  // Fetch the grid state based on the updated current positions
  const nextGrid = gridStreams.map((stream, index) => {
    // Ensure the index is within bounds
    const newPositionIndex = Math.max(
      0,
      Math.min(stream.length - 1, stream.length - 1 + updatedCurrent[index]),
    )
    return stream[newPositionIndex]
  })

  return nextGrid
}

export const Hue: React.FC = () => {
  const { width, height } = useWindowDimensions()

  const cols = 3,
    rows = 1,
    range = 1,
    colorStream = ['green', 'red'] // last element is current, red

  const initialGridStreams = createStreamedGrid({
    rows,
    cols,
    range,
    width,
    height,
    colorStream,
  })
  const initialCurrent = Array(initialGridStreams.length).fill(0)

  const [gridStreams, seGridStreams] = useState(initialGridStreams)
  const [current, setCurrent] = useState(initialCurrent)
  const currentGrid = useMemo(
    () => getCurrentGrid({ gridStreams, current }),
    [gridStreams, current],
  )
  const nextGrid = useMemo(
    () => getNextGrid({ gridStreams, current, step: -1 }),
    [gridStreams, current],
  )

  console.log('\n***** initialGridStreams *****\n')
  initialGridStreams.forEach(row => console.log(row))
  console.log('\n\n')
  console.log('\n***** currentGrid *****\n')
  currentGrid.forEach(row => console.log(row))
  console.log('\n\n')
  console.log('\n***** nextGrid *****\n')
  nextGrid.forEach(row => console.log(row))
  console.log('\n\n')

  const offset = useSharedValue(0)
  const pan = Gesture.Pan()
    .onStart(() => {
      offset.value = 0
    })
    .onUpdate(event => {
      offset.value = (event.translationX / width) * 1
    })
    .onEnd(() => {
      offset.value = 0
    })

  const target = currentGrid.map((currentVertex, vertexIndex) => {
    const nextVertex = nextGrid[vertexIndex]

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
