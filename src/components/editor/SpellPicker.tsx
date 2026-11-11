// Choosing spells from the table of spells: the one chooser every spell pick goes
// through (a class's cantrips and spells, the spells a feat or species lets the
// player choose), so the columns, the limit, the compact table of picks and the
// switch for non-standard choices are the same everywhere.

import { useMemo } from 'react'
import type { Spell } from '../../data/spells'
import { PickMany, type PickManyLimit } from '../table/PickMany'
import type { RowMeta } from '../table/types'
import {
  describeSpells,
  grantedColumn,
  spellCantripColumns,
  spellCantripSummaryColumns,
  spellColumns,
  spellKey,
  spellName,
  spellSearchText,
  spellSummaryColumns,
  spellTags,
  withVersions,
} from './spellFacts'

type Meta = Omit<RowMeta, 'id'>

export interface SpellPickerProps {
  /** The spells to choose among. */
  rows: Spell[]
  picked: Spell[]
  /** Spells there whatever is picked, with a note on where each comes from. */
  fixed?: { spells: Spell[]; notes: Map<string, string> }
  /** Spells printed in both editions: each row says which version it is. */
  twins?: Set<string>
  /** What is chosen, plural ("Cleric cantrips"). */
  noun: string
  limit?: PickManyLimit
  /** Cantrips: the Level column, which always reads "Cantrip", starts hidden. */
  cantrips: boolean
  /** A row still to add. */
  rowMeta: (spell: Spell) => Meta
  /** A spell already chosen. */
  pickedRowMeta: (spell: Spell) => Meta
  onAdd: (spell: Spell) => void
  onRemove: (spell: Spell) => void
  aside?: string
  open: boolean
  onBrowsingChange: (browsing: boolean) => void
  allowNonStandard: boolean
  onAllowNonStandardChange: (allow: boolean) => void
  /** Accessible name of the tables. */
  label: string
}

export function SpellPicker({
  rows,
  picked,
  fixed,
  twins,
  noun,
  limit,
  cantrips,
  rowMeta,
  pickedRowMeta,
  onAdd,
  onRemove,
  aside,
  open,
  onBrowsingChange,
  allowNonStandard,
  onAllowNonStandardChange,
  label,
}: SpellPickerProps) {
  const granted = fixed !== undefined && fixed.spells.length > 0
  const notes = fixed?.notes
  const columns = useMemo(
    () => withVersions(cantrips ? spellCantripColumns : spellColumns, twins),
    [cantrips, twins],
  )
  const summary = useMemo(
    () =>
      withVersions(cantrips ? spellCantripSummaryColumns : spellSummaryColumns, twins),
    [cantrips, twins],
  )
  return (
    <PickMany<Spell>
      // The cantrip tier hides Level, and a layout is remembered per table.
      tableId={cantrips ? 'spell-reference-cantrips' : 'spell-reference'}
      rows={rows}
      columns={columns}
      idOf={spellKey}
      nameOf={spellName}
      tagsOf={spellTags}
      describe={describeSpells}
      searchText={spellSearchText}
      rowMeta={rowMeta}
      pickedRowMeta={pickedRowMeta}
      allowNonStandard={allowNonStandard}
      onAllowNonStandardChange={onAllowNonStandardChange}
      picked={picked}
      fixed={fixed?.spells}
      aside={aside}
      onAdd={onAdd}
      onRemove={onRemove}
      noun={noun}
      limit={limit}
      autoCloseAtLimit={limit !== undefined}
      summaryColumns={
        granted && notes
          ? [summary[0], grantedColumn(notes), ...summary.slice(1)]
          : summary
      }
      // A table with the Granted column keeps a layout of its own.
      summaryTableId={`${cantrips ? 'spell-picks-cantrips' : 'spell-picks'}${granted ? '-granted' : ''}`}
      tableShare={70}
      browsing={open}
      onBrowsingChange={onBrowsingChange}
      labels={{
        compare: 'Compare spells',
        search: 'Search spells, classes and text…',
        detailPlaceholder: 'Select a spell to see it in full.',
        table: label,
      }}
    />
  )
}
