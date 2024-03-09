import React, { useState, useMemo, useEffect } from 'react'
import { Canvas, Circle, Paint, VertexMode } from '@shopify/react-native-skia'
import { View, useWindowDimensions } from 'react-native'
import {
  SharedValue,
  interpolateColor,
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
  const initialCurrent = Array<number>(initialGridStreams.length).fill(0)

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
  initialGridStreams.forEach(stream => {
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
  console.log('\n\n')
  console.log('\n***** currentGrid *****\n')
  currentGrid.forEach(vertex =>
    console.log({ _x: vertex.x, _y: vertex.y, c: vertex.color }),
  )
  console.log('\n\n')
  console.log('\n***** nextGrid *****\n')
  nextGrid.forEach(vertex =>
    console.log({ _x: vertex.x, _y: vertex.y, c: vertex.color }),
  )
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

  useEffect(() => {
    // if target is equal to current, then its time to update the target to the next
    // target accoridng to the stream
    // allow for some margin of error in the comparision
    // if (
    //     Math.abs(target.x.value - currentVertex.x) < 0.1 &&
    //     Math.abs(target.y.value - currentVertex.y) < 0.1
    //   ) {
    //     // update current so the current currentGrid is the nextGrid
    //     setCurrent(current.map((c, i) => c - 1))
    //   }
  }, [offset])

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
