// Choosing several entries out of many (the cantrips and spells of a class). The
// sibling of PickOne: until the player is done the browse table is open - every
// entry with its stats, a detail pane, side by side comparison - and it stays open
// while they pick, so adding four cantrips is four clicks. Once done, the table
// gives way to the picks themselves as a short table of the same stats, each with
// its Remove, so a made decision takes a few lines instead of a screen. Change
// brings the table back.
//
// A limit (cantrips known, spells prepared) is shown beside the count, in the
// warning colour with a Non-standard note when the picks go over it. The picker
// only reports it: whether a row may be added at the limit is the section's
// `rowMeta` (the reason shows in the row, and the switch lifts it).

import { useState, type ReactNode } from 'react'
import Badge from 'react-bootstrap/Badge'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import { NonStandardBadge } from '../NonStandardBadge'
import { BrowseTable, type BrowseTableProps, type RowAction } from './BrowseTable'
import { usePickerBrowsing, type PickerBrowsingProps } from './pickerBrowsing'
import type { Column, RowMeta } from './types'

export interface PickManyLimit {
  /** The most the rules allow. */
  max: number
  /** Why going over is non-standard, in the badge's tooltip. */
  reason?: string
}

export interface PickManyProps<T>
  extends Omit<BrowseTableProps<T>, 'action' | 'compact'>, PickerBrowsingProps {
  /** The entries chosen, in the order to list them. They need not be among the rows. */
  picked: T[]
  onAdd: (row: T) => void
  onRemove: (row: T) => void
  /** What is being chosen, plural, in lower case ("cantrips"): it heads the picks. */
  noun: string
  limit?: PickManyLimit
  /** The stat columns of the short table of picks. */
  summaryColumns: Column<T>[]
  /** Its id, for the remembered layout. Defaults to the table's own id and "-picks". */
  summaryTableId?: string
  /**
   * Whether a pick is a standard choice, in the short table of picks. Defaults to
   * `rowMeta`, which judges a row as one still to add (the limit, a repeat) and so
   * is not what a pick should be held to.
   */
  pickedRowMeta?: (row: T) => Omit<RowMeta, 'id'>
  /** The table shuts by itself when an add brings the picks exactly to the limit. */
  autoCloseAtLimit?: boolean
  /**
   * Entries that are there whatever the player picks (spells a feature always
   * gives). They head the short table with no Remove, and are not counted.
   */
  fixed?: T[]
  /** A short note after the count ("+4 always prepared"). */
  aside?: string
  /**
   * How many of a pick there are, for picks that can be had in number (a stack of
   * arrows). Given with `onQuantity`, the short table gains a quantity cell, and an
   * Add on a row already picked adds one more instead of turning into Remove. Left
   * out, a pick is one thing, as for spells.
   */
  quantityOf?: (row: T) => number
  /** The quantity changed to `n` (always 1 or more: bringing it to 0 is `onRemove`). */
  onQuantity?: (row: T, n: number) => void
  /** The button that brings the table back, when the picks are shown ("Change"). */
  changeLabel?: string
  /** What the picks still ask of the player. */
  children?: ReactNode
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** Minus, the number (typed or stepped) and plus. Reaching 0 takes the pick away. */
function QuantityCell({
  name,
  quantity,
  onChange,
}: {
  name: string
  quantity: number
  onChange: (n: number) => void
}) {
  // What is being typed, so the box can be emptied to type another number; it
  // gives way to the real quantity once the box is left.
  const [draft, setDraft] = useState<string>()
  return (
    <span className="d-inline-flex align-items-center gap-1">
      <Button
        size="sm"
        variant="secondary"
        aria-label={`One fewer ${name}`}
        onClick={() => {
          setDraft(undefined)
          onChange(quantity - 1)
        }}
      >
        -
      </Button>
      <Form.Control
        type="number"
        size="sm"
        min={0}
        value={draft ?? quantity}
        style={{ width: 70 }}
        onBlur={() => setDraft(undefined)}
        aria-label={`Quantity of ${name}`}
        onChange={(e) => {
          setDraft(e.target.value)
          const n = Math.floor(Number(e.target.value))
          if (e.target.value !== '' && Number.isFinite(n)) onChange(n)
        }}
      />
      <Button
        size="sm"
        variant="secondary"
        aria-label={`One more ${name}`}
        onClick={() => {
          setDraft(undefined)
          onChange(quantity + 1)
        }}
      >
        +
      </Button>
    </span>
  )
}

/** "Cantrips 3 of 4", in the warning colour with a note once over the limit. */
function CountBadge({
  noun,
  count,
  limit,
}: {
  noun: string
  count: number
  limit?: PickManyLimit
}) {
  const over = limit !== undefined && count > limit.max
  return (
    <span className="d-inline-flex align-items-center gap-1">
      <Badge bg={over ? 'warning' : 'secondary'} text={over ? 'dark' : undefined}>
        {capitalize(noun)} {count}
        {limit && ` of ${limit.max}`}
      </Badge>
      {over && <NonStandardBadge reason={limit.reason ?? `More ${noun} than allowed`} />}
    </span>
  )
}

export function PickMany<T>({
  picked,
  onAdd,
  onRemove,
  noun,
  limit,
  summaryColumns,
  summaryTableId,
  pickedRowMeta,
  autoCloseAtLimit = false,
  fixed = [],
  aside,
  quantityOf,
  onQuantity,
  changeLabel = 'Change',
  browsing,
  onBrowsingChange,
  children,
  ...table
}: PickManyProps<T>) {
  const { idOf, nameOf, rowMeta, allowNonStandard, onAllowNonStandardChange } = table
  const [ownAllow, setOwnAllow] = useState(false)
  const allow = allowNonStandard ?? ownAllow
  const setAllow = onAllowNonStandardChange ?? setOwnAllow
  // Open to begin with while nothing is chosen; then shut by Done or a full limit.
  const {
    browsing: open,
    setBrowsing,
    summary,
  } = usePickerBrowsing({
    browsing,
    onBrowsingChange,
    initiallyOpen: picked.length === 0,
  })
  const pickedIds = new Set(picked.map(idOf))
  const fixedIds = new Set(fixed.map(idOf))

  // Adding fills the limit exactly: the table has done its job.
  const add = (rows: T[]) => {
    const fresh = rows.filter((row) => !pickedIds.has(idOf(row)))
    rows.forEach((row) =>
      pickedIds.has(idOf(row)) && counted
        ? setQuantity(row, quantityOf(row) + 1)
        : onAdd(row),
    )
    if (autoCloseAtLimit && limit && picked.length + fresh.length === limit.max)
      setBrowsing(false)
  }
  // A quantity of 0 is no pick: it goes the way of Remove.
  const setQuantity = (row: T, n: number) =>
    n < 1 ? onRemove(row) : onQuantity?.(row, n)
  const counted = quantityOf !== undefined && onQuantity !== undefined
  const quantityColumn: Column<T>[] = counted
    ? [
        {
          key: 'quantity',
          header: 'Quantity',
          sortable: false,
          filterable: false,
          render: (row) =>
            fixedIds.has(idOf(row)) ? (
              quantityOf(row)
            ) : (
              <QuantityCell
                name={nameOf(row)}
                quantity={quantityOf(row)}
                onChange={(n) => setQuantity(row, n)}
              />
            ),
        },
      ]
    : []
  const countBadge = (
    <span className="d-inline-flex align-items-center gap-2">
      <CountBadge noun={noun} count={picked.length} limit={limit} />
      {aside && <span className="small text-body-secondary">{aside}</span>}
    </span>
  )

  if (open) {
    const actionOf = (row: T): RowAction =>
      pickedIds.has(idOf(row)) && counted
        ? {
            label: 'Add',
            detailLabel: `Add one more to ${noun}`,
            run: () => add([row]),
          }
        : pickedIds.has(idOf(row))
          ? {
              label: 'Remove',
              detailLabel: `Remove from ${noun}`,
              variant: 'danger',
              run: () => onRemove(row),
            }
          : { label: 'Add', detailLabel: `Add to ${noun}`, run: () => add([row]) }
    // What ticking rows and pressing the button would add: not already picked,
    // and standard unless the switch allows more.
    const addable = (selected: T[]) =>
      selected.filter(
        (row) =>
          (counted || !pickedIds.has(idOf(row))) &&
          (allow || rowMeta === undefined || rowMeta(row).standard),
      )
    return (
      <>
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
          {countBadge}
          <Button size="sm" variant="primary" onClick={() => setBrowsing(false)}>
            Done
          </Button>
        </div>
        <BrowseTable<T>
          {...table}
          allowNonStandard={allow}
          onAllowNonStandardChange={setAllow}
          action={{ key: 'choose', header: 'Choose', of: actionOf }}
          toolbar={(selected) => {
            const rows = addable(selected)
            return (
              <>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={rows.length === 0}
                  onClick={() => add(rows)}
                >
                  Add {rows.length} ticked
                </Button>
                {table.toolbar?.(selected)}
              </>
            )
          }}
        />
      </>
    )
  }

  if (picked.length === 0 && fixed.length === 0) {
    return (
      <div className="border rounded p-3 d-flex flex-wrap align-items-center gap-2">
        <span className="flex-grow-1">
          {limit && <span className="me-2">{countBadge}</span>}
          No {noun} chosen yet
        </span>
        <Button size="sm" variant="primary" onClick={() => setBrowsing(true)}>
          Choose {noun}
        </Button>
      </div>
    )
  }

  return (
    <div className="border rounded p-3" ref={summary}>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <span className="flex-grow-1">{countBadge}</span>
        <Button size="sm" variant="primary" onClick={() => setBrowsing(true)}>
          {changeLabel}
        </Button>
      </div>
      <BrowseTable<T>
        {...table}
        tableId={summaryTableId ?? `${table.tableId}-picks`}
        rows={[...fixed, ...picked.filter((row) => !fixedIds.has(idOf(row)))]}
        columns={[...quantityColumn, ...summaryColumns]}
        rowMeta={pickedRowMeta ?? rowMeta}
        compact
        action={{
          key: 'remove',
          header: 'Remove',
          of: (row) =>
            fixedIds.has(idOf(row))
              ? undefined
              : {
                  label: 'Remove',
                  detailLabel: `Remove from ${noun}`,
                  variant: 'danger',
                  run: () => onRemove(row),
                },
        }}
      />
      {children}
    </div>
  )
}
