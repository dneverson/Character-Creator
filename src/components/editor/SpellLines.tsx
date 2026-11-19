// A short table of spells the character has, each with where it comes from and how
// it is cast: the spells a species, feat or class option gives, and the character's
// whole list. The same stats as every spell table (spellFacts), drawn once more
// around a spell line instead of a bare spell.

import { useMemo, type ReactNode } from 'react'
import type { Line } from '../../derived/types'
import type { Spell } from '../../data/spells'
import { BrowseTable, type BrowseTableProps } from '../table/BrowseTable'
import type { Column, DetailTarget } from '../table/types'
import { spellName, spellSearchText, spellTags } from './spellFacts'
import { describeLines, spellLineColumns } from './spellLineFacts'

/** One spell the character has, and what it owes to whatever gives it. */
export interface SpellLine {
  /** Unique in its table. */
  id: string
  spell: Spell
  /** What gives it: a class, a feat, a species. */
  from: string[]
  /** How it is cast: "At will", "1 per long rest", "Always prepared"; empty for a pick. */
  cast: string
  /** What the character's class options do to this spell (Agonizing Blast's damage). */
  effects?: Line[]
  /** Why it cannot be used yet ("Unlocks at level 5"): the row is greyed. */
  locked?: string
  /** Taking it away; absent for what the character cannot remove. */
  remove?: () => void
}

/** What makes a row of spells roll: the button over the row, and the one that opens the text. */
export interface RowCover {
  /** The button laid over the whole row. */
  button: ReactNode
  /** The icon button that opens the spell's full text, which a click on the row no longer does. */
  info: ReactNode
}

/** The name cell of a row that rolls carries the button over the row and the info button. */
function withCover(
  columns: Column<SpellLine>[],
  cover: ((line: SpellLine) => RowCover | undefined) | undefined,
): Column<SpellLine>[] {
  const [name, ...rest] = columns
  if (!cover || !name) return columns
  return [
    {
      ...name,
      render: (line) => {
        const found = cover(line)
        return found ? (
          <>
            {found.button}
            {found.info} {name.render(line)}
          </>
        ) : (
          name.render(line)
        )
      },
    },
    ...rest,
  ]
}

export function SpellLines({
  tableId,
  lines,
  label,
  detailTarget,
  action,
  pin,
  cover,
}: {
  tableId: string
  lines: SpellLine[]
  label: string
  /** Where a row's full text opens, when not beside the table. */
  detailTarget?: DetailTarget
  /** The action column, when it is not the removal of a spell (the sheet's concentration). */
  action?: BrowseTableProps<SpellLine>['action']
  /** The cell of the Favorites pin column, when the table has one. */
  pin?: BrowseTableProps<SpellLine>['pin']
  /**
   * A row that rolls: the button that lies over the whole row, and the info button that
   * still opens its full text. Undefined for a row that rolls nothing.
   */
  cover?: (line: SpellLine) => RowCover | undefined
}) {
  const columns = useMemo(() => withCover(spellLineColumns, cover), [cover])
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
          : { standard: true, ...(cover?.(line) && { rowClass: 'roll-host' }) }
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
      pin={pin}
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
