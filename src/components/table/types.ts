// The contract for the shared master-detail data table.
// This module is deliberately dataset-agnostic: nothing here knows
// about classes, spells, or any D&D concept. Consumers describe their data with
// `Column<T>` + a `rowMeta` adapter and get identical table behaviour everywhere.

import type { ReactNode } from 'react'

/**
 * A single table column. `render` draws the cell; `sortValue`/`filterValue`
 * expose plain comparable data so sorting and faceted filtering never have to
 * parse rendered ReactNodes. Keep columns small and declarative so they are
 * cheap to add, reorder, or remove.
 */
export interface Column<T> {
  /** Stable identifier; also the sort/filter handle for this column. */
  key: string
  /** Header content. */
  header: ReactNode
  /** Cell content for a given row. */
  render: (row: T) => ReactNode
  /**
   * Whether this column's header offers a sort control. Defaults to `true`:
   * every column is sortable unless it opts out with `sortable: false`.
   */
  sortable?: boolean
  /**
   * Comparable value used when sorting by this column. Optional - when omitted,
   * the column sorts by the displayed text of its rendered cell. Provide it for
   * numeric ordering or to sort by something other than what is shown.
   */
  sortValue?: (row: T) => string | number
  /**
   * Whether this column offers a facet filter. Defaults to `true`: every column
   * is filterable unless it opts out with `filterable: false`. Column filters
   * stack - each active one further narrows the rows (they AND together).
   */
  filterable?: boolean
  /**
   * The facet value for a row (also populates the filter's option list).
   * Optional - when omitted, the displayed text of the rendered cell is used.
   * A cell that lists several things (the languages a race speaks) returns them
   * as an array: each is its own option, and the row passes when any is ticked.
   */
  filterValue?: (row: T) => string | string[]
  /**
   * Responsive weight: columns with a LOWER priority collapse first as the
   * viewport narrows. `0` (the default) means "never auto-hide".
   */
  priority?: number
  /**
   * Starts hidden: the column is offered in the column chooser but not shown
   * until the user turns it on. For the stats fewer people decide by, so a wide
   * dataset opens readable and nothing is left out.
   */
  defaultHidden?: boolean
  /** A button column rather than data: left out of the CSV export. */
  action?: boolean
  /** Extra className for this column's `<td>` cells. */
  className?: string
  /** Extra className for this column's `<th>` header. */
  headerClassName?: string
}

/**
 * Per-row metadata the table needs regardless of the dataset. The consumer's
 * `rowMeta` adapter produces this, which is how the standard/homebrew hook
 * and level-gating become first-class table features rather than per-consumer
 * bolt-ons.
 */
export interface RowMeta {
  /** Stable, unique row identity. */
  id: string
  /**
   * RAW-standard (true) vs homebrew / non-standard (false). A non-standard row is
   * greyed whether or not it can be selected, and sorts after the standard ones
   * when the table asks for `standardFirst`.
   */
  standard: boolean
  /** Why the row is non-standard; shown as the row's title and in its Rules cell. */
  reason?: string
  /**
   * When set, the row is visible but not selectable, and `reason` explains why
   * (e.g. a level-gated feature, an unmet prerequisite). Consistent with the
   * "inform, never hard-block" guardrail.
   */
  gated?: { reason: string }
}

/**
 * `single`/`multi` show a selection control per row; `none` is a read-only
 * browse table (no select column) where clicking a row only drives the detail
 * pane. Defaults to `single`.
 */
export type SelectionMode = 'single' | 'multi' | 'none'

/**
 * Detail-pane settings. The pane itself behaves the same everywhere: it is absent
 * (the table has the full width) until a row is clicked; clicking that row again,
 * the close button or Escape closes it.
 */
export interface DetailPaneOptions {
  /**
   * The table's share of the width, in percent, until the divider is dragged.
   * Defaults to a little over half; a table with many columns asks for more.
   */
  tableShare?: number
}

export interface DataTableProps<T> {
  /**
   * Stable id for this table, unique across the app. Keys the persisted column
   * layout (visibility / order / width) in localStorage, so every table
   * needs its own.
   */
  tableId: string
  /** The rows to display (already scoped by the consumer, e.g. by selected books). */
  rows: T[]
  /** Column definitions, left to right. */
  columns: Column<T>[]
  /** Maps a row to its table metadata (id / standard / gated). */
  rowMeta: (row: T) => RowMeta
  /** Single- or multi-select. Defaults to `single`. */
  selectionMode?: SelectionMode
  /**
   * What clicking a row's body does: `focus` (default) drives the detail pane
   * without changing selection; `select` toggles the row's selection (the
   * selection control still works and stays in sync) AND focuses the row, so a
   * selection-first table can still show a detail pane for the last-clicked row.
   */
  rowClick?: 'focus' | 'select'
  /** Controlled set of selected row ids. */
  selectedIds?: string[]
  /** Called with the next selected-id set when the user changes the selection. */
  onSelectionChange?: (ids: string[]) => void
  /** Flat text a row contributes to free-text search. Omit to disable search. */
  searchText?: (row: T) => string
  /** Renders the detail pane for the focused row (the master-detail "info" side). */
  renderDetail?: (row: T) => ReactNode
  /** Content kept above the table's own toolbar, so it travels with the table into full screen. */
  header?: ReactNode
  /**
   * Detail-pane settings. Only meaningful when `renderDetail` is set.
   */
  detail?: DetailPaneOptions
  /**
   * When false, non-standard rows are greyed and not selectable (the default);
   * when true, they become selectable (the per-section homebrew opt-in).
   * Defaults to true (no gating) so the base table is usable before C lands.
   */
  allowNonStandard?: boolean
  /**
   * When true, standard rows come before non-standard ones under any column sort
   * (the column sort orders each group). Defaults to false.
   */
  standardFirst?: boolean
  /**
   * A compact table of a few rows to read, not to hunt through: no search box and
   * no column chooser (a column filter still shows its Clear filters).
   */
  compact?: boolean
  /** Placeholder text for the search box. */
  searchPlaceholder?: string
  /** Shown when there are no rows (before or after filtering). */
  emptyLabel?: ReactNode
  /** Accessible label for the table element. */
  ariaLabel?: string
}
