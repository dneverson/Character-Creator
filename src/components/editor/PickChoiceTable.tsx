// The options of a pick card as a browse table, for options the data describes:
// every option a row with what it is and does, a detail pane with its full text,
// side by side comparison, and the card's own Choose / Remove on each row. The
// player never needs a book to see how one option differs from another.

import { useMemo } from 'react'
import { plainText } from '../../data/itemRead'
import type { PickChip, PickChipDetail } from '../../character/picks'
import { Entries } from '../../text/Entries'
import { BrowseTable } from '../table/BrowseTable'
import type { Describe, Fact } from '../table/facts'
import { factColumn, NO_VALUE } from '../table/facts'
import type { Column } from '../table/types'

interface Props {
  /** The card's id, for the remembered layout of its table. */
  tableId: string
  /** Heading nouns: "fighting styles". */
  noun: string
  chips: PickChip[]
  /** Why a chip cannot be picked, in words; none when it can. */
  whyDisabled: (chip: PickChip) => string | undefined
  onPick: (chip: PickChip) => void
}

const detailOf = (chip: PickChip): PickChipDetail =>
  chip.detail ?? { facts: [], entries: [] }

const textOf = (chip: PickChip) => plainText(detailOf(chip).entries)
const factOf = (chip: PickChip, label: string) =>
  detailOf(chip).facts.find((f) => f.label === label)?.value ?? ''

/** How many lines of the rules text a table cell shows; the detail pane has all of it. */
const CLAMP = 3

function Clamped({ text }: { text: string }) {
  return (
    <div
      style={{
        display: '-webkit-box',
        WebkitLineClamp: CLAMP,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}
    >
      {text}
    </div>
  )
}

export function PickChoiceTable({ tableId, noun, chips, whyDisabled, onPick }: Props) {
  const labels = useMemo(
    () => [...new Set(chips.flatMap((c) => detailOf(c).facts.map((f) => f.label)))],
    [chips],
  )
  const facts = useMemo<Fact<PickChip>[]>(() => {
    const statusOf = (chip: PickChip) =>
      chip.state === 'picked' ? 'Chosen' : (whyDisabled(chip) ?? '')
    return [
      ...labels.map((label) => ({
        key: `fact-${label}`,
        label,
        text: (chip: PickChip) => factOf(chip, label),
      })),
      {
        key: 'status',
        label: 'Status',
        text: statusOf,
      },
    ]
  }, [labels, whyDisabled])

  const columns = useMemo<Column<PickChip>[]>(
    () => [
      {
        key: 'name',
        header: 'Name',
        render: (chip) => <strong>{chip.label}</strong>,
        sortValue: (chip) => chip.label,
        filterable: false,
      },
      {
        key: 'text',
        header: 'What it does',
        render: (chip) => <Clamped text={textOf(chip)} />,
        sortValue: textOf,
        filterable: false,
      },
      ...facts.map((f) =>
        factColumn(f, { render: (chip) => <Clamped text={f.text(chip) || NO_VALUE} /> }),
      ),
    ],
    [facts],
  )

  const describe = useMemo<Describe<PickChip>>(
    () => () => [
      { key: 'facts', title: 'Details', facts },
      {
        key: 'text',
        title: 'Text',
        facts: [
          {
            key: 'description',
            label: 'Description',
            text: (chip) => (detailOf(chip).entries.length > 0 ? textOf(chip) : ''),
            render: (chip) => <Entries entries={detailOf(chip).entries} />,
          },
        ],
      },
    ],
    [facts],
  )

  return (
    <BrowseTable<PickChip>
      tableId={tableId}
      rows={chips}
      columns={columns}
      idOf={(chip) => chip.value}
      nameOf={(chip) => chip.label}
      describe={describe}
      searchText={(chip) => `${chip.label} ${textOf(chip)}`}
      action={{
        key: 'choose',
        header: 'Choose',
        of: (chip) => {
          if (chip.state === 'picked')
            return {
              label: 'Remove',
              detailLabel: `Remove this from ${noun}`,
              variant: 'danger',
              run: () => onPick(chip),
            }
          if (chip.state !== 'available') return undefined
          return {
            label: 'Choose',
            detailLabel: `Choose this from ${noun}`,
            run: () => onPick(chip),
          }
        },
      }}
      labels={{
        compare: `Compare ${noun}`,
        search: `Search ${noun}`,
        table: `Pick ${noun}`,
      }}
    />
  )
}
