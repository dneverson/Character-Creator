// A short table of spells the character has, each with where it comes from and how
// it is cast: the spells a species, feat or class option gives, and the character's
// whole list. The same stats as every spell table (spellFacts), drawn once more
// around a spell line instead of a bare spell.

import type { Spell } from '../../data/spells'
import { BrowseTable, type BrowseTableProps } from '../table/BrowseTable'
import { factColumn, type Describe, type Fact, type FactGroup } from '../table/facts'
import type { Column, DetailTarget } from '../table/types'
import {
  describeSpells,
  spellName,
  spellSearchText,
  spellSummaryColumns,
  spellTags,
} from './spellFacts'

/** One spell the character has, and what it owes to whatever gives it. */
export interface SpellLine {
  /** Unique in its table. */
  id: string
  spell: Spell
  /** What gives it: a class, a feat, a species. */
  from: string[]
  /** How it is cast: "At will", "1 per long rest", "Always prepared"; empty for a pick. */
  cast: string
  /** Why it cannot be used yet ("Unlocks at level 5"): the row is greyed. */
  locked?: string
  /** Taking it away; absent for what the character cannot remove. */
  remove?: () => void
}

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

const describeLines: Describe<SpellLine> = (lines) => [
  { key: 'source', title: 'On your character', facts: [fromFact, castFact] },
  ...describeSpells(lines.map((l) => l.spell)).map((group): FactGroup<SpellLine> => ({
    ...group,
    entryTitle: group.entryTitle && ofSpell(group.entryTitle),
    facts: group.facts.map(lineFact),
  })),
]

/** How it is cast and from what come right after the name: they are why the spell is here. */
const columns: Column<SpellLine>[] = (() => {
  const [name, ...stats] = spellSummaryColumns.map(lineColumn)
  return [name, factColumn(castFact), factColumn(fromFact), ...stats]
})()

export function SpellLines({
  tableId,
  lines,
  label,
  detailTarget,
  action,
}: {
  tableId: string
  lines: SpellLine[]
  label: string
  /** Where a row's full text opens, when not beside the table. */
  detailTarget?: DetailTarget
  /** The action column, when it is not the removal of a spell (the sheet's concentration). */
  action?: BrowseTableProps<SpellLine>['action']
}) {
  return (
    <BrowseTable<SpellLine>
      tableId={tableId}
      rows={lines}
      columns={columns}
      idOf={(line) => line.id}
      nameOf={(line) => spellName(line.spell)}
      tagsOf={(line) => spellTags(line.spell)}
      describe={describeLines}
      searchText={(line) => `${spellSearchText(line.spell)} ${line.from.join(' ')}`}
      rowMeta={(line) =>
        line.locked
          ? { standard: true, gated: { reason: line.locked } }
          : { standard: true }
      }
      action={
        action ??
        (lines.some((line) => line.remove)
          ? {
              key: 'remove',
              header: 'Remove',
              of: (line) =>
                line.remove
                  ? { label: 'Remove', variant: 'danger', run: line.remove }
                  : undefined,
            }
          : undefined)
      }
      compact
      tableShare={70}
      detailTarget={detailTarget}
      labels={{
        compare: 'Compare spells',
        search: 'Search spells…',
        table: label,
      }}
    />
  )
}
