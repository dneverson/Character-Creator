// How a spell line is described: where it comes from and how it is cast, then the facts of the
// spell itself (spellFacts). SpellLines draws the table from these, and the sheet's Favorites
// draw the same cells and the same text for a favorite spell.

import type { Spell } from '../../data/spells'
import { formatMod } from '../../dice/dice'
import { ChangedValue } from './ChangedValue'
import { factColumn, type Describe, type Fact, type FactGroup } from '../table/facts'
import type { Column } from '../table/types'
import type { SpellLine } from './SpellLines'
import { describeSpells, spellSummaryColumns } from './spellFacts'

const fromFact: Fact<SpellLine> = {
  key: 'from',
  label: 'From',
  text: (line) => line.from.join(', '),
}
const castFact: Fact<SpellLine> = {
  key: 'cast',
  label: 'How it is cast',
  text: (line) => [line.cast, line.locked].filter(Boolean).join('; '),
}

const effectsFact: Fact<SpellLine> = {
  key: 'effects',
  label: 'Your options',
  text: (line) =>
    (line.effects ?? [])
      .map(
        (l) =>
          `${l.label}: ${l.amount === undefined ? '' : `${formatMod(l.amount)} `}${l.how}`,
      )
      .join('; '),
}

type Changed = 'damage' | 'range'

/** The lines of the class options that change a value of the spell, applied ones only. */
export const changesOf = (line: SpellLine, on: Changed) =>
  (line.effects ?? []).filter((l) => l.on === on && l.status === 'applied')

const signed = (n: number) => `${n < 0 ? '-' : '+'} ${Math.abs(n)}`

/** What the class options add to the damage of the spell, in all. */
export const damageAddedBy = (line: SpellLine) =>
  changesOf(line, 'damage').reduce((n, l) => n + (l.amount ?? 0), 0)

/** The damage with what the options add: "1d10 + 4". Undefined when nothing is added. */
function changedDamage(line: SpellLine): string | undefined {
  const added = damageAddedBy(line)
  return line.spell.damage && added !== 0
    ? `${line.spell.damage} ${signed(added)}`
    : undefined
}

/** The range an option sets or lengthens: "300 ft.", "210 ft.". Undefined when none does. */
function changedRange(line: SpellLine): string | undefined {
  const lines = changesOf(line, 'range')
  const set = lines.find((l) => l.op === 'base')
  const added = lines.reduce((n, l) => (l.op === 'add' ? n + (l.amount ?? 0) : n), 0)
  const feet = /^(\d+) ft\.$/.exec(line.spell.range)
  if (set?.amount !== undefined) return `${set.amount + added} ft.`
  if (added === 0) return undefined
  return feet
    ? `${Number(feet[1]) + added} ft.`
    : `${line.spell.range} ${signed(added)} ft.`
}

const CHANGED: Record<Changed, (line: SpellLine) => string | undefined> = {
  damage: changedDamage,
  range: changedRange,
}

const ofSpell =
  <T,>(read: (spell: Spell) => T) =>
  (line: SpellLine) =>
    read(line.spell)

const lineColumn = (column: Column<Spell>): Column<SpellLine> => ({
  ...column,
  render: (line) => {
    const on = column.key === 'damage' || column.key === 'range' ? column.key : undefined
    const value = on && CHANGED[on](line)
    return on && value ? (
      <ChangedValue lines={changesOf(line, on)} value={value} />
    ) : (
      column.render(line.spell)
    )
  },
  sortValue: column.sortValue && ofSpell(column.sortValue),
  filterValue: column.filterValue && ofSpell(column.filterValue),
})

const lineFact = (fact: Fact<Spell>): Fact<SpellLine> => {
  const on = fact.key === 'damage' || fact.key === 'range' ? fact.key : undefined
  return {
    ...fact,
    text: (line) => (on && CHANGED[on](line)) || fact.text(line.spell),
    render: fact.render
      ? (line) => (on && CHANGED[on](line)) || fact.render?.(line.spell)
      : undefined,
  }
}

export const describeLines: Describe<SpellLine> = (lines) => [
  { key: 'source', title: 'On your character', facts: [fromFact, castFact, effectsFact] },
  ...describeSpells(lines.map((l) => l.spell)).map((group): FactGroup<SpellLine> => ({
    ...group,
    entryTitle: group.entryTitle && ofSpell(group.entryTitle),
    facts: group.facts.map(lineFact),
  })),
]

/** How it is cast and from what come right after the name: they are why the spell is here. */
export const spellLineColumns: Column<SpellLine>[] = (() => {
  const [name, ...stats] = spellSummaryColumns.map(lineColumn)
  return [name, factColumn(castFact), factColumn(fromFact), ...stats]
})()
