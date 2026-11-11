// Die tables: the "d8 | Personality Trait" tables the books print for a player to
// roll on or choose from. Any text can hold one (a background's characteristics,
// a trinket table, a wild magic surge), so this reads them from any entries and
// knows nothing of what they are for.

import { randomInt } from '../dice/dice'
import type { Entry } from '../text/Entries'
import { stripTags } from '../text/tags'
import { titleCase } from '../text/titleCase'

/** One row of a die table: the die values it covers, and what it says. */
export interface DieRow {
  min: number
  max: number
  /** The row's text, as plain text. */
  text: string
}

export interface DieTable {
  /** The table's caption, else its second column label; title case, no trailing ":". */
  title: string
  /** The second column label as printed ("Personality Trait"). */
  label: string
  /** The name of the nearest named entry the table sits in. */
  section?: string
  /** The die rolled on it: N of "dN". */
  die: number
  rows: DieRow[]
}

type Fields = Record<string, unknown>
const isFields = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const DIE = /^d(\d+)$/i
const RANGE = /^(\d+)\s*(?:[-–]\s*(\d+))?$/

/** The die values a row's first cell covers: `3`, `"3"`, `"2-3"`, or a roll cell. */
function rowRange(cell: unknown): { min: number; max: number } | undefined {
  if (typeof cell === 'number') return { min: cell, max: cell }
  if (typeof cell === 'string') {
    const match = RANGE.exec(stripTags(cell).trim())
    if (!match) return undefined
    const min = Number(match[1])
    return { min, max: match[2] === undefined ? min : Number(match[2]) }
  }
  if (isFields(cell) && isFields(cell.roll)) {
    const { exact, min, max } = cell.roll
    if (typeof exact === 'number') return { min: exact, max: exact }
    if (typeof min === 'number' && typeof max === 'number') return { min, max }
  }
  return undefined
}

/** The rows of a table that covers 1..die exactly, in order, or nothing. */
function dieRows(rows: unknown, die: number): DieRow[] | undefined {
  if (!Array.isArray(rows) || rows.length === 0) return undefined
  const out: DieRow[] = []
  let next = 1
  for (const row of rows) {
    if (!Array.isArray(row) || row.length !== 2) return undefined
    const range = rowRange(row[0])
    const [, text] = row
    if (!range || range.min !== next || range.max < range.min) return undefined
    if (typeof text !== 'string' && typeof text !== 'number') return undefined
    out.push({ ...range, text: stripTags(String(text)) })
    next = range.max + 1
  }
  return next === die + 1 ? out : undefined
}

/** An entry read as a die table, or nothing when it is not one. */
function readDieTable(entry: unknown, section?: string): DieTable | undefined {
  if (!isFields(entry) || entry.type !== 'table') return undefined
  const { colLabels, caption } = entry
  if (!Array.isArray(colLabels) || colLabels.length !== 2) return undefined
  const [first, second] = colLabels.map((label) => stripTags(String(label)).trim())
  const die = DIE.exec(first)
  if (!die) return undefined
  const rows = dieRows(entry.rows, Number(die[1]))
  if (!rows) return undefined
  const named =
    typeof caption === 'string' && caption.trim() ? stripTags(caption) : second
  return {
    title: titleCase(named.trim().replace(/:$/, '').trim()),
    label: second,
    ...(section !== undefined && { section }),
    die: Number(die[1]),
    rows,
  }
}

function gather(value: unknown, section: string | undefined, out: DieTable[]): void {
  if (Array.isArray(value)) {
    for (const item of value) gather(item, section, out)
    return
  }
  if (!isFields(value)) return
  const table = readDieTable(value, section)
  if (table) {
    out.push(table)
    return
  }
  // Any other table is text; its cells hold no tables of their own.
  if (value.type === 'table') return
  const inner = typeof value.name === 'string' ? value.name : section
  for (const child of Object.values(value)) gather(child, inner, out)
}

/** Every die table in some entries, in reading order, at any depth. */
export function dieTables(entries: Entry[] | undefined): DieTable[] {
  const out: DieTable[] = []
  gather(entries, undefined, out)
  return out
}

/** An entry with the die tables inside it taken out. */
function stripTables(entry: Entry): Entry {
  if (!isFields(entry) || entry.type === 'table') return entry
  const copy: { type?: string; [key: string]: unknown } = {}
  for (const [key, value] of Object.entries(entry))
    copy[key] = Array.isArray(value) ? withoutDieTables(value) : value
  return copy
}

/** Entries with their die tables taken out, at any depth (the text beside the tables). */
export function withoutDieTables(entries: Entry[]): Entry[] {
  return entries.filter((entry) => !readDieTable(entry)).map(stripTables)
}

/**
 * Roll for `count` different rows of a table, never one in `taken` (row indexes).
 * A die landing on a taken row, or on one this roll already took, is rolled
 * again; every die rolled is in `values`, in order. `count` is capped at the rows
 * still free, so the roll always ends.
 */
export function rollOnTable(
  table: DieTable,
  count: number,
  taken: readonly number[],
): { values: number[]; rows: number[] } {
  const free = table.rows.filter((_, index) => !taken.includes(index)).length
  const wanted = Math.min(Math.max(count, 0), free)
  const values: number[] = []
  const rows: number[] = []
  while (rows.length < wanted) {
    const value = randomInt(1, table.die)
    values.push(value)
    const row = table.rows.findIndex((r) => value >= r.min && value <= r.max)
    if (!taken.includes(row) && !rows.includes(row)) rows.push(row)
  }
  return { values, rows }
}
