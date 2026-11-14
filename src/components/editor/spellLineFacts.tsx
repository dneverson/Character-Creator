// How a spell line is described: where it comes from and how it is cast, then the facts of the
// spell itself (spellFacts). SpellLines draws the table from these, and the sheet's Favorites
// draw the same cells and the same text for a favorite spell.

import type { Spell } from '../../data/spells'
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

const ofSpell =
  <T,>(read: (spell: Spell) => T) =>
  (line: SpellLine) =>
    read(line.spell)

const lineColumn = (column: Column<Spell>): Column<SpellLine> => ({
  ...column,
  render: ofSpell(column.render),
  sortValue: column.sortValue && ofSpell(column.sortValue),
  filterValue: column.filterValue && ofSpell(column.filterValue),
})

const lineFact = (fact: Fact<Spell>): Fact<SpellLine> => ({
  ...fact,
  text: ofSpell(fact.text),
  render: fact.render && ofSpell(fact.render),
})

export const describeLines: Describe<SpellLine> = (lines) => [
  { key: 'source', title: 'On your character', facts: [fromFact, castFact] },
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
