// The master grid: sortable headers, a row per item with face-value stats
//, single/multi selection, and standard/gated styling. A row-body
// click always focuses the row (driving the detail pane); in select mode it also
// toggles (or shift-extends) that row's selection, per `rowClick`. The per-row
// control always selects regardless. Each cell carries `data-priority` so the later mobile pass
// can collapse low-priority columns purely in CSS - the designed-in seam.

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import Table from 'react-bootstrap/Table'
import { ColumnHeaderMenu } from './ColumnHeaderMenu'
import { isFilterable, type FilterState, type SortState } from './tableState'
import type { Column, RowMeta, SelectionMode } from './types'

/**
 * The keyboard-navigable zones within a row, ordered left-to-right: the select
 * cell (the checkbox), the image (a cover the row renders with `data-nav-target`,
 * present per-row only), and the row body (drives the detail pane). Left/Right
 * move between the zones a row actually has; Up/Down move between rows keeping the
 * current zone (WAI-ARIA grid column persistence). The image zone's element is a
 * native button, so Enter/Space there open its own control (the lightbox) rather
 * than the grid acting.
 */
type NavZone = 'body' | 'select' | 'image'

/** Row zones in left-to-right order; the ones a given row has are filtered from this. */
const ZONE_ORDER: NavZone[] = ['select', 'image', 'body']

/**
 * Imperative handle the grid exposes to its coordinator (DataTable) so focus can
 * be handed back from the detail pane onto the row the cursor is on (Left from
 * the pane's first element, or Esc closing the pane).
 */
export interface GridHandle {
  /** Move real focus to the current cursor row's active element. */
  focusCursor: () => void
}

/** Smallest a column may be dragged to, in pixels. */
const MIN_COLUMN_WIDTH = 48
/** Pointer travel (px) before a header press becomes a reorder drag, not a click. */
const DRAG_THRESHOLD = 5
/** Colgroup key for the leading selection column. */
const SELECT_COL = '__select'

/**
 * Scroll a zone element into view inside the grid, keeping it clear of the frozen
 * header. `block: 'nearest'` alone aligns a row scrolled up to the top edge with
 * the scroll container's top - directly under the sticky header (painted over
 * it), so only the row's lower half shows when arrowing back up to the first row.
 * After the built-in scroll (which still handles bottom clipping), nudge the
 * content down by however much the header overlaps the element.
 *
 * The header's pinned edge must be read from a sticky `<th>` cell, not the
 * `<thead>`: only the cells carry `position: sticky`, so the thead element itself
 * flows (and scrolls) normally and its rect is the wrong, scrolled-away position.
 */
function scrollZoneIntoView(el: HTMLElement, grid: HTMLElement) {
  el.scrollIntoView({ block: 'nearest' })
  const headerCell = grid.querySelector('thead th')
  if (!headerCell) return
  const overlap =
    headerCell.getBoundingClientRect().bottom - el.getBoundingClientRect().top
  if (overlap > 0) grid.scrollTop -= overlap
}

interface Props<T> {
  /** The rows to display (already filtered/searched/sorted). */
  rows: T[]
  /** The unfiltered rows, so each header menu can build its full value list. */
  allRows: T[]
  columns: Column<T>[]
  metaOf: (row: T) => RowMeta
  selectable: (meta: RowMeta) => boolean
  selectionMode: SelectionMode
  rowClick: 'focus' | 'select'
  isSelected: (id: string) => boolean
  toggleSelect: (id: string) => void
  extendSelectionTo: (id: string) => void
  /** Selects every visible selectable row; drives the header master checkbox (multi only). */
  selectAllVisible: () => void
  /** Clears the entire selection; drives the header master checkbox (multi only). */
  clearSelection: () => void
  focusedId: string | null
  onFocus: (id: string) => void
  sort: SortState | null
  onSort: (key: string) => void
  sortBy: (key: string, dir: 'asc' | 'desc') => void
  filters: FilterState
  onFilter: (key: string, values: string[]) => void
  /** Per-column widths (empty = automatic layout); owned by the layout hook. */
  widths: Record<string, number>
  /** Commits a new width map (on resize) up to the persisted column layout. */
  onWidthsChange: (widths: Record<string, number>) => void
  /** Reorders columns from a header drag: move `moved` before `before` (null = end). */
  onReorderColumn: (moved: string, before: string | null) => void
  /**
   * Right past the last (body) zone crosses into the detail pane: opens it on
   * this row and hands focus to its first element. Absent when there is no pane.
   */
  onEnterDetail?: (id: string) => void
  /**
   * Left past the first (checkbox) zone closes an open detail pane, keeping the
   * keyboard cursor on the row. Absent when there is no closable pane.
   */
  onExitToClose?: () => void
  /** Receives the grid's imperative handle so the pane can return focus here. */
  apiRef?: React.MutableRefObject<GridHandle | null>
  emptyLabel?: React.ReactNode
  ariaLabel?: string
}

function sortIndicator(active: boolean, dir: 'asc' | 'desc' | undefined) {
  if (!active) return ''
  return dir === 'asc' ? ' (asc)' : ' (desc)'
}

interface TableRowProps<T> {
  row: T
  /** The row's stable identity (meta.id), passed flat so `memo` compares a string. */
  id: string
  /** meta.gated?.reason, if the row is gated - flattened so `memo` sees a primitive. */
  gatedReason: string | undefined
  /** meta.standard and, for a non-standard row, meta.reason - flat for the same reason. */
  standard: boolean
  nonStandardReason: string | undefined
  columns: Column<T>[]
  selectionMode: SelectionMode
  rowClick: 'focus' | 'select'
  showSelect: boolean
  canSelect: boolean
  selected: boolean
  focused: boolean
  /**
   * This row's keyboard cursor zone, or null when the cursor is on another row.
   * Passed as a flat value (not the whole cursor object) so only the two rows the
   * cursor moves between re-render, preserving the memoized-row perf win.
   */
  cursorZone: NavZone | null
  toggleSelect: (id: string) => void
  extendSelectionTo: (id: string) => void
  onFocus: (id: string) => void
  /** Syncs the keyboard cursor to a mouse click so arrow keys resume from there. */
  onCursor: (id: string, zone: NavZone) => void
}

// One grid row, memoized so a selection or focus change re-renders only the rows
// whose props actually changed - not the whole grid (and not the per-cell Abbr
// tooltips within it). This depends on every prop above being a primitive or a
// referentially stable value (the callbacks and `columns` are stable across a
// selection toggle; meta is passed flat as `id`/`gatedReason` so a fresh meta
// object per render doesn't defeat the memo).
function TableRowInner<T>({
  row,
  id,
  gatedReason,
  standard,
  nonStandardReason,
  columns,
  selectionMode,
  rowClick,
  showSelect,
  canSelect,
  selected,
  focused,
  cursorZone,
  toggleSelect,
  extendSelectionTo,
  onFocus,
  onCursor,
}: TableRowProps<T>) {
  const rowClass = [
    focused ? 'table-active' : '',
    cursorZone !== null ? 'data-table-grid__cursor' : '',
    !canSelect ? 'data-table-grid__gated' : '',
    // A non-standard row is greyed whether or not it can be selected.
    !canSelect || !standard ? 'text-body-secondary' : '',
    !standard ? 'data-table-grid__nonstandard' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <tr
      className={rowClass || undefined}
      // Roving tabindex: only the cursor row is tabbable (0), every other row is
      // -1, so the whole grid body is a single tab stop and the arrow keys move
      // focus within it. The row stays the tab stop while the cursor is on its
      // image zone too - that zone's button is focused programmatically (it is
      // itself tabIndex -1), so the row remains the grid's Tab re-entry anchor.
      tabIndex={cursorZone === 'body' || cursorZone === 'image' ? 0 : -1}
      // `data-nav-active` marks the exact element to focus (body zone → the row);
      // `data-nav-current` marks the cursor's row for any zone (the effect finds
      // the image button within it); `data-nav-rowid` lets the key handler probe a
      // specific row for an image zone before moving the cursor there.
      data-nav-active={cursorZone === 'body' ? true : undefined}
      data-nav-current={cursorZone !== null ? true : undefined}
      data-nav-rowid={id}
      onClick={(e) => {
        // In select mode a body click toggles (or shift-extends) selection; either
        // way it also focuses the row so the detail pane follows what was last
        // clicked. In focus mode it only focuses. The per-row control still selects.
        if (rowClick === 'select' && showSelect) {
          if (e.shiftKey) extendSelectionTo(id)
          else toggleSelect(id)
        }
        onCursor(id, 'body')
        onFocus(id)
      }}
      aria-selected={selected}
      title={gatedReason ?? nonStandardReason}
      style={{ cursor: 'pointer' }}
    >
      {showSelect && (
        <td
          className="data-table-grid__select align-middle p-0"
          tabIndex={cursorZone === 'select' ? 0 : -1}
          data-nav-active={cursorZone === 'select' ? true : undefined}
          aria-label="Select row"
          onClick={(e) => {
            e.stopPropagation()
            onCursor(id, 'select')
          }}
        >
          {/* The whole cell is the hit target: a full-size <label> forwards a click
              anywhere in the cell to its control (one native toggle, no double-fire),
              so the small checkbox is not the only clickable spot (accessibility). */}
          <label
            className="d-flex align-items-center justify-content-center w-100 h-100 m-0 px-2 py-2"
            style={{ cursor: canSelect ? 'pointer' : 'default' }}
          >
            <input
              className="form-check-input mt-0"
              type={selectionMode === 'multi' ? 'checkbox' : 'radio'}
              checked={selected}
              disabled={!canSelect}
              // Not a separate tab stop: the cell is the roving focus target and
              // Enter/Space on it toggle selection (handled at the grid level).
              tabIndex={-1}
              onChange={() => toggleSelect(id)}
              aria-label="Select row"
            />
          </label>
        </td>
      )}
      {columns.map((column) => (
        <td
          key={column.key}
          data-priority={column.priority ?? 0}
          className={column.className}
        >
          {column.render(row)}
        </td>
      ))}
    </tr>
  )
}

// `memo` erases the generic signature; the cast restores it while keeping the
// memoized runtime component (the standard idiom for a generic memo component).
const TableRow = memo(TableRowInner) as typeof TableRowInner

export function TableGrid<T>({
  rows,
  allRows,
  columns,
  metaOf,
  selectable,
  selectionMode,
  rowClick,
  isSelected,
  toggleSelect,
  extendSelectionTo,
  selectAllVisible,
  clearSelection,
  focusedId,
  onFocus,
  sort,
  onSort,
  sortBy,
  filters,
  onFilter,
  widths,
  onWidthsChange,
  onReorderColumn,
  onEnterDetail,
  onExitToClose,
  apiRef,
  emptyLabel = 'Nothing to show.',
  ariaLabel,
}: Props<T>) {
  const showSelect = selectionMode !== 'none'
  const colSpan = columns.length + (showSelect ? 1 : 0)

  // Keyboard navigation (roving tabindex). `cursor` is the last row/zone the user
  // moved to; it resolves to the first visible row when unset or stale (so Tab
  // always lands somewhere and a filter that drops the cursor row can't strand it).
  const gridRef = useRef<HTMLDivElement>(null)
  const [cursor, setCursor] = useState<{ rowId: string; zone: NavZone } | null>(null)
  // Set when a key moved the cursor, so the effect below moves real focus only for
  // keyboard navigation - never stealing focus on mount, filter, or selection.
  const focusPendingRef = useRef(false)

  const rowIds = rows.map((row) => metaOf(row).id)
  const cursorValid = cursor !== null && rowIds.includes(cursor.rowId)
  const activeRowId = cursorValid ? cursor.rowId : (rowIds[0] ?? null)
  const rawZone = cursor?.zone ?? 'body'
  // The select zone only exists when there is a select column; the image zone is
  // clamped per-row in the key handler (it depends on the DOM, which the render
  // can't see), and the focus effect falls back to the row body if it's absent.
  const activeZone: NavZone = !showSelect && rawZone === 'select' ? 'body' : rawZone

  const onCursor = useCallback((id: string, zone: NavZone) => {
    setCursor({ rowId: id, zone })
  }, [])

  // Whether a row currently renders an image zone (a `data-nav-target` element,
  // e.g. an enlargeable cover). Read from the DOM because whether a row has one is
  // the consumer's per-row concern (some books have no cover), invisible to the
  // generic grid. Only visible rows are queried, all of which are mounted.
  const rowHasImage = useCallback((rowId: string) => {
    const grid = gridRef.current
    if (!grid) return false
    const rowEl = grid.querySelector(`tbody tr[data-nav-rowid="${CSS.escape(rowId)}"]`)
    return rowEl?.querySelector('[data-nav-target]') != null
  }, [])

  // Move real DOM focus to the active zone's element after a keyboard move, which
  // also scrolls it into view inside the grid's own scroll area (`block: nearest`
  // so a row already on screen doesn't jump, and the page never scrolls).
  useEffect(() => {
    if (!focusPendingRef.current) return
    focusPendingRef.current = false
    const grid = gridRef.current
    if (!grid) return
    // The image zone's target is a button inside the cursor row (itself tabIndex
    // -1); every other zone marks its own element with `data-nav-active`. If the
    // cursor row turns out to have no image (e.g. Up/Down landed on a coverless
    // book), fall back to the row so focus is never stranded.
    let el: HTMLElement | null
    if (cursor?.zone === 'image') {
      const rowEl = grid.querySelector('tbody tr[data-nav-current="true"]')
      el =
        rowEl?.querySelector<HTMLElement>('[data-nav-target]') ??
        (rowEl as HTMLElement | null)
    } else {
      el = grid.querySelector<HTMLElement>('tbody [data-nav-active="true"]')
    }
    if (el) {
      el.focus({ preventScroll: true })
      scrollZoneIntoView(el, grid)
    }
  }, [cursor])

  // Move focus back to the current cursor row's element, used when the detail
  // pane hands control back (Left from its first element, or Esc). Prefers the
  // body's active element and falls back to the cursor row for a non-body zone.
  const focusCursor = useCallback(() => {
    const grid = gridRef.current
    if (!grid) return
    const el =
      grid.querySelector<HTMLElement>('tbody [data-nav-active="true"]') ??
      grid.querySelector<HTMLElement>('tbody tr[data-nav-current="true"]')
    if (el) {
      el.focus({ preventScroll: true })
      scrollZoneIntoView(el, grid)
    }
  }, [])

  // Publish the imperative handle to the coordinator while this grid is mounted.
  useEffect(() => {
    if (!apiRef) return
    apiRef.current = { focusCursor }
    return () => {
      apiRef.current = null
    }
  }, [apiRef, focusCursor])

  const onGridKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (rowIds.length === 0) return
      // A lightbox (or any portalled modal) is the active layer while open and owns
      // the keyboard itself (its own Enter/Esc close it). React routes a portal's
      // events through the component tree, not the DOM, so a modal opened from a
      // row's image zone bubbles its keydowns into this handler - guard here, as the
      // detail pane does, or closing the lightbox with Enter would also drive the
      // grid (e.g. open the detail pane) beneath it.
      if (document.querySelector('.modal.show')) return
      const index = activeRowId ? Math.max(0, rowIds.indexOf(activeRowId)) : 0
      const currentRow = rowIds[index]
      const move = (rowId: string, zone: NavZone) => {
        event.preventDefault()
        focusPendingRef.current = true
        setCursor({ rowId, zone })
      }
      // The zones a given row actually offers, left-to-right: select (when there
      // is a select column), image (when the row renders a `data-nav-target`), and
      // always the body. Left/Right step through this list; Up/Down keep the zone
      // when the destination row shares it and drop to the body otherwise.
      const zonesFor = (rowId: string): NavZone[] =>
        ZONE_ORDER.filter(
          (z) =>
            z === 'body' ||
            (z === 'select' && showSelect) ||
            (z === 'image' && rowHasImage(rowId)),
        )
      const zones = zonesFor(currentRow)
      // The rendered zone clamped to what the current row has (a stale image/select
      // zone collapses to the body).
      const zone: NavZone = zones.includes(activeZone) ? activeZone : 'body'
      switch (event.key) {
        case 'ArrowDown': {
          const next = rowIds[Math.min(rowIds.length - 1, index + 1)]
          move(next, zonesFor(next).includes(zone) ? zone : 'body')
          break
        }
        case 'ArrowUp': {
          const prev = rowIds[Math.max(0, index - 1)]
          move(prev, zonesFor(prev).includes(zone) ? zone : 'body')
          break
        }
        case 'ArrowLeft': {
          event.preventDefault()
          const zi = zones.indexOf(zone)
          // Left within the row steps to the previous zone; left past the first
          // (checkbox) zone closes an open detail pane, cursor staying put.
          if (zi > 0) move(currentRow, zones[zi - 1])
          else if (focusedId !== null) onExitToClose?.()
          break
        }
        case 'ArrowRight': {
          event.preventDefault()
          const zi = zones.indexOf(zone)
          // Right within the row steps to the next zone; right past the last
          // (body) zone crosses into the detail pane for this row.
          if (zi < zones.length - 1) move(currentRow, zones[zi + 1])
          else onEnterDetail?.(currentRow)
          break
        }
        case 'Enter':
          // The image zone's focused element is a native button (the lightbox
          // trigger); let it act on Enter itself rather than the grid intervening.
          if (zone === 'image') break
          event.preventDefault()
          if (zone === 'select') toggleSelect(currentRow)
          else onFocus(currentRow)
          break
        case ' ':
          // Space toggles the checkbox on the select zone and activates the image
          // button natively; on the row body it is a no-op we still swallow so a
          // focused row doesn't scroll the page.
          if (zone === 'image') break
          event.preventDefault()
          if (zone === 'select') toggleSelect(currentRow)
          break
        case 'Escape':
          // At the grid level Escape closes an open detail pane (a peer of Left
          // past the checkbox), keeping the cursor on the row; a second Escape,
          // with nothing left to close, then releases focus to the page. Escape
          // while focus is inside the pane is handled there (returns here first).
          if (focusedId !== null) {
            event.preventDefault()
            onExitToClose?.()
          } else {
            ;(document.activeElement as HTMLElement | null)?.blur()
          }
          break
        default:
          break
      }
    },
    [
      rowIds,
      activeRowId,
      activeZone,
      showSelect,
      rowHasImage,
      toggleSelect,
      onFocus,
      focusedId,
      onEnterDetail,
      onExitToClose,
    ],
  )

  // Master select-all lives in the header of the select column (multi only). Its
  // state is derived from the visible selectable rows: every one selected reads as
  // checked, none as unchecked, a partial selection as indeterminate. Toggling it
  // selects them all, or clears the whole selection when they are already all in.
  const selectableRows = rows.filter((row) => selectable(metaOf(row)))
  const selectedCount = selectableRows.filter((row) => isSelected(metaOf(row).id)).length
  const allSelected = selectableRows.length > 0 && selectedCount === selectableRows.length
  const someSelected = selectedCount > 0 && !allSelected

  // Widths are owned by the persisted column layout. An empty map means the table
  // still uses the browser's automatic layout (columns sized to content); the
  // first drag freezes every column at its current width and switches to a fixed
  // layout so the grid scrolls horizontally instead of squeezing.
  const hasWidths = Object.keys(widths).length > 0
  const theadRef = useRef<HTMLTableSectionElement>(null)
  const dragAbortRef = useRef<AbortController | null>(null)
  // The column currently being resized, so its edge shows a full-height guide
  // line for the whole drag (hover alone drops once the pointer leaves the cell).
  const [resizingKey, setResizingKey] = useState<string | null>(null)

  const seedWidths = useCallback((): Record<string, number> => {
    const seeded: Record<string, number> = {}
    theadRef.current
      ?.querySelectorAll<HTMLTableCellElement>('th[data-colkey]')
      .forEach((th) => {
        const key = th.dataset.colkey
        // getBoundingClientRect gives the exact fractional width; offsetWidth is
        // rounded up per cell, and summing those integers overshoots the table's
        // real width by a few pixels - enough to trip a phantom horizontal scroll.
        if (key) seeded[key] = th.getBoundingClientRect().width
      })
    return seeded
  }, [])

  const startResize = useCallback(
    (key: string, event: React.PointerEvent) => {
      // Don't let the drag also trigger the header's sort click.
      event.preventDefault()
      event.stopPropagation()
      // Snapshot the widths at drag start: an existing frozen map, or a fresh
      // measurement of every column so the others don't reflow. All moves below
      // are deltas from this snapshot, so no functional update is needed.
      const base = hasWidths ? widths : seedWidths()
      const startX = event.clientX
      const startWidth = base[key] ?? MIN_COLUMN_WIDTH
      onWidthsChange(base)
      setResizingKey(key)
      const controller = new AbortController()
      dragAbortRef.current?.abort()
      dragAbortRef.current = controller
      const onMove = (e: PointerEvent) => {
        const next = Math.max(MIN_COLUMN_WIDTH, startWidth + (e.clientX - startX))
        onWidthsChange({ ...base, [key]: next })
      }
      const stop = () => {
        dragAbortRef.current?.abort()
        dragAbortRef.current = null
        setResizingKey(null)
      }
      window.addEventListener('pointermove', onMove, { signal: controller.signal })
      window.addEventListener('pointerup', stop, { signal: controller.signal })
    },
    [hasWidths, widths, onWidthsChange, seedWidths],
  )

  // Header drag-to-reorder. A press only becomes a drag once the pointer
  // travels past DRAG_THRESHOLD, so ordinary header clicks (sort) still work.
  // `drag` drives the visual drop indicator; `moved`/`overKey`/`after` name the
  // dragged column, the column under the pointer, and which side of it we'd drop.
  const headerDragAbortRef = useRef<AbortController | null>(null)
  const [drag, setDrag] = useState<{
    moved: string
    overKey: string | null
    after: boolean
  } | null>(null)

  const startHeaderDrag = useCallback(
    (key: string, event: React.PointerEvent) => {
      const startX = event.clientX
      let dragging = false
      const controller = new AbortController()
      headerDragAbortRef.current?.abort()
      headerDragAbortRef.current = controller
      const onMove = (e: PointerEvent) => {
        if (!dragging) {
          if (Math.abs(e.clientX - startX) < DRAG_THRESHOLD) return
          dragging = true
        }
        const th = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest<HTMLTableCellElement>('th[data-colkey]')
        const overKey = th?.dataset.colkey ?? null
        if (!th || !overKey || overKey === SELECT_COL) {
          setDrag({ moved: key, overKey: null, after: false })
          return
        }
        const rect = th.getBoundingClientRect()
        setDrag({ moved: key, overKey, after: e.clientX > rect.left + rect.width / 2 })
      }
      const stop = () => {
        controller.abort()
        headerDragAbortRef.current = null
        if (dragging) {
          // A real drag happened: commit the move and swallow the click that
          // would otherwise fire on the header (and trigger its sort).
          window.addEventListener('click', (e) => e.stopPropagation(), {
            capture: true,
            once: true,
          })
          setDrag((current) => {
            if (current?.overKey && current.overKey !== current.moved) {
              const idx = columns.findIndex((c) => c.key === current.overKey)
              const before = current.after
                ? (columns[idx + 1]?.key ?? null)
                : current.overKey
              if (before !== current.moved) onReorderColumn(current.moved, before)
            }
            return null
          })
        } else {
          setDrag(null)
        }
      }
      window.addEventListener('pointermove', onMove, { signal: controller.signal })
      window.addEventListener('pointerup', stop, { signal: controller.signal })
    },
    [columns, onReorderColumn],
  )

  return (
    <div
      // Until a column is resized the browser sizes the columns to their content;
      // the modifier lets the stylesheet keep one long cell from taking the table.
      className={`table-responsive data-table-grid${hasWidths ? '' : ' data-table-grid--auto'}`}
      ref={gridRef}
      onKeyDown={onGridKeyDown}
    >
      <Table
        hover
        size="sm"
        className="mb-0 align-middle"
        aria-label={ariaLabel}
        // `max-content` lets the browser total the fixed column widths itself, so
        // the table is exactly as wide as its columns - no manual sum to overshoot
        // the container. The grid scrolls horizontally only when a column is
        // actually dragged wider than the available space.
        style={hasWidths ? { tableLayout: 'fixed', width: 'max-content' } : undefined}
      >
        {hasWidths && (
          <colgroup>
            {showSelect && <col style={{ width: widths[SELECT_COL] }} />}
            {columns.map((column) => (
              <col key={column.key} style={{ width: widths[column.key] }} />
            ))}
          </colgroup>
        )}
        <thead ref={theadRef}>
          <tr>
            {showSelect && (
              <th
                data-colkey={SELECT_COL}
                className="text-center align-middle"
                style={{ width: '2.5rem' }}
                aria-label="Select"
              >
                {selectionMode === 'multi' && (
                  <input
                    className="form-check-input mt-0"
                    type="checkbox"
                    aria-label="Select all rows"
                    checked={allSelected}
                    // indeterminate is a DOM property, not an attribute, so it is
                    // set imperatively via the input's ref.
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected
                    }}
                    disabled={selectableRows.length === 0}
                    onChange={() => (allSelected ? clearSelection() : selectAllVisible())}
                  />
                )}
              </th>
            )}
            {columns.map((column) => {
              const active = sort?.key === column.key
              const canSort = column.sortable !== false
              const canFilter = isFilterable(column)
              const label = typeof column.header === 'string' ? column.header : column.key
              const overThis = drag?.overKey === column.key
              const thClass = [
                'data-table-grid__th',
                drag?.moved === column.key ? 'data-table-grid__th--dragging' : '',
                overThis && !drag.after ? 'data-table-grid__th--dropbefore' : '',
                overThis && drag.after ? 'data-table-grid__th--dropafter' : '',
                column.headerClassName ?? '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <th
                  key={column.key}
                  data-colkey={column.key}
                  data-priority={column.priority ?? 0}
                  className={thClass}
                  onPointerDown={(e) => startHeaderDrag(column.key, e)}
                  aria-sort={
                    active
                      ? sort?.dir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  <div className="d-flex align-items-center gap-1">
                    {canSort ? (
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 text-decoration-none fw-semibold"
                        onClick={() => onSort(column.key)}
                      >
                        {column.header}
                        {sortIndicator(!!active, sort?.dir)}
                      </button>
                    ) : (
                      <span className="fw-semibold">{column.header}</span>
                    )}
                    {(canSort || canFilter) && (
                      <ColumnHeaderMenu
                        column={column}
                        columns={columns}
                        allRows={allRows}
                        filters={filters}
                        onFilter={onFilter}
                        onSort={sortBy}
                        activeSortDir={active ? sort?.dir : undefined}
                      />
                    )}
                  </div>
                  <span
                    className={
                      'data-table-grid__resizer' +
                      (resizingKey === column.key
                        ? ' data-table-grid__resizer--active'
                        : '')
                    }
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`Resize ${label} column`}
                    onPointerDown={(e) => startResize(column.key, e)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="text-body-secondary text-center py-4">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const meta = metaOf(row)
              return (
                <TableRow
                  key={meta.id}
                  row={row}
                  id={meta.id}
                  gatedReason={meta.gated?.reason}
                  standard={meta.standard}
                  nonStandardReason={meta.standard ? undefined : meta.reason}
                  columns={columns}
                  selectionMode={selectionMode}
                  rowClick={rowClick}
                  showSelect={showSelect}
                  canSelect={selectable(meta)}
                  selected={isSelected(meta.id)}
                  focused={meta.id === focusedId}
                  cursorZone={meta.id === activeRowId ? activeZone : null}
                  toggleSelect={toggleSelect}
                  extendSelectionTo={extendSelectionTo}
                  onFocus={onFocus}
                  onCursor={onCursor}
                />
              )
            })
          )}
        </tbody>
      </Table>
    </div>
  )
}
