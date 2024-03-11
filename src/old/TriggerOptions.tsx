// import React, { useState } from 'react'
// import { Canvas, Circle, Paint } from '@shopify/react-native-skia'
// import { Button, View, useWindowDimensions } from 'react-native'
// import { useSharedValue, withTiming } from 'react-native-reanimated'

// type Vertex = [number, number]

// interface AnimatedCircleProps {
//   initialVertex: Vertex
//   targetVertex: Vertex | null // Allow null to indicate no animation target initially
// }

// // AnimatedCircle component, which only animates when targetVertex is not null
// const AnimatedCircle: React.FC<AnimatedCircleProps> = ({
//   initialVertex,
//   targetVertex,
// }) => {
//   const cx = useSharedValue(initialVertex[0])
//   const cy = useSharedValue(initialVertex[1])

//   React.useEffect(() => {
//     if (targetVertex) {
//       // Only animate if targetVertex has been set
//       cx.value = withTiming(targetVertex[0], { duration: 1000 })
//       cy.value = withTiming(targetVertex[1], { duration: 1000 })
//     }
//   }, [targetVertex, cx, cy])

//   return (
//     <Circle cx={cx} cy={cy} r={20} color={'green'}>
//       <Paint color="#4100FF" style="stroke" strokeWidth={3} />
//     </Circle>
//   )
// }

// export const ColorGridTrigger: React.FC = () => {
//   const { width, height } = useWindowDimensions()
//   const [targetVertex, setTargetVertex] = useState<Vertex | null>(null) // Start with no target

//   // Function to trigger animation towards a new target
//   const moveToTarget = () => {
//     // Set target vertex to a random point on the screen
//     setTargetVertex([Math.random() * width, Math.random() * height])
//   }

//   return (
//     <View style={{ flex: 1 }}>
//       <Canvas style={{ flex: 1 }}>
//         <AnimatedCircle initialVertex={[0, 0]} targetVertex={targetVertex} />
//         {/* You can add more AnimatedCircle components and manage their target vertices similarly */}
//       </Canvas>
//       <Button title="Move to Target" onPress={moveToTarget} />
//     </View>
//   )
// }

// import React, { useState } from 'react'
// import { Canvas, Circle, Paint } from '@shopify/react-native-skia'
// import { Button, View, useWindowDimensions } from 'react-native'
// import { useSharedValue, withTiming } from 'react-native-reanimated'

// type Vertex = [number, number]

// interface ACircleProps {
//   initialVertex: Vertex
//   targetVertex: Vertex // Use targetVertex directly to control animation
// }

// const ACircle: React.FC<ACircleProps> = ({ initialVertex, targetVertex }) => {
//   const cx = useSharedValue(initialVertex[0])
//   const cy = useSharedValue(initialVertex[1])

//   // Respond to changes in targetVertex to trigger animation
//   React.useEffect(() => {
//     cx.value = withTiming(targetVertex[0], { duration: 1000 })
//     cy.value = withTiming(targetVertex[1], { duration: 1000 })
//   }, [targetVertex])

//   return (
//     <Circle cx={cx} cy={cy} r={20} color={'green'}>
//       <Paint color="#4100FF" style="stroke" strokeWidth={3} />
//     </Circle>
//   )
// }

// export const ColorGridTrigger: React.FC = () => {
//   const { width, height } = useWindowDimensions()

//   // Initial setup for vertices
//   const N = 1
//   const hSize = width / N
//   const vSize = height / N
//   const initialVertices = new Array(N + 1)
//     .fill(0)
//     .flatMap((_, col) =>
//       new Array(N + 1)
//         .fill(0)
//         .map((_, row) => [col * hSize, row * vSize] as Vertex),
//     )

//   const [vertices, setVertices] = useState<Vertex[]>(initialVertices)

//   // Center of the screen as the target for animation
//   const centerVertex: Vertex = [width / 2, height / 2]

//   return (
//     <View style={{ flex: 1 }}>
//       <Canvas style={{ flex: 1 }}>
//         {vertices.map((vertex, i) => (
//           <ACircle key={i} initialVertex={vertex} targetVertex={vertex} />
//         ))}
//       </Canvas>
//       <View
//         style={{
//           position: 'absolute',
//           top: 0,
//           bottom: 0,
//           left: 0,
//           right: 0,
//           alignItems: 'center',
//           justifyContent: 'center',
//         }}>
//         <Button
//           title="Press me"
//           onPress={() => {
//             // Update vertices to trigger the animation towards the center
//             setVertices(vertices.map(() => centerVertex))
//           }}
//         />
//       </View>
//     </View>
//   )
// }

// import React, { useMemo } from 'react'
// import { Canvas, Circle, Paint, vec } from '@shopify/react-native-skia'
// import { Button, View, useWindowDimensions } from 'react-native'
// import {
//   useSharedValue,
//   withTiming,
//   Easing,
//   useDerivedValue,
// } from 'react-native-reanimated'
// import { palette } from './colorPalette'

// export const ColorGridTrigger: React.FC = () => {
//   const { width, height } = useWindowDimensions()

//   const N = 3 // Number of circles per row/column
//   const TotalWidth = width * 2 // Total width to cover (2 screen widths)
//   const hSize = width / N
//   const vSize = height / N
//   const initialVertices = useMemo(() => {
//     const totalColumns = Math.ceil(TotalWidth / hSize)
//     const totalRows = N
//     return Array.from(
//       { length: totalColumns },
//       (_, col) =>
//         Array.from({ length: totalRows + 1 }, (_, row) =>
//           vec(col * hSize, row * vSize),
//         ), // Adjusted to include the last row
//     ).flat()
//   }, [TotalWidth, hSize, vSize, N])
//   // console.log(initialVertices)

//   // Create shared values for all vertices
//   const sharedVertices = initialVertices.map(vertex => ({
//     cx: useSharedValue(vertex.x),
//     cy: useSharedValue(vertex.y),
//   }))

//   const animateLeft = () => {
//     sharedVertices.forEach(vertex => {
//       // Move left by one grid cell width
//       vertex.cx.value = withTiming(
//         vertex.cx.value - hSize,
//         {
//           duration: 500,
//           easing: Easing.inOut(Easing.ease),
//         },
//         () => {
//           // Move to end of row if vertex is offscreen, no animation
//           if (vertex.cx.value < 0) {
//             vertex.cx.value += TotalWidth
//           }
//         },
//       )
//     })
//   }

//   return (
//     <View style={{ flex: 1 }}>
//       <Canvas style={{ flex: 1 }}>
//         {sharedVertices.map((vertex, i) => (
//           <Circle
//             key={i}
//             cx={vertex.cx}
//             cy={vertex.cy}
//             r={20}
//             color={palette[i % palette.length]} // Ensure color selection loops correctly
//           >
//             <Paint color={'black'} style="stroke" strokeWidth={1} />
//           </Circle>
//         ))}
//       </Canvas>
//       <View
//         style={{
//           position: 'absolute',
//           top: 0,
//           bottom: 0,
//           left: 0,
//           right: 0,
//           alignItems: 'center',
//           justifyContent: 'center',
//         }}>
//         <Button title="Press me" onPress={animateLeft} />
//       </View>
//     </View>
//   )
// }

// const printGridData = ({
//     gridStreams,
//     currentGrid,
//     targetGrid,
//   }: {
//     gridStreams?: ColoredVertex[][]
//     currentGrid?: ColoredVertex[]
//     targetGrid?: ColoredVertex[]
//   }) => {
//     if (gridStreams) {
//       console.log('\n***** gridStreams *****\n')
//       gridStreams.forEach(stream => {
//         console.log(
//           `\n*** Stream start for x: ${stream.at(-1)?.x}, y: ${
//             stream.at(-1)?.y
//           } *** \n`,
//         )
//         stream
//           .reverse()
//           .forEach(vertex =>
//             console.log({ x: vertex.x, y: vertex.y, c: vertex.color }),
//           )
//         console.log('\n*** Stream end *** \n')
//       })
//       console.log('***************\n\n')
//     }
//     if (currentGrid) {
//       console.log('\n***** currentGrid *****\n')
//       currentGrid.forEach((vertex, i) =>
//         console.log({ i, _x: vertex.x, _y: vertex.y, c: vertex.color }),
//       )
//     }
//     if (targetGrid) {
//       console.log('\n\n')
//       console.log('\n***** nextGrid *****\n')
//       targetGrid.forEach((vertex, i) =>
//         console.log({ i, _x: vertex.x, _y: vertex.y, c: vertex.color }),
//       )
//       console.log('***************\n\n')
//     }
//   }
