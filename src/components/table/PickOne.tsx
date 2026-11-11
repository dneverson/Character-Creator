// Choosing one entry out of many (a race, a background). Until something is
// chosen the browse table is open: every entry with its stats, a detail pane and
// side by side comparison. Once chosen, the table gives way to a summary of the
// choice with whatever it still asks of the player, so a made decision takes a
// few lines instead of a screen. Changing it brings the table back.
//
// The table is open or shut by the picker itself, or by its section when that
// passes `browsing` (several pickers on a page, only one table open at a time).

import { useState, type ReactNode } from 'react'
import Button from 'react-bootstrap/Button'
import { BrowseTable, type BrowseTableProps, type RowAction } from './BrowseTable'
import { EntryFacts, EntryHeading } from './EntryDetail'
import { factValue, type Fact } from './facts'
import { usePickerBrowsing, type PickerBrowsingProps } from './pickerBrowsing'

export interface PickOneProps<T>
  extends Omit<BrowseTableProps<T>, 'action'>, PickerBrowsingProps {
  /** The entry chosen, when it is among the rows. */
  picked: T | undefined
  onPick: (row: T) => void
  onClear: () => void
  /** What is being chosen, in lower case ("race"). */
  noun: string
  /** The facts shown at a glance once chosen. One with no value is left out. */
  summary?: Fact<T>[]
  /** What the choice still asks of the player (its own follow-up choices). */
  children?: ReactNode
}

export function PickOne<T>({
  picked,
  onPick,
  onClear,
  noun,
  summary = [],
  browsing,
  onBrowsingChange,
  children,
  ...table
}: PickOneProps<T>) {
  const { idOf, nameOf, tagsOf, describe } = table
  const [detailed, setDetailed] = useState(false)
  const pickedId = picked ? idOf(picked) : undefined
  // Open until something is chosen, and again while the choice is changed.
  const {
    browsing: open,
    setBrowsing,
    summary: card,
  } = usePickerBrowsing({ browsing, onBrowsingChange, openWhenIdle: !picked })

  if (open) {
    const actionOf = (row: T): RowAction =>
      idOf(row) === pickedId
        ? {
            label: 'Remove',
            detailLabel: `Remove this ${noun}`,
            variant: 'danger',
            run: () => {
              setBrowsing(false)
              onClear()
            },
          }
        : {
            label: 'Choose',
            detailLabel: `Choose this ${noun}`,
            run: () => {
              setBrowsing(false)
              onPick(row)
            },
          }
    return (
      <>
        {picked && (
          <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
            <span>
              Current {noun}: <strong>{nameOf(picked)}</strong>
            </span>
            <Button size="sm" variant="secondary" onClick={() => setBrowsing(false)}>
              Keep {nameOf(picked)}
            </Button>
          </div>
        )}
        <BrowseTable<T>
          {...table}
          action={{ key: 'choose', header: 'Choose', of: actionOf }}
        />
      </>
    )
  }

  if (!picked) {
    return (
      <div className="border rounded p-3 d-flex flex-wrap align-items-center gap-2">
        <span className="flex-grow-1">No {noun} chosen yet</span>
        <Button size="sm" variant="primary" onClick={() => setBrowsing(true)}>
          Choose {noun}
        </Button>
      </div>
    )
  }

  const glance = summary.flatMap((fact) => {
    const value = factValue(fact, picked)
    return value === null ? [] : [{ fact, value }]
  })

  return (
    <div className="border rounded p-3" ref={card}>
      <div className="d-flex flex-wrap align-items-center gap-2">
        <EntryHeading
          as="h3"
          name={nameOf(picked)}
          tags={tagsOf?.(picked) ?? []}
          className="flex-grow-1"
        />
        <Button
          size="sm"
          variant="secondary"
          aria-expanded={detailed}
          onClick={() => setDetailed((shown) => !shown)}
        >
          {detailed ? 'Hide details' : 'Show details'}
        </Button>
        <Button size="sm" variant="primary" onClick={() => setBrowsing(true)}>
          Change {noun}
        </Button>
      </div>

      {glance.length > 0 && (
        <dl className="d-flex flex-wrap column-gap-4 row-gap-1 small mt-2 mb-0">
          {glance.map(({ fact, value }) => (
            <div className="d-flex gap-1" key={fact.key}>
              <dt className="fw-normal text-body-secondary">{fact.label}:</dt>
              <dd className="fw-semibold mb-0">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {children}

      {detailed && (
        <div className="mt-3">
          <EntryFacts entry={picked} describe={describe} />
        </div>
      )}
    </div>
  )
}
