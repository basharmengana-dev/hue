import React, { useMemo } from 'react'
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

const animationConfig = { duration: 300 }

const HueBackground = ({
  colors,
  target,
  derivedVertices,
  debug,
}: {
  colors: SharedValue<string[]>
  target: {
    x: SharedValue<number>
    y: SharedValue<number>
    color: SharedValue<string>
  }[]
  derivedVertices: SharedValue<
    {
      x: number
      y: number
    }[]
  >
  debug?: boolean
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
      {debug ? (
        <Path path={path} strokeWidth={2} color="black" style="stroke" />
      ) : (
        <></>
      )}
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
    Array.from({ length: totalRows }, (_, row) => {
      const p = {
        x: col * hSize,
        y: row * vSize,
      } as Vertex
      return p
    }),
  ).flat()

  return { grid, hSize, vSize, totalColumns }
}

const colorStream = [
  '#FFB6C1',
  '#00FFFF',
  '#90EE90',
  '#FFDAB9',
  '#D8BFD8',
].reverse()

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

  return baseGrid.slice(4, 5).map(({ x, y }, i) => {
    // console.log('Stream for: ', 'x: ', x, 'y: ', y)
    return Array.from({ length: totalColumns - 1 }, (_, i) => {
      const p = {
        x: x + hSize * (i + 2 - totalColumns),
        y: y,
        color: colorStream[0],
      }
      // console.log(p.x, ', ', p.y)

      return p
    })
  })
}

const getCurrentGrid = ({
  gridStreams,
  current,
}: {
  gridStreams: ColoredVertex[][]
  current: number
}) => {
  'worklet'
  return gridStreams.map(stream => stream[stream.length - 1 + current])
}

const getTargetGridAtStep = ({
  gridStreams,
  current,
  step,
}: {
  gridStreams: ColoredVertex[][]
  current: number
  step: number
}) => {
  'worklet'
  const updatedCurrent = current + step

  const nextGrid = gridStreams.map(stream => {
    const newPositionIndex = Math.max(
      0,
      Math.min(stream.length - 1, stream.length - 1 + updatedCurrent),
    )
    return stream[newPositionIndex]
  })

  return nextGrid
}

export const Hue: React.FC = () => {
  const { width, height } = useWindowDimensions()

  const cols = 2,
    rows = 1,
    pages = 3

  const gridStreams = useMemo(
    () =>
      createStreamedGrid({
        rows,
        cols,
        pages,
        width,
        height,
        colorStream,
      }),
    [],
  )

  // const totalPoints = gridStreams.length * gridStreams[0].length
  // console.log('Total points: ', totalPoints)
  // console.log('points per page', (cols + 1) * (rows + 1))
  // console.log('total points', (cols + 1) * (rows + 1) * (pages + 1))
  // console.log('cols', cols, 'rows', rows, 'pages', pages)

  const currentStep = useSharedValue(0)
  const direction = useSharedValue(0)
  const offset = useSharedValue(0)
  const isPanningRunning = useSharedValue(true)
  const isMouseDownForPanning = useSharedValue(false)
  const animationCompleted = useSharedValue(0)
  const currentGridAtTargetReady = useSharedValue(false)

  const autoScrollThreshold = 0.4
  const debug = true

  const currentGrid = useDerivedValue(() =>
    getCurrentGrid({ gridStreams, current: currentStep.value }),
  )
  const targetGrid = useSharedValue(currentGrid.value)

  useAnimatedReaction(
    () => direction.value,
    (direction, _) => {
      if (direction === 0) return

      targetGrid.value = getTargetGridAtStep({
        gridStreams,
        current: currentStep.value,
        step: direction === 0 ? 1 : direction,
      })
    },
  )

  useAnimatedReaction(
    () => currentGrid.value,
    (current, previous) => {
      if (!previous) return
      if (
        current.some(
          (c, i) =>
            c.x !== previous[i].x ||
            c.y !== previous[i].y ||
            c.color !== previous[i].color,
        )
      ) {
        currentGridAtTargetReady.value = true
      }
    },
  )

  const xInternal = currentGrid.value.map(c => useSharedValue(c.x))
  const yInternal = currentGrid.value.map(c => useSharedValue(c.y))

  const target = currentGrid.value.map((currentVertex, vertexIndex) => {
    return {
      x: useSharedValue(currentVertex.x),
      y: useSharedValue(currentVertex.y),
      color: useSharedValue(currentVertex.color),
    }
  })

  const leftAtColor = currentGrid.value.map(vertex =>
    useSharedValue(vertex.color),
  )
  function calculateDynamicXPositionWithDirection(
    t: number,
    points: number[],
  ): number {
    'worklet'
    // Ensure the points array has exactly three points
    if (points.length !== 3) {
      return points[0]
    }

    // Extract the start, mid, and end positions from the points array
    // When t is negative, reverse the points order to simulate rolling back
    const [startPosition, midPosition, endPosition] =
      t <= 0 ? points : [...points].reverse()

    // Use the absolute value of t for calculation
    const absT = Math.abs(t)

    // Calculate the x position based on the progress value t
    let xPosition: number

    if (absT >= 0 && absT <= 0.5) {
      // Interpolate between startPosition and midPosition
      xPosition = startPosition + (midPosition - startPosition) * (absT / 0.5)
    } else if (absT > 0.5 && absT <= 1) {
      // Interpolate between midPosition and endPosition
      xPosition =
        midPosition + (endPosition - midPosition) * ((absT - 0.5) / 0.5)
    } else {
      // Out of bounds, return the start or end position as a fallback
      xPosition = absT <= 0 ? startPosition : endPosition
    }

    return xPosition
  }

  const findMoveToClosestT = (x: number, points: number[]): number => {
    'worklet'
    if (x >= points[0] + (points[2] - points[0]) * 0.4) {
      return currentStep.value
    } else {
      return direction.value * 2
    }
  }

  const moveToClosestTValue = useSharedValue(currentStep.value)
  useAnimatedReaction(
    () => offset.value,
    (current, _) => {
      target.forEach((vertex, i) => {
        // vertex.x.value =
        //   currentGrid.value[i].x +
        //   direction.value *
        //     (targetGrid.value[i].x - currentGrid.value[i].x) *
        //     current

        let startSlice = 0
        let endSlice = 0
        if (direction.value === -1) {
          startSlice = gridStreams[i].length + currentStep.value - 3
          endSlice = gridStreams[i].length + currentStep.value
        } else if (direction.value === 1) {
          startSlice = gridStreams[i].length + currentStep.value - 1
          endSlice = gridStreams[i].length + currentStep.value + 2
        }

        console.log('startSlice: ', startSlice, 'endSlice: ', endSlice)

        const last3 = gridStreams[i]
          .slice(startSlice, endSlice)
          .map(p => p.x)
          .reverse()
        console.log('last3: ', last3)
        vertex.x.value = calculateDynamicXPositionWithDirection(current, last3)
        vertex.y.value = currentGrid.value[i].y

        moveToClosestTValue.value = findMoveToClosestT(vertex.x.value, last3)
        // console.log('moveToCloestTValue: ', moveToClosestTValue.value)

        if (current !== 0) {
          const color_ = interpolateColor(
            Math.abs(current),
            [0, 1],
            [currentGrid.value[i].color, targetGrid.value[i].color],
          )
          vertex.color.value = color_
          leftAtColor[i].value = color_
        }
      })
    },
  )

  // useAnimatedReaction(
  //   () => currentStep.value,
  //   current => {
  //     console.log('Current step: ', current)
  //   },
  // )

  useAnimatedReaction(
    () => isMouseDownForPanning.value,
    (current, previous) => {
      if (current === false && previous === true) {
        if (isPanningRunning.value === true && direction.value !== 0) {
          if (Math.abs(offset.value) > autoScrollThreshold) {
            console.log('moveToClosestTValue: ', moveToClosestTValue.value)
            // console.log(' direction: ', direction.value)
            currentStep.value = currentStep.value + moveToClosestTValue.value
            moveToClosestTValue.value = 0
          } else {
            currentGridAtTargetReady.value = true
          }

          offset.value = 0
          isPanningRunning.value = false
        }
      }
    },
  )

  useAnimatedReaction(
    () => xInternal[0].value,
    () => {
      if (
        isMouseDownForPanning.value === false &&
        direction.value !== 0 &&
        currentGridAtTargetReady.value === true
      ) {
        target.forEach((vertex, i) => {
          vertex.color.value = interpolateColor(
            Math.abs(xInternal[0].value - target[0].x.value) / width,
            [autoScrollThreshold, 0],
            [leftAtColor[i].value, currentGrid.value[i].color],
          )
        })
      }
    },
  )

  const pan = Gesture.Pan()
    .onStart(() => {
      isPanningRunning.value = true
      isMouseDownForPanning.value = true
      offset.value = 0
      direction.value = 0
    })
    .onUpdate(event => {
      if (direction.value === 0) {
        direction.value = event.velocityX > 0 ? 1 : -1
      }

      if (
        (currentStep.value === 0 && direction.value === 1) ||
        (currentStep.value === -pages + 1 && direction.value === -1)
      ) {
        return
      }

      if (isPanningRunning.value == false) {
        return
      } else {
        // console.log(event.translationX, width)
        offset.value = (event.translationX / width) * 1
      }
    })
    .onEnd(() => {
      isMouseDownForPanning.value = false
    })

  useAnimatedReaction(
    () => target[0].x.value,
    () => {
      if (isPanningRunning.value === true) {
        if (isMouseDownForPanning.value === true) {
          xInternal.forEach((x, i) => (x.value = target[i].x.value))
        } else {
          xInternal.forEach((x, i) => {
            if (i === 0) {
              //NOTE: Callback to keep track of animation completion
              animationCompleted.value = 0
              x.value = withTiming(
                currentGrid.value[i].x,
                animationConfig,
                isFinished => {
                  if (isFinished) animationCompleted.value = 1
                },
              )
            } else {
              x.value = withTiming(currentGrid.value[i].x, animationConfig)
            }
          })
        }
      } else {
        xInternal.forEach((x, i) => {
          if (i === 0) {
            //NOTE: Callback to keep track of animation completion
            animationCompleted.value = 0
            x.value = withTiming(
              target[i].x.value,
              animationConfig,
              isFinished => {
                if (isFinished) animationCompleted.value = 1
              },
            )
          } else {
            x.value = withTiming(target[i].x.value, animationConfig)
          }
        })
      }
    },
  )

  useAnimatedReaction(
    () => target[0].y.value,
    () => {
      if (isPanningRunning.value === true) {
        if (isMouseDownForPanning.value === true) {
          yInternal.forEach((y, i) => (y.value = target[i].y.value))
        } else {
          yInternal.forEach(
            (y, i) =>
              (y.value = withTiming(currentGrid.value[i].y, animationConfig)),
          )
        }
      } else {
        yInternal.forEach(
          (y, i) => (y.value = withTiming(target[i].y.value, animationConfig)),
        )
      }
    },
  )

  useAnimatedReaction(
    () => animationCompleted.value,
    (current, previous) => {
      if (current === 1 && previous === 0) {
        currentGridAtTargetReady.value = false
        animationCompleted.value = 0
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
              debug={debug}
            />
            {debug ? (
              xInternal.map((x, i) => (
                <Circle
                  key={i}
                  cx={x}
                  cy={yInternal[i]}
                  r={20}
                  color={target[i].color}>
                  <Paint color="black" style="stroke" strokeWidth={1} />
                </Circle>
              ))
            ) : (
              <></>
            )}
          </Canvas>
        </GestureDetector>
      </GestureHandlerRootView>
    </View>
  )
}
