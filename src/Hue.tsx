import React, { useMemo, useState } from 'react'
import {
  Canvas,
  Circle,
  Paint,
  Path,
  Vertices,
} from '@shopify/react-native-skia'
import { Text, View, useWindowDimensions } from 'react-native'
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

  return { grid, hSize, vSize, totalColumns, nonSharedColsPerPage: cols }
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
    nonSharedColsPerPage,
  } = createGrid({
    rows,
    cols,
    pages,
    width,
    height,
  })

  // .slice(4, 5)
  const gridStreams = baseGrid.map(({ x, y }, i) => {
    return Array.from({ length: totalColumns - 1 }, (_, i) => {
      const p = {
        x: x + hSize * (i + 2 - totalColumns),
        y: y,
        color: colorStream[0],
      }

      return p
    })
  })

  return { gridStreams, nonSharedColsPerPage }
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

export const Hue: React.FC = () => {
  const { width, height } = useWindowDimensions()

  const autoScrollThreshold = 0.3
  const debug = true

  const cols = 3,
    rows = 1,
    pages = 5

  const { gridStreams, nonSharedColsPerPage } = useMemo(
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
  // console.log(gridStreams.filter((_, i) => i === 0).map(p => p.map(p => p.x)))

  const currentStep = useSharedValue(0)
  const direction = useSharedValue(0)
  const offset = useSharedValue(0)
  const isPanningRunning = useSharedValue(true)
  const isMouseDownForPanning = useSharedValue(false)
  const animationCompleted = useSharedValue(0)
  const currentGridAtTargetReady = useSharedValue(false)
  const midWaySwitchDirection = useSharedValue(false)
  const _direction = useSharedValue(0)
  const moveToClosestTValue = useSharedValue(currentStep.value)
  const animationDuration = useSharedValue(300)

  const currentPage = useSharedValue(1)
  const [currentPageDisplay, setCurrentPageDispay] = useState(1)

  const currentGrid = useDerivedValue(() =>
    getCurrentGrid({ gridStreams, current: currentStep.value }),
  )

  const getAnimationConfig = () => {
    'worklet'
    return { duration: animationDuration.value }
  }

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
  function interpolate3(t: number, points: number[]): number {
    'worklet'

    if (points.length !== 3) {
      return points[0]
    }

    const [startPosition, midPosition, endPosition] =
      t <= 0 ? points : [...points].reverse()

    const absT = Math.abs(t)

    let xPosition: number

    if (absT > 0 && absT <= 0.5) {
      xPosition = startPosition + (midPosition - startPosition) * (absT / 0.5)
    } else if (absT > 0.5 && absT < 1) {
      xPosition =
        midPosition + (endPosition - midPosition) * ((absT - 0.5) / 0.5)
    } else {
      xPosition = direction.value < 0 ? startPosition : endPosition
    }

    return xPosition
  }

  function interpolate4(t: number, points: number[]): number {
    'worklet'
    if (points.length !== 4) {
      return points[0]
    }

    const [firstPosition, secondPosition, thirdPosition, fourthPosition] =
      t <= 0 ? points : [...points].reverse()

    const absT = Math.abs(t)
    let xPosition: number

    if (absT > 0 && absT < 1 / 3) {
      xPosition =
        firstPosition + (secondPosition - firstPosition) * (absT / (1 / 3))
    } else if (absT >= 1 / 3 && absT < 2 / 3) {
      xPosition =
        secondPosition +
        (thirdPosition - secondPosition) * ((absT - 1 / 3) / (1 / 3))
    } else if (absT >= 2 / 3 && absT < 1) {
      xPosition =
        thirdPosition +
        (fourthPosition - thirdPosition) * ((absT - 2 / 3) / (1 / 3))
    } else {
      xPosition = direction.value < 0 ? firstPosition : fourthPosition
    }

    return xPosition
  }

  const evaluateTranslationBasedOnThreshold = (
    x: number,
    points: number[],
  ): number => {
    'worklet'
    let translate = currentStep.value

    if (direction.value === -1) {
      if (x >= points[0] + (points[cols] - points[0]) * autoScrollThreshold) {
        translate = currentStep.value
      } else {
        translate = -cols
      }
    } else if (direction.value === 1) {
      if (x <= points[0] + (points[0] - points[cols]) * autoScrollThreshold) {
        translate = cols
      } else {
        translate = currentStep.value
      }
    }
    return translate
  }

  useAnimatedReaction(
    () => offset.value,
    (current, _) => {
      target.forEach((vertex, i) => {
        let startSlice = 0
        let endSlice = 0

        if (direction.value === -1) {
          startSlice = gridStreams[i].length + currentStep.value - (cols + 1)
          endSlice = gridStreams[i].length + currentStep.value
        } else if (direction.value === 1) {
          startSlice = gridStreams[i].length + currentStep.value - 1
          endSlice = gridStreams[i].length + currentStep.value + cols
        }

        const nextSteam = gridStreams[i]
          .slice(startSlice, endSlice)
          .map(p => p.x)
          .reverse()

        vertex.x.value = interpolate4(current, nextSteam)
        vertex.y.value = currentGrid.value[i].y

        // if (current !== 0) {
        //   const color_ = interpolateColor(
        //     Math.abs(current),
        //     [0, 1],
        //     [currentGrid.value[i].color, targetGrid.value[i].color],
        //   )
        //   vertex.color.value = color_
        //   leftAtColor[i].value = color_
        // }
      })
    },
  )

  useAnimatedReaction(
    () => xInternal[0].value,
    current => {
      let startSlice = 0
      let endSlice = 0

      if (direction.value === -1) {
        startSlice = gridStreams[0].length + currentStep.value - (cols + 1)
        endSlice = gridStreams[0].length + currentStep.value
      } else if (direction.value === 1) {
        startSlice = gridStreams[0].length + currentStep.value - 1
        endSlice = gridStreams[0].length + currentStep.value + cols
      }

      const nextSteam = gridStreams[0]
        .slice(startSlice, endSlice)
        .map(p => p.x)
        .reverse()

      moveToClosestTValue.value = evaluateTranslationBasedOnThreshold(
        current,
        nextSteam,
      )
    },
  )

  useAnimatedReaction(
    () => isMouseDownForPanning.value,
    (current, previous) => {
      if (current === false && previous === true) {
        if (isPanningRunning.value === true && direction.value !== 0) {
          if (Math.abs(offset.value) > autoScrollThreshold) {
            currentStep.value = currentStep.value + moveToClosestTValue.value
          } else {
            currentGridAtTargetReady.value = true
          }
          offset.value = 0
          isPanningRunning.value = false
          moveToClosestTValue.value = 0
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

  useAnimatedReaction(
    () => currentStep.value,
    (current, previous) => {
      if (previous !== null) {
        currentPage.value = -current / nonSharedColsPerPage + 1
        runOnJS(setCurrentPageDispay)(currentPage.value)
      }
    },
  )

  useAnimatedReaction(
    () => _direction.value,
    (current, previous) => {
      if (current === 0 || previous === null) {
        midWaySwitchDirection.value = false
      }

      if (
        (previous === 1 && current === -1) ||
        (previous === -1 && current === 1)
      ) {
        midWaySwitchDirection.value = true
      } else {
        midWaySwitchDirection.value = false
      }
    },
  )

  const pan = Gesture.Pan()
    .onStart(() => {
      isPanningRunning.value = true
      isMouseDownForPanning.value = true
      offset.value = 0
      direction.value = 0
      _direction.value = 0
      animationDuration.value = 300
    })
    .onUpdate(event => {
      _direction.value = event.velocityX > 0 ? 1 : -1

      if (direction.value === 0) {
        direction.value = event.velocityX > 0 ? 1 : -1
      }

      // NOTE: Prevent panning when at the start or end of pagination and user is switching direction
      if (
        (midWaySwitchDirection.value === true &&
          _direction.value === 1 &&
          currentStep.value === 0) ||
        (midWaySwitchDirection.value === true &&
          currentPage.value === pages &&
          _direction.value === -1)
      ) {
        animationDuration.value = 200
        isMouseDownForPanning.value = false
        return
      }

      // NOTE: Prevent panning when at the start or end of pagination when starting with no movement
      if (
        // NOTE: Start of pagination
        (currentStep.value === 0 && direction.value === 1) ||
        // NOTE: End of pagination
        (currentPage.value === pages && direction.value === -1)
      ) {
        return
      }

      if (isPanningRunning.value == false) {
        return
      } else {
        offset.value = event.translationX / width
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
                getAnimationConfig(),
                isFinished => {
                  if (isFinished) animationCompleted.value = 1
                },
              )
            } else {
              x.value = withTiming(currentGrid.value[i].x, getAnimationConfig())
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
              getAnimationConfig(),
              isFinished => {
                if (isFinished) animationCompleted.value = 1
              },
            )
          } else {
            x.value = withTiming(target[i].x.value, getAnimationConfig())
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
              (y.value = withTiming(
                currentGrid.value[i].y,
                getAnimationConfig(),
              )),
          )
        }
      } else {
        yInternal.forEach(
          (y, i) =>
            (y.value = withTiming(target[i].y.value, getAnimationConfig())),
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

      <View
        style={{
          position: 'absolute',
          top: height - 20,
          left: 0,
          width: width,
          height: 50,
          backgroundColor: 'rgba(255, 255, 255, 0.5)',
        }}>
        <Text>{`${currentPageDisplay} / ${pages}`}</Text>
      </View>
    </View>
  )
}
