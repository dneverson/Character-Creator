// The order of the areas listed under a map: as the book numbers them, "1, 2, ... 10, 11"
// (and "A1, A2", "K1 ... K88"), not the order the data happens to draw them in. An area
// whose heading carries no number comes after them, in the order of the text (by id).

import type { Target } from './outline'

/** The number (or lettered number) a heading starts with: "K12. Crypt" -> "K12". */
const NUMBERED = /^([A-Za-z]{0,2}\d+[A-Za-z]?)\b/

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

/** One area of a map: the id of its heading, and where that is. */
export interface MapArea {
  key: string
  target: Target
}

/** The areas of a map, each once, in the order the book numbers them. */
export function sortAreas(areas: readonly MapArea[]): MapArea[] {
  const once = [...new Map(areas.map((area) => [area.key, area])).values()]
  const number = (area: MapArea) => NUMBERED.exec(area.target.name.trim())?.[1]
  // Numbered areas first, in number order; the others after them, in the text's order.
  return once.sort((a, b) => {
    const [x, y] = [number(a), number(b)]
    if (x !== undefined && y !== undefined) return collator.compare(x, y)
    if (x !== undefined || y !== undefined) return x === undefined ? 1 : -1
    return collator.compare(a.key, b.key)
  })
}
