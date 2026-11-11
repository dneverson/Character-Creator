// The per-column header menu, modelled on a spreadsheet's column
// dropdown: Sort A→Z / Z→A, then a searchable checklist of the column's distinct
// values with a "(Select all)" master toggle and Apply/Cancel. Ticking all boxes
// is the same as no filter; unticking some hides those values. The checklist is
// built from the rows the OTHER columns' filters leave, so filtering one column
// narrows the choices offered by the next (spreadsheet-style stacking).
//
// The panel renders in a portal with fixed positioning so it overlays the grid
// instead of being clipped by the grid's own scroll container. One AbortController
// tears down the outside-click / Escape / scroll / resize listeners together, the
// same idiom the resizable split uses.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Badge from 'react-bootstrap/Badge'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import {
  filterOptions,
  isFilterable,
  rowsFilteredExcept,
  type FilterState,
} from './tableState'
import type { Column } from './types'

interface Props<T> {
  column: Column<T>
  columns: Column<T>[]
  /** The unfiltered rows; the checklist derives its values from these. */
  allRows: T[]
  filters: FilterState
  onFilter: (key: string, values: string[]) => void
  onSort: (key: string, dir: 'asc' | 'desc') => void
  /** The current sort direction when this column is the sorted one, else undefined. */
  activeSortDir: 'asc' | 'desc' | undefined
}

export function ColumnHeaderMenu<T>({
  column,
  columns,
  allRows,
  filters,
  onFilter,
  onSort,
  activeSortDir,
}: Props<T>) {
  const canSort = column.sortable !== false
  const canFilter = isFilterable(column)
  const label = typeof column.header === 'string' ? column.header : column.key

  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [query, setQuery] = useState('')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const toggleRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const options = useMemo(
    () =>
      canFilter
        ? filterOptions(rowsFilteredExcept(allRows, columns, filters, column.key), column)
        : [],
    [canFilter, allRows, columns, filters, column],
  )

  const selectedCount = filters[column.key]?.length ?? 0

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  const openMenu = useCallback(() => {
    // Seed the checklist: an empty/absent filter shows everything, so tick all.
    const current = filters[column.key]
    setChecked(new Set(current && current.length > 0 ? current : options))
    const rect = toggleRef.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom, left: rect.left })
    setOpen(true)
  }, [filters, column.key, options])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node
      if (!panelRef.current?.contains(target) && !toggleRef.current?.contains(target)) {
        close()
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    // Scrolling the value list stays inside the panel; scrolling anywhere else is
    // a click-out - dismiss and let that outside scroll proceed as normal.
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return
      close()
    }
    // A wheel over the panel must never scroll the page behind it. The list caps
    // its own chaining via overscroll-behavior; here we stop a wheel over the
    // panel's non-scrolling chrome from leaking out. (React's onWheel is passive,
    // so preventDefault needs a native, non-passive listener.)
    const onWheel = (e: WheelEvent) => {
      if (listRef.current?.contains(e.target as Node)) return
      e.preventDefault()
    }
    const { signal } = controller
    document.addEventListener('pointerdown', onPointer, { signal })
    document.addEventListener('keydown', onKey, { signal })
    window.addEventListener('scroll', onScroll, { capture: true, signal })
    window.addEventListener('resize', close, { signal })
    panelRef.current?.addEventListener('wheel', onWheel, { passive: false, signal })
    return () => controller.abort()
  }, [open, close])

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle === ''
      ? options
      : options.filter((o) => o.toLowerCase().includes(needle))
  }, [options, query])

  const allChecked = options.length > 0 && options.every((o) => checked.has(o))

  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(options))

  const toggleValue = (value: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })

  const apply = () => {
    // All ticked is stored as "no filter"; otherwise store the ticked subset in
    // the column's natural option order.
    onFilter(column.key, allChecked ? [] : options.filter((o) => checked.has(o)))
    close()
  }

  const sortAnd = (dir: 'asc' | 'desc') => {
    onSort(column.key, dir)
    close()
  }

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className={`btn btn-sm btn-link p-0 ms-1 dropdown-toggle text-decoration-none ${
          selectedCount > 0 ? 'text-primary' : 'text-body-secondary'
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label} filter menu`}
        onClick={() => (open ? close() : openMenu())}
      >
        {selectedCount > 0 && (
          <Badge bg="primary" pill className="align-middle">
            {selectedCount}
          </Badge>
        )}
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            aria-label={`${label} options`}
            className="data-table-headmenu card shadow"
            style={{ position: 'fixed', top: pos.top, left: pos.left }}
          >
            <div className="p-2">
              {canSort && (
                <div className="d-grid gap-1 mb-1">
                  <Button
                    type="button"
                    variant="light"
                    size="sm"
                    className="text-start"
                    active={activeSortDir === 'asc'}
                    onClick={() => sortAnd('asc')}
                  >
                    Sort A to Z
                  </Button>
                  <Button
                    type="button"
                    variant="light"
                    size="sm"
                    className="text-start"
                    active={activeSortDir === 'desc'}
                    onClick={() => sortAnd('desc')}
                  >
                    Sort Z to A
                  </Button>
                </div>
              )}
              {canSort && canFilter && <hr className="my-2" />}
              {canFilter && (
                <>
                  <Form.Control
                    type="search"
                    size="sm"
                    className="mb-2"
                    placeholder="Search values…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label={`Search ${label} values`}
                  />
                  <label className="data-table-headmenu__option fw-semibold mb-1">
                    <input
                      className="form-check-input mt-0 flex-shrink-0"
                      type="checkbox"
                      aria-label="Toggle all values"
                      checked={allChecked}
                      onChange={toggleAll}
                    />
                    <span>(Select all)</span>
                  </label>
                  <div
                    ref={listRef}
                    className="data-table-headmenu__list border rounded px-2 py-1"
                  >
                    {shown.length === 0 ? (
                      <div className="text-body-secondary small">No values</div>
                    ) : (
                      shown.map((value) => (
                        <label key={value} className="data-table-headmenu__option mb-1">
                          <input
                            className="form-check-input mt-0 flex-shrink-0"
                            type="checkbox"
                            aria-label={value}
                            checked={checked.has(value)}
                            onChange={() => toggleValue(value)}
                          />
                          <span>{value}</span>
                        </label>
                      ))
                    )}
                  </div>
                  <div className="d-flex justify-content-end gap-2 mt-2">
                    <Button type="button" variant="secondary" size="sm" onClick={close}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={apply}
                      disabled={checked.size === 0}
                    >
                      Apply
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
