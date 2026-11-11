// React state for a table's column layout: visibility, order,
// and per-column widths, persisted per-table in localStorage. The pure logic lives
// in columnLayout.ts; this hook holds the state, reconciles a stored layout with
// the current column set, and coalesces rapid updates (a width drag) into one write.
//
// The column set is assumed static per table id (consumers pass a module-level
// `columns` const), so the layout is seeded once on mount and not re-reconciled if
// `columns` changes identity later.

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  defaultLayout,
  loadLayout,
  reconcileLayout,
  reorderKey,
  saveLayout,
  visibleKeys,
  type ColumnLayout,
} from './columnLayout'
import type { Column } from './types'

export interface ColumnLayoutState<T> {
  /** The columns to render, in the user's chosen order (hidden ones removed). */
  visibleColumns: Column<T>[]
  /** All columns with their current visibility, in order - drives the chooser. */
  columnOrder: { column: Column<T>; visible: boolean }[]
  /** Per-column widths for the grid (empty = the browser's automatic layout). */
  widths: Record<string, number>
  setWidths: (widths: Record<string, number>) => void
  setColumnVisible: (key: string, visible: boolean) => void
  setOrder: (order: string[]) => void
  /** Moves `moved` before `before` (or to the end when null) - header drag. */
  reorderColumn: (moved: string, before: string | null) => void
  /** Restores the declared columns, order, and auto widths. */
  reset: () => void
}

export function useColumnLayout<T>(
  tableId: string,
  columns: Column<T>[],
): ColumnLayoutState<T> {
  const keys = useMemo(() => columns.map((c) => c.key), [columns])
  const startHidden = useMemo(
    () => columns.filter((c) => c.defaultHidden).map((c) => c.key),
    [columns],
  )

  const [layout, setLayout] = useState<ColumnLayout>(() =>
    reconcileLayout(loadLayout(tableId) ?? defaultLayout(keys, startHidden), keys),
  )

  // Persist once changes settle. The timeout coalesces the burst of updates a
  // width drag produces into a single write instead of one per pointermove.
  useEffect(() => {
    const id = setTimeout(() => saveLayout(tableId, layout), 250)
    return () => clearTimeout(id)
  }, [tableId, layout])

  const setWidths = useCallback(
    (widths: Record<string, number>) => setLayout((prev) => ({ ...prev, widths })),
    [],
  )

  const setColumnVisible = useCallback((key: string, visible: boolean) => {
    setLayout((prev) => ({
      ...prev,
      hidden: visible
        ? prev.hidden.filter((k) => k !== key)
        : prev.hidden.includes(key)
          ? prev.hidden
          : [...prev.hidden, key],
    }))
  }, [])

  const setOrder = useCallback((order: string[]) => {
    setLayout((prev) => ({ ...prev, order }))
  }, [])

  const reorderColumn = useCallback((moved: string, before: string | null) => {
    setLayout((prev) => ({ ...prev, order: reorderKey(prev.order, moved, before) }))
  }, [])

  const reset = useCallback(
    () => setLayout(defaultLayout(keys, startHidden)),
    [keys, startHidden],
  )

  const byKey = useMemo(() => new Map(columns.map((c) => [c.key, c])), [columns])

  const visibleColumns = useMemo(
    () =>
      visibleKeys(layout)
        .map((k) => byKey.get(k))
        .filter((c): c is Column<T> => c != null),
    [byKey, layout],
  )

  const columnOrder = useMemo(() => {
    const hidden = new Set(layout.hidden)
    return layout.order
      .map((k) => byKey.get(k))
      .filter((c): c is Column<T> => c != null)
      .map((column) => ({ column, visible: !hidden.has(column.key) }))
  }, [byKey, layout])

  return {
    visibleColumns,
    columnOrder,
    widths: layout.widths,
    setWidths,
    setColumnVisible,
    setOrder,
    reorderColumn,
    reset,
  }
}
