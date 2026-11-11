// A value of a class's level table by its column ("Martial Arts"), read from the data
// so the die of a Monk's unarmed strike comes from the book and not from a typed list.

import type { ClassEntry } from '../data/class'

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
