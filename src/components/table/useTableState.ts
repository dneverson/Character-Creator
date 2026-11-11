// React state for the DataTable: view state (search / filter / sort), the
// focused row (which drives the detail pane), and selection. Selection is
// controlled when `onSelectionChange` is supplied and internal otherwise, so a
// consumer can either own the selection or let the table manage it. The heavy
// lifting (filter/search/sort) lives in the pure tableState module.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { processRows, toggleSort, type FilterState, type SortState } from './tableState'
import type { Column, RowMeta, SelectionMode } from './types'

export interface UseTableStateArgs<T> {
  rows: T[]
  columns: Column<T>[]
  rowMeta: (row: T) => RowMeta
  searchText?: (row: T) => string
  selectionMode: SelectionMode
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
  /** When false, non-standard rows are visible but not selectable. */
  allowNonStandard: boolean
  /** Standard rows come before non-standard ones under any sort. */
  standardFirst?: boolean
}

export interface TableState<T> {
  search: string
  setSearch: (query: string) => void
  filters: FilterState
  /** Sets a column's ticked values; an empty array clears that column's filter. */
  setFilter: (key: string, values: string[]) => void
  /** Whether any column filter is currently active. */
  hasFilters: boolean
  /** Clears every column filter at once. */
  clearFilters: () => void
  sort: SortState | null
  /** Toggles sort on a column (asc, then desc on a repeat click of the header). */
  onSort: (key: string) => void
  /** Sorts a column in an explicit direction (the header menu's Sort A→Z / Z→A). */
  sortBy: (key: string, dir: 'asc' | 'desc') => void
  visibleRows: T[]
  focusedId: string | null
  focusedRow: T | null
  focus: (id: string) => void
  /** Focuses a row, or clears the focus when that row is already focused (click-same-to-close). */
  toggleFocus: (id: string) => void
  /** Clears the focused row (drives closing the detail pane). */
  clearFocus: () => void
  selectedIds: string[]
  isSelected: (id: string) => boolean
  toggleSelect: (id: string) => void
  /**
   * Excel-style range select for `multi` mode: adds every selectable row between
   * the last-toggled anchor and `id` (in current visible order) to the selection.
   * Falls back to a plain toggle when there is no anchor or not in `multi` mode.
   */
  extendSelectionTo: (id: string) => void
  /** Adds every currently-visible selectable row to the selection. */
  selectAllVisible: () => void
  /** Clears the entire selection. */
  clearSelection: () => void
  metaOf: (row: T) => RowMeta
  /** Whether a row (via its metadata) can currently be selected. */
  selectable: (meta: RowMeta) => boolean
}

export function useTableState<T>({
  rows,
  columns,
  rowMeta,
  searchText,
  selectionMode,
  selectedIds,
  onSelectionChange,
  allowNonStandard,
  standardFirst = false,
}: UseTableStateArgs<T>): TableState<T> {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterState>({})
  const [sort, setSort] = useState<SortState | null>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [internalSelected, setInternalSelected] = useState<string[]>([])
  // The last row the user plainly toggled; the pivot a shift-click ranges from.
  const anchorId = useRef<string | null>(null)

  const controlled = onSelectionChange !== undefined
  // Memoized so the selection callbacks below don't re-create every render (the
  // `?? []` fallback would otherwise hand back a fresh array each time).
  const selection = useMemo(
    () => (controlled ? (selectedIds ?? []) : internalSelected),
    [controlled, selectedIds, internalSelected],
  )

  // Latest selection and change-callback held in refs so the selection mutators
  // below can read them without listing `selection` as a dependency. That keeps
  // their identities stable across selection changes, so the memoized rows in
  // TableGrid only re-render the one row that changed, not the whole grid. The
  // refs are synced in an effect (not during render): the mutators only read them
  // from event handlers, which run after the commit, so they always see the latest.
  const selectionRef = useRef(selection)
  const onSelectionChangeRef = useRef(onSelectionChange)
  useEffect(() => {
    selectionRef.current = selection
    onSelectionChangeRef.current = onSelectionChange
  })

  const setFilter = useCallback((key: string, values: string[]) => {
    setFilters((prev) => {
      const next = { ...prev }
      // No ticked values is the same as no filter, so drop the key entirely.
      if (values.length === 0) delete next[key]
      else next[key] = values
      return next
    })
  }, [])

  const clearFilters = useCallback(() => setFilters({}), [])

  const onSort = useCallback((key: string) => {
    setSort((prev) => toggleSort(prev, key))
  }, [])

  const sortBy = useCallback((key: string, dir: 'asc' | 'desc') => {
    setSort({ key, dir })
  }, [])

  const visibleRows = useMemo(
    () =>
      processRows(rows, columns, {
        filters,
        search,
        searchText,
        sort,
        rank: standardFirst ? (row) => (rowMeta(row).standard ? 0 : 1) : undefined,
      }),
    [rows, columns, filters, search, searchText, sort, standardFirst, rowMeta],
  )

  const focusedRow = useMemo(() => {
    if (focusedId === null) return null
    return rows.find((row) => rowMeta(row).id === focusedId) ?? null
  }, [rows, rowMeta, focusedId])

  const selectable = useCallback(
    (meta: RowMeta) => !meta.gated && (meta.standard || allowNonStandard),
    [allowNonStandard],
  )

  const commitSelection = useCallback((next: string[]) => {
    const onChange = onSelectionChangeRef.current
    if (onChange) onChange(next)
    else setInternalSelected(next)
  }, [])

  const toggleSelect = useCallback(
    (id: string) => {
      const row = rows.find((r) => rowMeta(r).id === id)
      if (!row || !selectable(rowMeta(row))) return
      anchorId.current = id
      const current = selectionRef.current
      if (selectionMode === 'single') {
        commitSelection(current.includes(id) ? [] : [id])
      } else {
        commitSelection(
          current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
        )
      }
    },
    [rows, rowMeta, selectable, selectionMode, commitSelection],
  )

  const extendSelectionTo = useCallback(
    (id: string) => {
      const anchor = anchorId.current
      if (selectionMode !== 'multi' || anchor === null) {
        toggleSelect(id)
        return
      }
      const ids = visibleRows.map((r) => rowMeta(r).id)
      const from = ids.indexOf(anchor)
      const to = ids.indexOf(id)
      if (from === -1 || to === -1) {
        toggleSelect(id)
        return
      }
      const [lo, hi] = from <= to ? [from, to] : [to, from]
      const range = visibleRows
        .slice(lo, hi + 1)
        .filter((r) => selectable(rowMeta(r)))
        .map((r) => rowMeta(r).id)
      // The anchor stays put so the user can grow or shrink the range with
      // further shift-clicks, matching a spreadsheet's behaviour.
      commitSelection([...new Set([...selectionRef.current, ...range])])
    },
    [selectionMode, visibleRows, rowMeta, selectable, commitSelection, toggleSelect],
  )

  const selectAllVisible = useCallback(() => {
    const visibleSelectable = visibleRows
      .filter((r) => selectable(rowMeta(r)))
      .map((r) => rowMeta(r).id)
    commitSelection([...new Set([...selectionRef.current, ...visibleSelectable])])
  }, [visibleRows, selectable, rowMeta, commitSelection])

  const clearSelection = useCallback(() => commitSelection([]), [commitSelection])

  // Membership as a Set so a row's `isSelected` check is O(1) rather than a
  // linear scan of the selection array on every row of every render.
  const selectedSet = useMemo(() => new Set(selection), [selection])
  const isSelected = useCallback((id: string) => selectedSet.has(id), [selectedSet])

  const toggleFocus = useCallback(
    (id: string) => setFocusedId((prev) => (prev === id ? null : id)),
    [],
  )

  const clearFocus = useCallback(() => setFocusedId(null), [])

  return {
    search,
    setSearch,
    filters,
    setFilter,
    hasFilters: Object.keys(filters).length > 0,
    clearFilters,
    sort,
    onSort,
    sortBy,
    visibleRows,
    focusedId,
    focusedRow,
    focus: setFocusedId,
    toggleFocus,
    clearFocus,
    selectedIds: selection,
    isSelected,
    toggleSelect,
    extendSelectionTo,
    selectAllVisible,
    clearSelection,
    metaOf: rowMeta,
    selectable,
  }
}
