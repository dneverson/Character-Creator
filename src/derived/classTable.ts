// A value of a class's level table by its column ("Martial Arts"), read from the data
// so the die of a Monk's unarmed strike comes from the book and not from a typed list.

import type { ClassEntry, ClassTableGroup } from '../data/class'
import { stripTags } from '../text/tags'
import { cellText } from './classLevelTable'

const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

/** The faces of the die a table cell shows (`{type:"dice", toRoll:[{faces:6}]}` or "1d6"). */
function diceFaces(cell: unknown): number | undefined {
  if (typeof cell === 'string') return Number(/\dd(\d+)/.exec(cell)?.[1]) || undefined
  if (!isRecord(cell) || !Array.isArray(cell.toRoll)) return undefined
  const first: unknown = cell.toRoll[0]
  return isRecord(first) && typeof first.faces === 'number' ? first.faces : undefined
}

/** The die a class's table gives at a level in the named column, when it has one. */
export function classTableDie(
  entry: ClassEntry,
  column: string,
  level: number,
): number | undefined {
  for (const group of entry.classTableGroups ?? []) {
    const col = group.colLabels?.indexOf(column) ?? -1
    if (col < 0) continue
    return diceFaces(group.rows?.[level - 1]?.[col])
  }
  return undefined
}

/** The text of a level table's cell by its column's label ("Rages"), or "" without one. */
export function columnCell(
  tables: readonly ClassTableGroup[],
  column: string,
  level: number,
): string {
  for (const group of tables) {
    const col = (group.colLabels ?? []).findIndex((l) => stripTags(l) === column)
    if (col >= 0) return cellText(group.rows?.[level - 1]?.[col])
  }
  return ''
}
