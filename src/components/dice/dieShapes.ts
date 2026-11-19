// The outline of each die in a 100 by 100 box, the facet lines drawn inside it, and where
// its number sits. A die the table does not name (a d3, a d30) is drawn as a round one.

export interface DieShape {
  /** The outline. */
  path: string
  /** The edges inside the outline, drawn thin. */
  facets: string
  /** The height of the middle of the number. */
  numberY: number
}

const SHAPES: Record<number, DieShape> = {
  4: {
    path: 'M50 8 L94 86 L6 86 Z',
    facets: 'M50 8 L50 58 M6 86 L50 58 M94 86 L50 58',
    numberY: 66,
  },
  6: {
    path: 'M24 10 H76 Q90 10 90 24 V76 Q90 90 76 90 H24 Q10 90 10 76 V24 Q10 10 24 10 Z',
    facets: 'M24 24 H76 V76 H24 Z',
    numberY: 50,
  },
  8: {
    path: 'M50 4 L95 50 L50 96 L5 50 Z',
    facets: 'M50 4 L28 50 L50 96 L72 50 Z M5 50 H95',
    numberY: 50,
  },
  10: {
    path: 'M50 4 L93 40 L50 96 L7 40 Z',
    facets: 'M7 40 L50 58 L93 40 M50 58 L50 96',
    numberY: 52,
  },
  12: {
    path: 'M50 4 L96 37 L78 92 L22 92 L4 37 Z',
    facets:
      'M50 24 L77 44 L67 76 L33 76 L23 44 Z M50 4 L50 24 M96 37 L77 44 M78 92 L67 76 M22 92 L33 76 M4 37 L23 44',
    numberY: 55,
  },
  20: {
    path: 'M50 3 L92 27 L92 73 L50 97 L8 73 L8 27 Z',
    facets:
      'M50 22 L80 68 L20 68 Z M50 3 L50 22 M92 27 L50 22 M8 27 L50 22 M92 27 L80 68 M8 27 L20 68 M92 73 L80 68 M8 73 L20 68 M50 97 L80 68 M50 97 L20 68',
    numberY: 54,
  },
}

const ROUND: DieShape = {
  path: 'M50 6 A44 44 0 1 1 49.9 6 Z',
  facets: 'M50 18 A32 32 0 1 1 49.9 18 Z',
  numberY: 50,
}

/** The drawing of a die with this many sides. */
export const shapeOf = (sides: number): DieShape => SHAPES[sides] ?? ROUND

/** Small marks on the surface, in the 100 by 100 box: x, y, size. */
export const SPECKS: readonly (readonly [number, number, number])[] = [
  [22, 30, 1.8],
  [34, 18, 1.2],
  [70, 22, 1.6],
  [82, 38, 1.1],
  [16, 56, 1.4],
  [30, 74, 1.9],
  [48, 84, 1.2],
  [66, 78, 1.7],
  [84, 62, 1.3],
  [58, 14, 1],
  [76, 52, 1.1],
  [40, 36, 1],
]

/** Veins of marble across the surface. */
export const VEINS: readonly string[] = [
  'M4 30 C28 12 38 52 60 34 S88 56 98 40',
  'M6 74 C24 60 42 90 62 70 S86 82 96 66',
  'M30 4 C20 30 52 40 40 62 S52 88 46 98',
]
