// How the rows taken from a background's story tables live in the story fields.
//
// A story field is plain text the player can always edit. A line of it belongs to
// a table only while it is exactly one of the table's rows (with "<title>: "
// before it in Allies and Backstory, which several tables share). Every other
// line is the player's, and choosing again never removes or reorders it: the
// table's lines go first, the player's after. So typing your own trait, or
// editing a rolled one, simply makes it yours.

import type { StoryField, StoryTable } from '../data/background'
import type { StoryState } from './model'

/** The fields several tables write into, where each line says which table it is from. */
const SHARED_FIELDS: ReadonlySet<StoryField> = new Set<StoryField>([
  'allies',
  'backstory',
])

/** A row of a table as its field holds it. */
function rowLine(table: StoryTable, row: number): string {
  const text = table.rows[row].text
  return SHARED_FIELDS.has(table.field) ? `${table.title}: ${text}` : text
}

/** The row of a table a line is, or -1 when it is not one of them. */
function rowOf(line: string, table: StoryTable): number {
  return table.rows.findIndex((_, row) => rowLine(table, row) === line)
}

const linesOf = (text: string) => (text === '' ? [] : text.split('\n'))

/** The rows of a table a field holds, in the order it holds them. */
export function tableRows(text: string, table: StoryTable): number[] {
  const rows: number[] = []
  for (const line of linesOf(text)) {
    const row = rowOf(line, table)
    if (row >= 0 && !rows.includes(row)) rows.push(row)
  }
  return rows
}

/** The field with the table's lines replaced by these rows; the player's own lines kept. */
export function withTableRows(text: string, table: StoryTable, rows: number[]): string {
  const own = linesOf(text).filter((line) => rowOf(line, table) < 0)
  // Nothing but blank lines left is no text of the player's.
  const kept = own.some((line) => line.trim() !== '') ? own : []
  return [...rows.map((row) => rowLine(table, row)), ...kept].join('\n')
}

/** Whether a field holds text of the player's: a line that is no row of these tables. */
export function hasOwnText(text: string, tables: readonly StoryTable[]): boolean {
  return linesOf(text).some(
    (line) => line.trim() !== '' && tables.every((table) => rowOf(line, table) < 0),
  )
}

/**
 * Whether the player's own text stands in for a table: its field is one of its
 * own (traits, ideals, bonds, flaws) and holds a line that is no row of the
 * field's tables. Prose in Allies or Backstory answers no table; several share it.
 */
export function ownTextFor(
  story: Pick<StoryState, StoryField>,
  table: StoryTable,
  tables: readonly StoryTable[],
): boolean {
  if (SHARED_FIELDS.has(table.field)) return false
  const same = tables.filter((t) => t.field === table.field)
  return hasOwnText(story[table.field], same)
}

/**
 * The tables still unset: no row taken from them, and no text of the player's in
 * their place. What "roll every table" rolls on.
 */
export function unsetTables(
  story: Pick<StoryState, StoryField>,
  tables: readonly StoryTable[],
): StoryTable[] {
  return tables.filter(
    (table) =>
      tableRows(story[table.field], table).length === 0 &&
      !ownTextFor(story, table, tables),
  )
}

/**
 * The story with rows taken from several tables at once, each table's lines in
 * its field, in the order the tables are given (for "roll every table").
 */
export function withStoryRows(
  story: StoryState,
  taken: readonly { table: StoryTable; rows: number[] }[],
): StoryState {
  const next = { ...story }
  // A table's lines go first in its field, so the last table written comes
  // first: writing them last to first leaves them in the order given.
  for (const { table, rows } of [...taken].reverse())
    next[table.field] = withTableRows(next[table.field], table, rows)
  return next
}
