// Browsing a set of entries to choose from: the universal table with everything
// a chooser needs around it. Every stat is a column; a row's full description is
// in the detail pane; rows ticked in the table are laid side by side in the
// compare window; and each row carries the one action the section is for (choose
// it, add it, remove it), in the table and again in the detail pane.
//
// The detail pane and the compare window are both drawn from one description of
// the entries (see facts.ts), so a dataset says what an entry is once.

import { useMemo, useState, type ReactNode } from 'react'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import Stack from 'react-bootstrap/Stack'
import { NonStandardBadge } from '../NonStandardBadge'
import { RowActionButton } from './RowActionButton'
import { CompareModal } from './CompareModal'
import { DataTable } from './DataTable'
import { EntryDetail } from './EntryDetail'
import { useShowUnavailable } from './useShowUnavailable'
import type { Describe } from './facts'
import type { Column, RowMeta } from './types'

/** What can be done with a row. */
export interface RowAction {
  /** The button's label in the table ("Add"). */
  label: string
  /** The label in the detail pane, where there is room to say more ("Add to build"). */
  detailLabel?: string
  /** Defaults to the primary colour; `danger` for taking something away. */
  variant?: 'primary' | 'danger'
  run: () => void
}

export interface BrowseTableProps<T> {
  /** Stable id, unique across the app: the table's layout is remembered under it. */
  tableId: string
  rows: T[]
  /** The stat columns, left to right. The action column is placed before them. */
  columns: Column<T>[]
  idOf: (row: T) => string
  /** A row's name: heads its detail and its compare column. */
  nameOf: (row: T) => string
  /** Short tags shown with the name (the edition year). */
  tagsOf?: (row: T) => string[]
  describe: Describe<T>
  /** Flat text a row contributes to the search box. */
  searchText: (row: T) => string
  /** The action column, first in the table by default. */
  action?: {
    /** The column's key in the remembered layout. */
    key?: string
    header: string
    of: (row: T) => RowAction | undefined
  }
  /**
   * Whether a row is a standard choice, and why not when it is not (`reason`).
   * Given, the table gains a Rules column and a Rules fact in the detail and
   * compare window, greys and sorts last the non-standard rows, and, when some
   * row is non-standard, offers a switch to allow choosing them.
   */
  rowMeta?: (row: T) => Omit<RowMeta, 'id'>
  /**
   * Whether the switch is on: non-standard rows can then be chosen (the DM's call).
   * Controlled with `onAllowNonStandardChange`; otherwise the table keeps it,
   * off. Ticking rows to compare is never blocked either way.
   */
  allowNonStandard?: boolean
  onAllowNonStandardChange?: (allow: boolean) => void
  /** Further groups under a single entry's detail. */
  detailFooter?: (row: T) => ReactNode
  /**
   * The table's share of the width beside the detail pane, in percent, until the
   * divider is dragged. For a table with many columns.
   */
  tableShare?: number
  /**
   * A short table to read (a section's picks): no search box, no column chooser
   * and no switch for non-standard rows. Compare, the detail pane, sorting and
   * the column filters stay.
   */
  compact?: boolean
  /** Further controls beside Compare, given the rows ticked in the table. */
  toolbar?: (selected: T[]) => ReactNode
  labels: {
    /** Title of the compare window ("Compare races"). */
    compare: string
    /** Placeholder of the search box. */
    search: string
    /** Shown in the detail pane before a row is clicked. */
    /** Accessible name of the table. */
    table: string
  }
}

const STANDARD = { standard: true }

/** The label of the switch that allows choosing a non-standard row. */
const ALLOW_LABEL = 'Allow non-standard choices (DM approval)'
/** The label of the switch that lists the greyed rows that cannot be chosen. */
const SHOW_LABEL = 'Show choices that are not available'
const NON_STANDARD = 'Non-standard'
const reasonOf = (meta: Omit<RowMeta, 'id'>) => meta.reason ?? 'Not a standard choice'

export function BrowseTable<T>({
  tableId,
  rows: allRows,
  columns,
  idOf,
  nameOf,
  tagsOf,
  describe,
  searchText,
  action,
  rowMeta,
  allowNonStandard,
  onAllowNonStandardChange,
  detailFooter,
  tableShare,
  compact,
  toolbar,
  labels,
}: BrowseTableProps<T>) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [comparing, setComparing] = useState(false)
  const [ownAllow, setOwnAllow] = useState(false)
  const allow = allowNonStandard ?? ownAllow
  const setAllow = onAllowNonStandardChange ?? setOwnAllow

  const [showUnavailable, setShowUnavailable] = useShowUnavailable(tableId)

  const metaOf = (row: T) => rowMeta?.(row) ?? STANDARD
  const hasNonStandard =
    rowMeta !== undefined && allRows.some((row) => !metaOf(row).standard)
  // With the switch off the greyed rows are left out, but never one that can be taken
  // away (a pick the player made keeps its Remove).
  const hidden =
    hasNonStandard && !compact && !showUnavailable
      ? allRows.filter(
          (row) => !metaOf(row).standard && action?.of(row)?.variant !== 'danger',
        )
      : []
  const rows =
    hidden.length > 0 ? allRows.filter((row) => !hidden.includes(row)) : allRows
  // A non-standard row's action waits for the switch; taking something away never does.
  const canRun = (row: T, act: RowAction) =>
    act.variant === 'danger' || allow || metaOf(row).standard

  // Says in the detail pane and the compare window why a row is non-standard.
  const describeWithRules = useMemo<Describe<T>>(
    () =>
      rowMeta === undefined
        ? describe
        : (entries) => [
            {
              key: 'rules',
              title: 'Rules',
              facts: [
                {
                  key: 'non-standard',
                  label: NON_STANDARD,
                  text: (row) => {
                    const meta = rowMeta(row)
                    return meta.standard ? '' : reasonOf(meta)
                  },
                },
              ],
            },
            ...describe(entries),
          ],
    [describe, rowMeta],
  )

  // The ticked rows, in table order.
  const selected = useMemo(() => {
    const chosen = new Set(selectedIds)
    return rows.filter((row) => chosen.has(idOf(row)))
  }, [rows, selectedIds, idOf])

  // The action column leads (right after the tick box) so the section's one
  // action is the first thing in a row. Rebuilt each render so its cell always
  // sees the current choice (the layout is seeded once, so a fresh array
  // identity is harmless).
  const actionColumn: Column<T>[] = action
    ? [
        {
          key: action.key ?? 'action',
          action: true,
          className: 'data-table-grid__action',
          headerClassName: 'data-table-grid__action',
          header: action.header,
          render: (row) => {
            const act = action.of(row)
            if (!act) return null
            return (
              <RowActionButton
                label={act.label}
                kind={act.variant === 'danger' ? 'remove' : 'add'}
                variant={act.variant ?? 'primary'}
                disabled={!canRun(row, act)}
                onClick={act.run}
              />
            )
          },
        },
      ]
    : []
  // The Rules column is offered (sort, filter) but starts hidden: a non-standard
  // row says why in a badge beside its name instead. A compact table has no column
  // chooser to bring it back, so it has none.
  const rulesColumn: Column<T>[] =
    rowMeta && !compact
      ? [
          {
            key: 'rules',
            header: 'Rules',
            className: 'data-table-grid__rules',
            defaultHidden: true,
            render: (row) => {
              const meta = rowMeta(row)
              return meta.standard ? null : reasonOf(meta)
            },
            sortValue: (row) => (rowMeta(row).standard ? 0 : 1),
            filterValue: (row) => (rowMeta(row).standard ? 'Standard' : NON_STANDARD),
          },
        ]
      : []
  // The name cell carries the warning badge of a non-standard row, on a line under the name and tags.
  const [nameColumn] = columns
  const flaggedName: Column<T>[] =
    rowMeta && nameColumn
      ? [
          {
            ...nameColumn,
            render: (row) => {
              const meta = rowMeta(row)
              if (meta.standard) return nameColumn.render(row)
              const reason = reasonOf(meta)
              return (
                <>
                  {nameColumn.render(row)}
                  <div title={reason}>
                    <NonStandardBadge
                      reason={reason}
                      label={meta.reason ?? NON_STANDARD}
                    />
                  </div>
                </>
              )
            },
          },
        ]
      : columns.slice(0, 1)
  // Rules sits right after the name so the action and the name stay together.
  const allColumns = [
    ...actionColumn,
    ...flaggedName,
    ...rulesColumn,
    ...columns.slice(1),
  ]

  return (
    <>
      <DataTable<T>
        tableId={tableId}
        rows={rows}
        columns={allColumns}
        header={
          <Stack direction="horizontal" gap={2} className="mb-2">
            <Button
              size="sm"
              variant="primary"
              disabled={selected.length < 2}
              onClick={() => setComparing(true)}
            >
              Compare{selected.length > 0 ? ` (${selected.length})` : ''}
            </Button>
            {selected.length > 0 && (
              <Button size="sm" variant="secondary" onClick={() => setSelectedIds([])}>
                Clear selection
              </Button>
            )}
            {toolbar?.(selected)}
            {hasNonStandard && !compact && (
              <div className="ms-auto d-flex flex-wrap align-items-center column-gap-3">
                <Form.Check
                  type="switch"
                  id={`${tableId}-show-unavailable`}
                  label={SHOW_LABEL}
                  checked={showUnavailable}
                  onChange={(e) => setShowUnavailable(e.target.checked)}
                />
                {hidden.length > 0 && (
                  <span className="small text-body-secondary">
                    {hidden.length} hidden
                  </span>
                )}
                <Form.Check
                  type="switch"
                  id={`${tableId}-allow-non-standard`}
                  label={ALLOW_LABEL}
                  checked={allow}
                  onChange={(e) => setAllow(e.target.checked)}
                />
              </div>
            )}
          </Stack>
        }
        rowMeta={(row) => ({ id: idOf(row), ...metaOf(row) })}
        // Ticking a row to compare is never blocked; the switch gates the action.
        allowNonStandard
        standardFirst={rowMeta !== undefined}
        selectionMode="multi"
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        searchText={searchText}
        compact={compact}
        renderDetail={(row) => {
          const act = action?.of(row)
          return (
            <EntryDetail
              entry={row}
              describe={describeWithRules}
              name={nameOf(row)}
              tags={tagsOf?.(row)}
              action={
                act && (
                  <Button
                    size="sm"
                    variant={act.variant ?? 'primary'}
                    disabled={!canRun(row, act)}
                    onClick={act.run}
                  >
                    {act.detailLabel ?? act.label}
                  </Button>
                )
              }
            >
              {detailFooter?.(row)}
            </EntryDetail>
          )
        }}
        detail={{ tableShare }}
        searchPlaceholder={labels.search}
        ariaLabel={labels.table}
      />

      <CompareModal
        title={labels.compare}
        entries={selected}
        idOf={idOf}
        nameOf={nameOf}
        tagsOf={tagsOf}
        describe={describeWithRules}
        show={comparing}
        onHide={() => setComparing(false)}
      />
    </>
  )
}
