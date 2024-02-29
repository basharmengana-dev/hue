import React, { memo, useMemo } from 'react'
import {
  Canvas,
  Circle,
  vec,
  type SkPoint,
  Vertices,
  Paint,
  useClock,
} from '@shopify/react-native-skia'
import { useDerivedValue } from 'react-native-reanimated'
import { useWindowDimensions } from 'react-native'
import { NoiseFunction2D, createNoise2D } from './SimplexNoise'
import cdt2d from 'cdt2d'
import useCustomClock from './useCustomClock'
import { palette } from './colorPalette'
import { Triangles } from './Triangles'

export const ColorGrid = () => {
  // Get the window dimensions
  const { width, height } = useWindowDimensions()

  // Create a grid of vertices where N is the number of columns and rows
  // n is an array of numbers from 0 to N
  // hSize and vSize are the horizontal and vertical sizes of each cell
  // and vertices is an array of vec2s representing the grid
  // where each vec2 is the top-left corner
  // a 2x2 grid would look like this:
  // [0, 0] [1, 0]
  // [0, 1] [1, 1]
  // and a 3x3 grid would look like this:
  // [0, 0] [1, 0] [2, 0]
  // [0, 1] [1, 1] [2, 1]
  // [0, 2] [1, 2] [2, 2]
  // and the vertices array would look like this for a 2x2 grid:
  // [0, 0] [1, 0] [0, 1] [1, 1]
  // and for a 3x3 grid:
  // [0, 0] [1, 0] [2, 0] [0, 1] [1, 1] [2, 1] [0, 2] [1, 2] [2, 2]
  const N = 4
  const n = new Array(N + 1).fill(0).map((_, i) => i)
  const hSize = width / N
  const vSize = height / N
  const vertices = useMemo(() => {
    return n.map(col => n.map(row => vec(col * hSize, row * vSize))).flat()
  }, [hSize, vSize])

  // Animation configration
  const xAmplitude = hSize * 0.65
  const yAmplitude = vSize * 0.65
  const Freq = 10000

  // Create a noise function for each vertex
  // noises is an array of noise functions
  // and with useMemo we ensure that the noise functions
  // are only created once when the vertices change
  // each function takes a vec2 and returns a number
  // that number represents the noise value at that position
  const noises = useMemo(() => vertices.map(() => createNoise2D()), [vertices])
  const clock = useCustomClock(10)
  // const clock = useClock()

  // A functional component that returns a Circle for any given vertex of type SKpoint
  type NoisyVertex = {
    vertex: SkPoint
    noise: NoiseFunction2D
    color: string
  }
  const ACircle = ({
    noisyVertex: { vertex, noise, color },
  }: {
    noisyVertex: NoisyVertex
  }) => {
    // If vertex is on edge, dont add noise
    const isEdge =
      vertex.x === 0 ||
      vertex.x === width ||
      vertex.y === 0 ||
      vertex.y === height

    const cx = useDerivedValue(() => {
      if (isEdge) return vertex.x

      return vertex.x + xAmplitude * noise(clock.value / Freq, 0)
    }, [clock])
    const cy = useDerivedValue(() => {
      if (isEdge) return vertex.y

      return vertex.y + yAmplitude * noise(0, clock.value / Freq)
    }, [clock])

    return (
      <Circle cx={cx} cy={cy} r={10} color={color}>
        <Paint color="#4100FF" style="stroke" strokeWidth={3} />
      </Circle>
    )
  }

  // Create triangles between the vertices
  // the output is of type number[][]
  // where each number[] is a triangle and
  // each number in the number[] is an index of a vertex
  // this means each number[] has 3 numbers that represent
  // the indices of the vertices that make up the triangle
  // for example, if the vertices array is:
  // [0, 0] [1, 0]
  // [0, 1] [1, 1]
  // the triangles array would be:
  // [[0, 1, 2], [1, 2, 3]] where each number is the index of a vertex
  // so 0 is the first vertex, 1 is the second vertex, and so on
  // th type of the trianle array is number[][]
  const triangles = cdt2d(vertices.map(({ x, y }) => [x, y]))
  // flatten the triangles array to get a single array of indices
  // that represent the vertices of the triangles
  const indices = triangles.flat()

  // Assign a random color to each vertex in vertices
  const colors = vertices.map((_, i) => palette[i % palette.length])

  const nosiyVertices = vertices.map((vertex, i) => {
    return { vertex, noise: noises[i], color: colors[i] }
  })

  // Add every vertex to a shared value to be used in Vertices
  const derivedVertices = useDerivedValue(() => {
    return nosiyVertices.map(({ vertex, noise }, i) => {
      const isEdge =
        vertex.x === 0 ||
        vertex.x === width ||
        vertex.y === 0 ||
        vertex.y === height
      if (isEdge) return { x: vertex.x, y: vertex.y }

      return {
        x: vertex.x + xAmplitude * noise(clock.value / Freq, 0),
        y: vertex.y + yAmplitude * noise(0, clock.value / Freq),
      }
    })
  }, [clock])

  const animate = true
  return (
    animate && (
      <Canvas style={{ flex: 1 }}>
        <Vertices
          vertices={derivedVertices}
          indices={indices}
          style="stroke"
          color="black"
          strokeWidth={2}
          colors={colors}
        />
        <Triangles vertices={derivedVertices} triangles={triangles} />
        {nosiyVertices.map((noisyVertex, i) => (
          <ACircle key={i} noisyVertex={noisyVertex} />
        ))}
      </Canvas>
    )
  )
}
