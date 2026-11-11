// Pure, dataset-agnostic table logic: sorting, faceted filtering, and free-text
// search. Every function is pure and never mutates its inputs, so the state hook
// (useTableState) and the component stay thin. The only React touchpoint is
// `isValidElement`, used to read the displayed text out of a rendered cell when a
// column declares no explicit `sortValue` - this is what lets every column sort
// with zero per-consumer wiring.

import { isValidElement, type ReactNode } from 'react'
import type { Column } from './types'

/**
 * Best-effort plain-text of a rendered cell, used as the default sort key when a
 * column has no explicit `sortValue`. Walks strings, numbers, arrays, and an
 * element's children so a cell like `<Badge>PHB</Badge>` sorts by "PHB".
 */
export function nodeText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join('')
  if (isValidElement(node)) {
    return nodeText((node.props as { children?: ReactNode }).children)
  }
  return ''
}

/**
 * The comparable value used to sort by a column: its explicit `sortValue` when
 * given, otherwise the displayed text of its rendered cell. This is why sorting
 * is on for every column by default (see `Column.sortable`).
 */
export function sortValueOf<T>(column: Column<T>, row: T): string | number {
  return column.sortValue ? column.sortValue(row) : nodeText(column.render(row))
}

/** Whether a column offers a facet filter (on by default; opt out with false). */
export function isFilterable<T>(column: Column<T>): boolean {
  return column.filterable !== false
}

/**
 * The facet values used to filter by a column: its explicit `filterValue` when
 * given (one value, or several for a cell that lists things), otherwise the
 * displayed text of its rendered cell. This is why every column is filterable by
 * default (see `Column.filterable`).
 */
export function filterValuesOf<T>(column: Column<T>, row: T): string[] {
  const value = column.filterValue
    ? column.filterValue(row)
    : nodeText(column.render(row))
  return Array.isArray(value) ? value : [value]
}

export interface SortState {
  key: string
  dir: 'asc' | 'desc'
}

/**
 * Column key -> the set of values kept visible for that column (the ticked boxes
 * in the column's checklist). An absent key or an empty array means "no filter":
 * every value is shown, exactly as ticking all the boxes does in a spreadsheet.
 */
export type FilterState = Record<string, string[]>

/**
 * Next sort state after clicking a column: first click sorts ascending, a second
 * click on the same column flips to descending.
 */
export function toggleSort(current: SortState | null, key: string): SortState {
  if (current && current.key === key) {
    return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
  }
  return { key, dir: 'asc' }
}

/** Distinct, alphabetically sorted facet values for a filterable column. */
export function filterOptions<T>(rows: T[], column: Column<T>): string[] {
  if (!isFilterable(column)) return []
  const seen = new Set<string>()
  for (const row of rows) {
    for (const value of filterValuesOf(column, row)) if (value) seen.add(value)
  }
  return [...seen].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

/**
 * Keep only rows matching every active column filter. Within one column a row
 * passes if any of its values is one of that column's ticked values (OR); across columns
 * every active filter must pass (AND) - the spreadsheet-style stacking where each
 * column you filter further narrows the rows.
 */
export function applyFilters<T>(
  rows: T[],
  columns: Column<T>[],
  filters: FilterState,
): T[] {
  const byKey = new Map(columns.map((c) => [c.key, c]))
  const active = Object.entries(filters)
    .filter(([, values]) => values.length > 0)
    .map(([key, values]) => ({ column: byKey.get(key), allowed: new Set(values) }))
    // A column that opted out of filtering (or no longer exists) never constrains.
    .filter(
      (f): f is { column: Column<T>; allowed: Set<string> } =>
        f.column !== undefined && isFilterable(f.column),
    )
  if (active.length === 0) return rows
  return rows.filter((row) =>
    active.every(({ column, allowed }) =>
      filterValuesOf(column, row).some((value) => allowed.has(value)),
    ),
  )
}

/**
 * The rows a single column's facet list should be built from: everything filtered
 * by the OTHER columns' active filters, but not by this column's own. That is what
 * makes a column's options shrink as you filter its neighbours, while its own
 * already-ticked values stay available to untick.
 */
export function rowsFilteredExcept<T>(
  rows: T[],
  columns: Column<T>[],
  filters: FilterState,
  exceptKey: string,
): T[] {
  const rest: FilterState = {}
  for (const [key, values] of Object.entries(filters)) {
    if (key !== exceptKey) rest[key] = values
  }
  return applyFilters(rows, columns, rest)
}

/** Keep only rows whose search text contains the query (case-insensitive). */
export function applySearch<T>(
  rows: T[],
  query: string,
  searchText: (row: T) => string,
): T[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return rows
  return rows.filter((row) => searchText(row).toLowerCase().includes(needle))
}

/** Return a sorted copy of the rows for the given sort state (input untouched). */
export function applySort<T>(
  rows: T[],
  columns: Column<T>[],
  sort: SortState | null,
): T[] {
  if (!sort) return rows
  const column = columns.find((c) => c.key === sort.key)
  if (!column || column.sortable === false) return rows
  const sorted = [...rows].sort((a, b) => {
    const av = sortValueOf(column, a)
    const bv = sortValueOf(column, b)
    // Numbers compare numerically; anything else compares as natural text so
    // "10" sorts after "9" rather than lexicographically before it.
    return typeof av === 'number' && typeof bv === 'number'
      ? av - bv
      : String(av).localeCompare(String(bv), undefined, { numeric: true })
  })
  return sort.dir === 'desc' ? sorted.reverse() : sorted
}

/**
 * Full pipeline: filter, then search, then sort. Order matters only for cost
 * (cheap narrowing before the sort); the result set is the same either way.
 */
export function processRows<T>(
  rows: T[],
  columns: Column<T>[],
  opts: {
    filters: FilterState
    search: string
    searchText?: (row: T) => string
    sort: SortState | null
    /**
     * A stable first sort key: lower ranks come first, and rows of one rank keep
     * the order the column sort gave them.
     */
    rank?: (row: T) => number
  },
): T[] {
  let out = applyFilters(rows, columns, opts.filters)
  if (opts.searchText) out = applySearch(out, opts.search, opts.searchText)
  out = applySort(out, columns, opts.sort)
  const { rank } = opts
  // Array.prototype.sort is stable, so ranking after the column sort keeps its order.
  return rank ? [...out].sort((a, b) => rank(a) - rank(b)) : out
}
