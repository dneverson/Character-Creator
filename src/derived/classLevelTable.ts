// A class's level table as the books print it: one row per level, Level and
// Proficiency Bonus first, the class's own columns in the data's order, the
// features of the level, then the spell slots under their own heading. Built from
// the class data's `classTableGroups`, so every class and edition lays out alike.

import type { ClassTableGroup, ResolvedFeature } from '../data/class'
import { proficiencyBonus } from '../data/skills'
import type { Entry } from '../text/Entries'
import { stripTags } from '../text/tags'

/** What a cell shows when there is nothing to show, as the app shows an empty value elsewhere. */
export const EMPTY_CELL = '-'

/** The levels a class table runs over. */
export const TABLE_LEVELS = 20

export interface LevelTableColumn {
  label: string
  /** The heading over this column and its neighbours of the same group (spell slots). */
  group?: string
  /** True for the Proficiency Bonus column, whose heading is an acronym. */
  proficiency?: boolean
  /** True for the Features column, whose text is left-aligned. */
  features?: boolean
}

export interface LevelTableRow {
  level: number
  /** One text per column, the Level cell first. */
  cells: string[]
}

export interface LevelTableModel {
  columns: LevelTableColumn[]
  rows: LevelTableRow[]
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

/** The text of a table cell: a number, a tagged string, or a bonus/speed/dice object. */
export function cellText(cell: Entry | undefined): string {
  if (cell === undefined) return EMPTY_CELL
  // Zero is how the data says "none yet" (no sorcery points, no 5th-level slots).
  if (cell === 0) return EMPTY_CELL
  if (typeof cell === 'string' || typeof cell === 'number') {
    return stripTags(String(cell)).trim() || EMPTY_CELL
  }
  if (!isRecord(cell)) return EMPTY_CELL
  if (cell.type === 'bonus') return `+${String(cell.value)}`
  if (cell.type === 'bonusSpeed') return `+${String(cell.value)} ft.`
  if (cell.type === 'dice' && Array.isArray(cell.toRoll)) {
    const first: unknown = cell.toRoll[0]
    if (isRecord(first)) return `${String(first.number)}d${String(first.faces)}`
  }
  return EMPTY_CELL
}

/** The columns of a group, each with the text of its 20 cells. */
function groupColumns(
  group: ClassTableGroup,
): { column: LevelTableColumn; cells: string[] }[] {
  const slots = group.rows === undefined && group.rowsSpellProgression !== undefined
  const source = group.rows ?? group.rowsSpellProgression ?? []
  const labels = group.colLabels ?? []
  const columns = labels.map((label, c) => ({
    column: {
      label: stripTags(label),
      group: group.title ? stripTags(group.title) : undefined,
    },
    cells: Array.from({ length: TABLE_LEVELS }, (_, i) => cellText(source[i]?.[c])),
  }))
  // A slot level the class never reaches (no 6th-level slots for a Paladin) is left out.
  return slots
    ? columns.filter(({ cells }) => cells.some((cell) => cell !== EMPTY_CELL))
    : columns
}

/** The names of the features gained at a level, comma separated, or the empty cell. */
function featureText(features: Map<number, ResolvedFeature[]>, level: number): string {
  const names = (features.get(level) ?? []).map((f) => stripTags(f.name))
  return names.length > 0 ? names.join(', ') : EMPTY_CELL
}

/**
 * The table of a class (or of a subclass that casts): Level, Proficiency Bonus, the
 * untitled groups' columns, Features, then the titled groups ("Spell Slots per Spell
 * Level") with their heading over their columns.
 */
export function buildLevelTable(
  groups: ClassTableGroup[] | undefined,
  features: Map<number, ResolvedFeature[]>,
): LevelTableModel {
  const all = (groups ?? []).flatMap(groupColumns)
  const own = all.filter(({ column }) => column.group === undefined)
  const titled = all.filter(({ column }) => column.group !== undefined)
  const columns: LevelTableColumn[] = [
    { label: 'Level' },
    { label: 'Proficiency Bonus', proficiency: true },
    ...own.map(({ column }) => column),
    { label: 'Features', features: true },
    ...titled.map(({ column }) => column),
  ]
  const rows = Array.from({ length: TABLE_LEVELS }, (_, i): LevelTableRow => {
    const level = i + 1
    return {
      level,
      cells: [
        String(level),
        `+${proficiencyBonus(level)}`,
        ...own.map(({ cells }) => cells[i]),
        featureText(features, level),
        ...titled.map(({ cells }) => cells[i]),
      ],
    }
  })
  return { columns, rows }
}
