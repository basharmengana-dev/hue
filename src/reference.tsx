import React, { useMemo } from 'react'
import { useWindowDimensions } from 'react-native'
import cdt2d from 'cdt2d'
import {
  Canvas,
  vec,
  Vertices,
  Skia,
  isEdge,
  useClock,
  Fill,
  Points,
} from '@shopify/react-native-skia'
import { useDerivedValue } from 'react-native-reanimated'
import { Triangles } from './Triangles'
import { createNoise2D } from './SimplexNoise'

const points = [
  { x: 50, y: 50, color: 'red' },
  { x: 100, y: 100, color: 'blue' },
  { x: 150, y: 150, color: 'green' },
  // Add more points as needed
]

const N = 2
const n = new Array(N + 1).fill(0).map((_, i) => i)

const palette = [
  '#61DAFB',
  '#fb61da',
  '#dafb61',
  '#61fbcf',
  '#61DAFB',
  '#fb61da',
  '#dafb61',
  '#61fbcf',
  '#61DAFB',
  '#fb61da',
  '#dafb61',
  '#61fbcf',
]
palette.sort(() => Math.random() - 0.5)

export const Demo = () => {
  const { width, height } = useWindowDimensions()

  const hSize = width / N
  const vSize = height / N
  const clock = useClock()

  const AX = hSize * 0.65
  const AY = vSize * 0.65
  const F = 3000

  const defaultVertices = useMemo(() => {
    return n.map(col => n.map(row => vec(col * hSize, row * vSize))).flat()
  }, [hSize, vSize])

  const noises = useMemo(
    () => defaultVertices.map(() => createNoise2D()),
    [defaultVertices],
  )

  const triangles = cdt2d(defaultVertices.map(({ x, y }) => [x, y]))
  const indices = triangles.flat()

  const vertices = useDerivedValue(() => {
    return defaultVertices.map(({ x, y }, i) => {
      const isEdge = x === 0 || x === width || y === 0 || y === height
      if (isEdge) return { x, y }

      const noise2d = noises[i]
      return {
        x: x + AX * noise2d(clock.value / F, 0),
        y: y + AY * noise2d(0, clock.value / F),
      }
    })
  }, [clock])

  const colors = indices.map((i: number) => palette[i % palette.length])

  return (
    <Canvas style={{ width, height }}>
      <Fill color="white" />
      <Vertices
        vertices={vertices}
        indices={indices}
        style="stroke"
        color="black"
        strokeWidth={2}
        colors={colors}
      />
      <Triangles vertices={vertices} triangles={triangles} />
      {/* <Points points={vertices} style="stroke" color="black" strokeWidth={10} /> */}
    </Canvas>
  )
}
