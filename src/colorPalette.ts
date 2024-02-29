// Create a color palette of 20 different vivid reds
export const redColorPalette = [
  '#FF0000',
  '#FF0D00',
  '#FF1A00',
  '#FF2700',
  '#FF3400',
  '#FF4100',
  '#FF4E00',
  '#FF5B00',
  '#FF6800',
  '#FF7500',
  '#FF8200',
  '#FF8F00',
  '#FF9C00',
  '#FFA900',
  '#FFB600',
  '#FFC300',
  '#FFD000',
  '#FFDD00',
  '#FFEA00',
  '#FFF700',
]
// Create a color palette of 20 different vivid greens
export const greenColorPalette = [
  '#00FF00',
  '#00FF0D',
  '#00FF1A',
  '#00FF27',
  '#00FF34',
  '#00FF41',
  '#00FF4E',
  '#00FF5B',
  '#00FF68',
  '#00FF75',
  '#00FF82',
  '#00FF8F',
  '#00FF9C',
  '#00FFA9',
  '#00FFB6',
  '#00FFC3',
  '#00FFD0',
  '#00FFDD',
  '#00FFEA',
  '#00FFF7',
]
// Create a color palette of 20 different vivid blues
export const blueColorPalette = [
  '#0000FF',
  '#0D00FF',
  '#1A00FF',
  '#2700FF',
  '#3400FF',
  '#4100FF',
  '#4E00FF',
  '#5B00FF',
  '#6800FF',
  '#7500FF',
  '#8200FF',
  '#8F00FF',
  '#9C00FF',
  '#A900FF',
  '#B600FF',
  '#C300FF',
  '#D000FF',
  '#DD00FF',
  '#EA00FF',
  '#F700FF',
]
// Create a color palette of 20 different vivid yellows
export const yellowColorPalette = [
  '#FFFF00',
  '#FFFF0D',
  '#FFFF1A',
  '#FFFF27',
  '#FFFF34',
  '#FFFF41',
  '#FFFF4E',
  '#FFFF5B',
  '#FFFF68',
  '#FFFF75',
  '#FFFF82',
  '#FFFF8F',
  '#FFFF9C',
  '#FFFFA9',
  '#FFFFB6',
  '#FFFFC3',
  '#FFFFD0',
  '#FFFFDD',
  '#FFFFEA',
  '#FFFFF7',
]
// Create a color palette of 20 different vivid purples
export const purpleColorPalette = [
  '#800080',
  '#8D008D',
  '#9A009A',
  '#A700A7',
  '#B400B4',
  '#C100C1',
  '#CE00CE',
  '#DB00DB',
  '#E800E8',
  '#F500F5',
  '#FF00FF',
  '#FF00FF',
  '#FF00FF',
  '#FF00FF',
  '#FF00FF',
  '#FF00FF',
  '#FF00FF',
  '#FF00FF',
  '#FF00FF',
  '#FF00FF',
]

// Create a color palette of 20 different vivid oranges
export const orangeColorPalette = [
  '#FFA500',
  '#FFB20D',
  '#FFBF1A',
  '#FFCC27',
  '#FFD934',
  '#FFE641',
  '#FFF34E',
  '#FFF05B',
  '#FFFD68',
  '#FFFF75',
  '#FFFF82',
  '#FFFF8F',
  '#FFFF9C',
  '#FFFFA9',
  '#FFFFB6',
  '#FFFFC3',
  '#FFFFD0',
  '#FFFFDD',
  '#FFFFEA',
  '#FFFFF7',
]

// Create a color palette of 10 new, mixed vivid blue, green, purple, yellow, orange colors
export const mixedColorPalette = [
  '#00FF00',
  '#00FF0D',
  '#00FF1A',
  '#00FF27',
  '#00FF34',
  '#00FF41',
  '#00FF4E',
  '#00FF5B',
  '#00FF68',
  '#00FF75',
  '#FFA500',
  '#FFB20D',
  '#FFBF1A',
  '#FFCC27',
  '#FFD934',
  '#FFE641',
  '#FFF34E',
  '#FFF05B',
  '#FFFD68',
  '#FFFF75',
]

// and another set of 10 new, mixed vivid blue, green, purple, yellow, orange colors
export const mixedColorPalette2 = [
  '#00FF82',
  '#00FF8F',
  '#00FF9C',
  '#00FFA9',
  '#00FFB6',
  '#00FFC3',
  '#00FFD0',
  '#00FFDD',
  '#00FFEA',
  '#00FFF7',
  '#FFA500',
  '#FFB20D',
  '#FFBF1A',
  '#FFCC27',
  '#FFD934',
  '#FFE641',
  '#FFF34E',
  '#FFF05B',
  '#FFFD68',
  '#FFFF75',
]

function simpleSeededRandom(seed: number): number {
  // A simple pseudo-random function
  seed = (seed * 9301 + 49297) % 233280
  return seed / 233280
}

function simpleWildShuffle(
  array: string[],
  seed: number,
  wildness: number = 50,
): string[] {
  if (wildness < 0) wildness = 0
  if (wildness > 100) wildness = 100

  // Normalize wildness to affect the shuffle's randomness range
  const randomnessFactor = Math.floor((wildness / 100) * array.length)

  const result = array.slice() // Clone the array to avoid modifying the original
  let currentSeed = seed

  for (let i = 0; i < randomnessFactor; i++) {
    currentSeed = simpleSeededRandom(currentSeed) * 233280
    const index1 = Math.floor(simpleSeededRandom(currentSeed) * array.length)
    currentSeed = simpleSeededRandom(currentSeed) * 233280
    const index2 = Math.floor(simpleSeededRandom(currentSeed) * array.length)

    // Swap elements at index1 and index2
    ;[result[index1], result[index2]] = [result[index2], result[index1]]
  }

  return result
}

// spread all the color palettes into a single palette
const allColorPalettes = [
  ...redColorPalette,
  ...greenColorPalette,
  ...blueColorPalette,
  ...yellowColorPalette,
  ...purpleColorPalette,
  ...orangeColorPalette,
  ...mixedColorPalette,
  ...mixedColorPalette2,
]
export const palette = simpleWildShuffle(allColorPalettes, 36343232, 70)
