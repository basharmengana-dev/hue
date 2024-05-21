import React, { useMemo, useState } from 'react'
import {
  Canvas,
  Circle,
  Paint,
  Path,
  Vertices,
} from '@shopify/react-native-skia'
import { Button, Share, Text, View, useWindowDimensions } from 'react-native'
import {
  SharedValue,
  runOnJS,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated'
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler'
import cdt2d from 'cdt2d'

const printColorNumber = (colorStr: any) => {
  'worklet'
  // Parse the string to an unsigned 32-bit integer.
  const colorInt = parseInt(colorStr, 10)

  // Convert the integer to a hexadecimal string, ensuring it's padded to 8 characters for ARGB.
  const hexStr = colorInt.toString(16).padStart(8, '0')

  // Return the hexadecimal color code in #AARRGGBB format.
  // If you prefer #RRGGBB format (ignoring alpha), you can modify the return to `#${hexStr.substring(2)}`.
  const hexColor = `#${hexStr.substring(2)}`

  // Extract RGB components from hex color
  const hex = hexColor.startsWith('#') ? hexColor.substring(1) : hexColor
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  // ANSI escape sequence for setting text color
  const ansiStart = `\x1b[38;2;${r};${g};${b}m`
  const ansiEnd = `\x1b[0m` // Reset to default after

  return `${ansiStart}${hexColor}${ansiEnd}`
}

const c = (hexColor: any) => {
  'worklet'
  //check if hexcolor is a number
  const isNumber = typeof hexColor === 'number'
  if (isNumber) return printColorNumber(hexColor)

  // Extract RGB components from hex color
  const hex = hexColor.startsWith('#') ? hexColor.substring(1) : hexColor
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  // ANSI escape sequence for setting text color
  const ansiStart = `\x1b[38;2;${r};${g};${b}m`
  const ansiEnd = `\x1b[0m` // Reset to default after

  return `${ansiStart}${hexColor}${ansiEnd}`
}

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

  return {
    grid,
    hSize,
    vSize,
    totalColumns,
    nonSharedColsPerPage: cols,
  }
}

const createStreamedGrid = ({
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

  const gridStreams = baseGrid.map(({ x, y }, j) => {
    return Array.from({ length: totalColumns - 1 }, (_, i) => {
      const p = {
        x: x + hSize * (i + 2 - totalColumns),
        y: y,
      }
      return p
    })
  })

  return { gridStreams, nonSharedColsPerPage }
}

const computeSineAdditive = (
  x: number,
  y: number,
): { xAdditive: number; yAdditive: number } => {
  return {
    xAdditive: Math.cos(x / 130) * 60, // increase amplitude to pull middle points closer
    yAdditive: Math.sin(x / 130) * 60,
  }
}

const getCurrentGrid = ({
  gridStreams,
  current,
}: {
  gridStreams: Vertex[][]
  current: number
}) => {
  'worklet'
  return gridStreams.map(stream => stream[stream.length - 1 + current])
}

export const Hue: React.FC = () => {
  const { width, height } = useWindowDimensions()
  const [debug, setDebug] = useState(true)

  const autoScrollThreshold = 0.4

  const cols = 3,
    rows = 5,
    pages = 5

  if (pages < 2 || cols < 2 || rows < 2) {
    throw new Error('Pages, cols and rows must be 2 or greater')
  }

  const { gridStreams, nonSharedColsPerPage } = useMemo(() => {
    const { gridStreams, nonSharedColsPerPage } = createStreamedGrid({
      rows,
      cols,
      pages,
      width,
      height,
    })

    gridStreams.forEach((stream, j) => {
      stream.forEach((p, i) => {
        const isFirstPageEdge = j < rows + 1
        const isLastMostPageEdge = j >= gridStreams.length - rows * rows
        const isTopPosition = p.y === 0
        const isBottomPosition = p.y === height

        if (
          isTopPosition ||
          isBottomPosition ||
          isLastMostPageEdge ||
          isFirstPageEdge
        ) {
          return
        }

        //normalize the x position to be between 0 and width
        const sineAdditive = computeSineAdditive(p.x, p.y)

        p.x = p.x + sineAdditive.xAdditive
        p.y = p.y + sineAdditive.yAdditive
      })
    })

    gridStreams.forEach(stream => {
      stream.forEach(p => {
        p.x = Math.round(p.x)
        p.y = Math.round(p.y)
      })
    })

    return { gridStreams, nonSharedColsPerPage }
  }, [rows, cols, pages, width, height])

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
  const didFlipPage = useSharedValue(false)

  const currentPage = useSharedValue(1)
  const [currentPageDisplay, setCurrentPageDispay] = useState(1)

  const currentGrid = useDerivedValue(() =>
    getCurrentGrid({ gridStreams, current: currentStep.value }),
  )

  const xInternal = currentGrid.value.map(c => useSharedValue(c.x))
  const yInternal = currentGrid.value.map(c => useSharedValue(c.y))

  const target = currentGrid.value.map(currentVertex => {
    return {
      x: useSharedValue(currentVertex.x),
      y: useSharedValue(currentVertex.y),
    }
  })

  const scene = [
    { colorA: '#FF94A3', pageA: 0, edge: false },
    { colorA: '#FF94A3', pageA: 0, edge: false },
    { colorA: '#FF94A3', pageA: 0, edge: false },
    { colorA: '#FF94A3', pageA: 0, edge: false },
    { colorA: '#FF94A3', pageA: 0, edge: false },
    { colorA: '#FF94A3', pageA: 0, edge: false },

    { colorA: '#FF94A3', pageA: 0, edge: false },
    { colorA: '#FF94A3', pageA: 0, edge: false },
    { colorA: '#FF94A3', pageA: 0, edge: false },
    { colorA: '#FF94A3', pageA: 0, edge: false },
    { colorA: '#FF94A3', pageA: 0, edge: false },
    { colorA: '#FF94A3', pageA: 0, edge: false },

    { colorA: '#FF94A3', pageA: 0, edge: false },
    { colorA: '#FF94A3', pageA: 0, edge: false },
    { colorA: '#FF94A3', pageA: 0, edge: false },
    { colorA: '#FF94A3', pageA: 0, edge: false },
    { colorA: '#FF94A3', pageA: 0, edge: false },
    { colorA: '#FF94A3', pageA: 0, edge: false },

    // ----------------

    { colorA: '#FF94A3', pageA: 0, colorB: '#C7CEEA', pageB: 1, edge: true },
    { colorA: '#FF94A3', pageA: 0, colorB: '#C7CEEA', pageB: 1, edge: true },
    { colorA: '#FF94A3', pageA: 0, colorB: '#C7CEEA', pageB: 1, edge: true },
    { colorA: '#FF94A3', pageA: 0, colorB: '#C7CEEA', pageB: 1, edge: true },
    { colorA: '#FF94A3', pageA: 0, colorB: '#C7CEEA', pageB: 1, edge: true },
    { colorA: '#FF94A3', pageA: 0, colorB: '#C7CEEA', pageB: 1, edge: true },

    { colorA: '#C7CEEA', pageA: 1, edge: false },
    { colorA: '#C7CEEA', pageA: 1, edge: false },
    { colorA: '#C7CEEA', pageA: 1, edge: false },
    { colorA: '#C7CEEA', pageA: 1, edge: false },
    { colorA: '#C7CEEA', pageA: 1, edge: false },
    { colorA: '#C7CEEA', pageA: 1, edge: false },

    { colorA: '#C7CEEA', pageA: 1, edge: false },
    { colorA: '#C7CEEA', pageA: 1, edge: false },
    { colorA: '#C7CEEA', pageA: 1, edge: false },
    { colorA: '#C7CEEA', pageA: 1, edge: false },
    { colorA: '#C7CEEA', pageA: 1, edge: false },
    { colorA: '#C7CEEA', pageA: 1, edge: false },

    // ----------------

    { colorA: '#C7CEEA', pageA: 1, colorB: '#7B9E44', pageB: 2, edge: true },
    { colorA: '#C7CEEA', pageA: 1, colorB: '#7B9E44', pageB: 2, edge: true },
    { colorA: '#C7CEEA', pageA: 1, colorB: '#7B9E44', pageB: 2, edge: true },
    { colorA: '#C7CEEA', pageA: 1, colorB: '#7B9E44', pageB: 2, edge: true },
    { colorA: '#C7CEEA', pageA: 1, colorB: '#7B9E44', pageB: 2, edge: true },
    { colorA: '#C7CEEA', pageA: 1, colorB: '#7B9E44', pageB: 2, edge: true },

    { colorA: '#7B9E44', pageA: 2, edge: false },
    { colorA: '#7B9E44', pageA: 2, edge: false },
    { colorA: '#7B9E44', pageA: 2, edge: false },
    { colorA: '#7B9E44', pageA: 2, edge: false },
    { colorA: '#7B9E44', pageA: 2, edge: false },
    { colorA: '#7B9E44', pageA: 2, edge: false },

    { colorA: '#7B9E44', pageA: 2, edge: false },
    { colorA: '#7B9E44', pageA: 2, edge: false },
    { colorA: '#7B9E44', pageA: 2, edge: false },
    { colorA: '#7B9E44', pageA: 2, edge: false },
    { colorA: '#7B9E44', pageA: 2, edge: false },
    { colorA: '#7B9E44', pageA: 2, edge: false },

    // ----------------

    { colorA: '#7B9E44', pageA: 2, colorB: '#FFD166', pageB: 3, edge: true },
    { colorA: '#7B9E44', pageA: 2, colorB: '#FFD166', pageB: 3, edge: true },
    { colorA: '#7B9E44', pageA: 2, colorB: '#FFD166', pageB: 3, edge: true },
    { colorA: '#7B9E44', pageA: 2, colorB: '#FFD166', pageB: 3, edge: true },
    { colorA: '#7B9E44', pageA: 2, colorB: '#FFD166', pageB: 3, edge: true },
    { colorA: '#7B9E44', pageA: 2, colorB: '#FFD166', pageB: 3, edge: true },

    { colorA: '#FFD166', pageA: 3, edge: false },
    { colorA: '#FFD166', pageA: 3, edge: false },
    { colorA: '#FFD166', pageA: 3, edge: false },
    { colorA: '#FFD166', pageA: 3, edge: false },
    { colorA: '#FFD166', pageA: 3, edge: false },
    { colorA: '#FFD166', pageA: 3, edge: false },

    { colorA: '#FFD166', pageA: 3, edge: false },
    { colorA: '#FFD166', pageA: 3, edge: false },
    { colorA: '#FFD166', pageA: 3, edge: false },
    { colorA: '#FFD166', pageA: 3, edge: false },
    { colorA: '#FFD166', pageA: 3, edge: false },
    { colorA: '#FFD166', pageA: 3, edge: false },

    // ----------------

    { colorA: '#FFD166', pageA: 3, colorB: '#1B9944', pageB: 4, edge: true },
    { colorA: '#FFD166', pageA: 3, colorB: '#1B9944', pageB: 4, edge: true },
    { colorA: '#FFD166', pageA: 3, colorB: '#1B9944', pageB: 4, edge: true },
    { colorA: '#FFD166', pageA: 3, colorB: '#1B9944', pageB: 4, edge: true },
    { colorA: '#FFD166', pageA: 3, colorB: '#1B9944', pageB: 4, edge: true },
    { colorA: '#FFD166', pageA: 3, colorB: '#1B9944', pageB: 4, edge: true },

    { colorA: '#1B9944', pageA: 4, edge: false },
    { colorA: '#1B9944', pageA: 4, edge: false },
    { colorA: '#1B9944', pageA: 4, edge: false },
    { colorA: '#1B9944', pageA: 4, edge: false },
    { colorA: '#1B9944', pageA: 4, edge: false },
    { colorA: '#1B9944', pageA: 4, edge: false },

    { colorA: '#1B9944', pageA: 4, edge: false },
    { colorA: '#1B9944', pageA: 4, edge: false },
    { colorA: '#1B9944', pageA: 4, edge: false },
    { colorA: '#1B9944', pageA: 4, edge: false },
    { colorA: '#1B9944', pageA: 4, edge: false },
    { colorA: '#1B9944', pageA: 4, edge: false },

    { colorA: '#1B9944', pageA: 4, edge: false },
    { colorA: '#1B9944', pageA: 4, edge: false },
    { colorA: '#1B9944', pageA: 4, edge: false },
    { colorA: '#1B9944', pageA: 4, edge: false },
    { colorA: '#1B9944', pageA: 4, edge: false },
    { colorA: '#1B9944', pageA: 4, edge: false },
  ]

  const colorStreams = useSharedValue(scene.map(cMap => cMap.colorA))
  const circleColor = scene.map(cMap => useSharedValue(cMap.colorA))

  const animateColor = ({
    i,
    absOffset,
    colorA,
    colorB,
  }: {
    i: number
    absOffset: number
    colorA: string
    colorB: string
  }) => {
    'worklet'
    const animatedColor = interpolateColor(absOffset, [0, 1], [colorA, colorB])
    colorStreams.value[i] = animatedColor
    circleColor[i].value = animatedColor

    return animatedColor
  }

  const mouseUpColor = useSharedValue(scene.map(cMap => cMap.colorA))
  const storedOffset = useSharedValue(0)

  useAnimatedReaction(
    () => offset.value,
    offset => {
      if (isPanningRunning.value === true) {
        if (isMouseDownForPanning.value === true) {
          const page = currentPage.value - 1
          const absOffset = Math.abs(offset)

          scene.forEach((cIndex, i) => {
            if (cIndex.edge && cIndex.colorB) {
              if (cIndex.pageA === page && direction.value === -1) {
                const color = animateColor({
                  i,
                  absOffset,
                  colorA: cIndex.colorA,
                  colorB: cIndex.colorB,
                })
                mouseUpColor.value[i] = color
              } else if (cIndex.pageB === page && direction.value === 1) {
                const color = animateColor({
                  i,
                  absOffset,
                  colorA: cIndex.colorB,
                  colorB: cIndex.colorA,
                })
                mouseUpColor.value[i] = color
              }
            }
          })

          storedOffset.value = offset
        }
      }
    },
  )

  useAnimatedReaction(
    () => xInternal[0].value,
    _ => {
      if (isPanningRunning.value === false) {
        if (isMouseDownForPanning.value === false) {
          const leftOffset =
            Math.abs(xInternal[0].value - target[0].x.value) / width
          const adjustedStoredOffsetFront = Math.abs(
            storedOffset.value + (didFlipPage.value ? 1 : 0),
          )
          const adjustedStoredOffsetBack = Math.abs(
            storedOffset.value - (didFlipPage.value ? 1 : 0),
          )
          const adjustedPageBack =
            currentPage.value - 1 - (didFlipPage.value ? 1 : 0)

          const adjustedPageFront =
            currentPage.value - 1 + (didFlipPage.value ? 1 : 0)

          scene.forEach((cIndex, i) => {
            if (cIndex.pageA === adjustedPageBack) {
              if (cIndex.edge && cIndex.colorB) {
                const animatedColor = interpolateColor(
                  leftOffset,
                  [adjustedStoredOffsetFront, 0],
                  [
                    mouseUpColor.value[i],
                    !didFlipPage.value ? cIndex.colorA : cIndex.colorB,
                  ],
                )
                colorStreams.value[i] = animatedColor
                circleColor[i].value = animatedColor
              }
            } else if (cIndex.pageB === adjustedPageFront) {
              if (cIndex.edge) {
                const animatedColor = interpolateColor(
                  leftOffset,
                  [adjustedStoredOffsetBack, 0],
                  [
                    mouseUpColor.value[i],
                    didFlipPage.value ? cIndex.colorA : cIndex.colorB,
                  ],
                )
                colorStreams.value[i] = animatedColor
                circleColor[i].value = animatedColor
              }
            }
          })
        }
      }
    },
  )

  const getAnimationConfig = () => {
    'worklet'
    return { duration: animationDuration.value }
  }

  const interpolateDynamic = (t: number, nextPositions: number[]): number => {
    'worklet'
    if (nextPositions.length < 2) {
      return nextPositions[0]
    }

    const adjustedPoints = t <= 0 ? nextPositions : [...nextPositions].reverse()
    const absT = Math.abs(t)

    let interpolatedPosition: number =
      direction.value < 0
        ? adjustedPoints[0]
        : adjustedPoints[adjustedPoints.length - 1]

    const segments = nextPositions.length - 1
    const segmentSize = 1 / segments

    // Explicitly handle the first segment condition
    if (absT > 0 && absT < segmentSize) {
      const startPos = adjustedPoints[0]
      const endPos = adjustedPoints[1]
      interpolatedPosition =
        startPos + (endPos - startPos) * (absT / segmentSize)
    } else {
      // Handle the remaining segments
      for (let i = 1; i < segments; i++) {
        const segmentStart = i * segmentSize
        const segmentEnd = (i + 1) * segmentSize

        if (absT >= segmentStart && absT < segmentEnd) {
          const startPos = adjustedPoints[i]
          const endPos = adjustedPoints[i + 1]
          interpolatedPosition =
            startPos +
            (endPos - startPos) * ((absT - segmentStart) / segmentSize)
          break
        }
      }
    }

    return interpolatedPosition
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

        const nextSteam = gridStreams[i].slice(startSlice, endSlice)

        // iterace over next stream starting from the end
        const xJourney: number[] = []
        const yJourney: number[] = []
        for (let j = nextSteam.length - 1; j >= 0; j--) {
          xJourney.push(nextSteam[j].x)
          yJourney.push(nextSteam[j].y)
        }

        vertex.x.value = interpolateDynamic(current, xJourney)
        vertex.y.value = interpolateDynamic(current, yJourney)
      })
    },
  )

  useAnimatedReaction(
    () => currentPage.value,
    (current, previous) => {
      if (previous === null) return

      if (current !== previous) {
        didFlipPage.value = true
      } else {
        didFlipPage.value = false
      }
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

  const swiping = useSharedValue(false)
  const pan = Gesture.Pan()
    .minDistance(40)
    .onStart(() => {
      isPanningRunning.value = true
      isMouseDownForPanning.value = true
      offset.value = 0
      storedOffset.value = 0
      direction.value = 0
      _direction.value = 0
      animationDuration.value = 500
      didFlipPage.value = false
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
        animationDuration.value = 300
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

      if (swiping.value) return

      if (isPanningRunning.value == false) {
        return
      } else {
        // NOTE: if quick swipe
        if (Math.abs(event.velocityX) > 1000) {
          animationDuration.value = 500
          swiping.value = true
          offset.value = withTiming(
            direction.value,
            getAnimationConfig(),
            () => {
              swiping.value = false
              isMouseDownForPanning.value = false
            },
          )

          return
        }

        offset.value = event.translationX / width
      }
    })
    .onEnd(() => {
      if (swiping.value) return

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

  return (
    <View style={{ flex: 1 }}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <GestureDetector gesture={pan}>
          <Canvas style={{ flex: 1, backgroundColor: 'white' }}>
            <HueBackground
              colors={colorStreams}
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
                  color={circleColor[i]}>
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
          top: height - 30,
          left: 0,
          width: width,
          height: 60,
          backgroundColor: 'rgba(255, 255, 255, 0.5)',
          flexDirection: 'row',
        }}>
        <View
          style={{
            top: 5,
            left: 30,
          }}>
          <Text>{`${currentPageDisplay} / ${pages}`}</Text>
        </View>
        <View
          style={{
            top: 0,
            left: 50,
          }}>
          <Button title="🐛" onPress={() => setDebug(!debug)} />
        </View>
      </View>
    </View>
  )
}
