// The shared master-detail data table. Composes the
// toolbar (search/filter), the sortable/selectable grid, and the detail pane
// inside a resizable split. Dataset-agnostic - everything specific to a dataset
// arrives through `columns`, `rowMeta`, `searchText`, and `renderDetail`.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Modal from 'react-bootstrap/Modal'
import { ResizableSplit } from './ResizableSplit'
import { DetailPane } from './DetailPane'
import { TableGrid, type GridHandle } from './TableGrid'
import { TableToolbar } from './TableToolbar'
import { focusables, firstInReadingOrder } from './spatialNav'
import { useColumnLayout } from './useColumnLayout'
import { useTableState } from './useTableState'
import type { DataTableProps } from './types'

export function DataTable<T>({
  tableId,
  rows,
  columns,
  rowMeta,
  selectionMode = 'single',
  selectedIds,
  onSelectionChange,
  rowClick = 'focus',
  searchText,
  renderDetail,
  header,
  detail: detailOptions,
  detailTarget,
  allowNonStandard = true,
  standardFirst,
  compact = false,
  searchPlaceholder,
  emptyLabel,
  ariaLabel,
}: DataTableProps<T>) {
  const state = useTableState({
    rows,
    columns,
    rowMeta,
    searchText,
    selectionMode,
    selectedIds,
    onSelectionChange,
    allowNonStandard,
    standardFirst,
  })

  const layout = useColumnLayout(tableId, columns)

  // Full screen moves this one table into a window; its state lives here, so
  // search, filters, sort, columns, picks and the open detail all carry over.
  const [fullScreen, setFullScreen] = useState(false)

  // Cross-pane keyboard bridge. The grid publishes a handle so the detail pane
  // can return focus to the cursor row; `enterSignal` is bumped only when the
  // grid hands off into the pane (never on a mouse click), so the effect below
  // focuses the pane's first element once the (possibly just-opened) content has
  // rendered - and never steals focus when the pane merely mounts on a click.
  const gridApiRef = useRef<GridHandle | null>(null)
  const paneRef = useRef<HTMLDivElement>(null)
  const [enterSignal, setEnterSignal] = useState(0)

  // Right past the grid body: force the pane open on this row (never toggle it
  // shut, unlike a re-click) and signal the effect to take focus into the pane.
  const handleEnterDetail = useCallback(
    (id: string) => {
      state.focus(id)
      setEnterSignal((n) => n + 1)
    },
    [state],
  )

  useEffect(() => {
    if (enterSignal === 0) return
    const pane = paneRef.current
    if (!pane) return
    firstInReadingOrder(focusables(pane))?.focus()
  }, [enterSignal])

  // The rows as the table shows them now: filtered and sorted, the visible columns in order.
  async function exportCsv() {
    const { rowsToCsv, downloadCsv, csvFileName } = await import('./csv')
    downloadCsv(
      rowsToCsv(
        state.visibleRows,
        layout.visibleColumns.filter((c) => !c.action),
      ),
      csvFileName(ariaLabel ?? tableId),
    )
  }

  // The detail goes to another pane (the sheet's): this table keeps none of its own.
  const inPane = renderDetail !== undefined && detailTarget === undefined
  const sendDetail =
    detailTarget && renderDetail
      ? (id: string) => {
          const row = rows.find((r) => rowMeta(r).id === id)
          if (row !== undefined) detailTarget.show(id, renderDetail(row))
        }
      : undefined

  const master = (
    <div>
      {header}
      <TableToolbar
        compact={compact}
        searchable={searchText !== undefined}
        search={state.search}
        onSearch={state.setSearch}
        searchPlaceholder={searchPlaceholder}
        hasFilters={state.hasFilters}
        onClearFilters={() => {
          state.clearFilters()
          state.setSearch('')
        }}
        columnOrder={layout.columnOrder}
        onToggleColumn={layout.setColumnVisible}
        onReorderColumns={layout.setOrder}
        onResetColumns={layout.reset}
        onExport={exportCsv}
        onFullScreen={fullScreen ? undefined : () => setFullScreen(true)}
      />
      <TableGrid
        rows={state.visibleRows}
        allRows={rows}
        columns={layout.visibleColumns}
        metaOf={state.metaOf}
        selectable={state.selectable}
        selectionMode={selectionMode}
        rowClick={rowClick}
        isSelected={state.isSelected}
        toggleSelect={state.toggleSelect}
        extendSelectionTo={state.extendSelectionTo}
        selectAllVisible={state.selectAllVisible}
        clearSelection={state.clearSelection}
        focusedId={detailTarget ? detailTarget.openId : state.focusedId}
        onFocus={sendDetail ?? state.toggleFocus}
        sort={state.sort}
        onSort={state.onSort}
        sortBy={state.sortBy}
        filters={state.filters}
        onFilter={state.setFilter}
        widths={layout.widths}
        onWidthsChange={layout.setWidths}
        onReorderColumn={layout.reorderColumn}
        onEnterDetail={inPane ? handleEnterDetail : undefined}
        onExitToClose={inPane ? state.clearFocus : undefined}
        apiRef={gridApiRef}
        emptyLabel={emptyLabel}
        ariaLabel={ariaLabel}
      />
    </div>
  )

  // No `renderDetail` means there is nothing to show in a detail pane, so the
  // grid takes the full width and the resizable split is skipped entirely.
  const inWindow = (view: ReactNode) =>
    fullScreen ? (
      <Modal
        show
        fullscreen
        onHide={() => setFullScreen(false)}
        // The column menus open outside the window and must keep the focus they are given.
        enforceFocus={false}
        // Escape closes an open detail pane first, and the window only when none is open.
        onEscapeKeyDown={(e) => {
          if (state.focusedRow === null) return
          e.preventDefault()
          state.clearFocus()
        }}
      >
        <Modal.Header closeButton>
          <Modal.Title>{ariaLabel ?? 'Table'}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="data-table-fullscreen">{view}</Modal.Body>
      </Modal>
    ) : (
      view
    )

  if (!inPane) return inWindow(master)

  // The pane is absent until a row is focused. The split still
  // mounts (so the grid stays full width via an absent detail rather than a
  // second tree shape); keeping the master in one DOM slot across the focus
  // toggle preserves its scroll position instead of remounting it to the top.
  const detailHidden = state.focusedRow === null

  const detail = detailHidden ? undefined : (
    <DetailPane
      focusedRow={state.focusedRow}
      render={renderDetail}
      onClose={state.clearFocus}
      onReturnToGrid={() => gridApiRef.current?.focusCursor()}
      containerRef={paneRef}
    />
  )

  return inWindow(
    <ResizableSplit
      master={master}
      detail={detail}
      initialMasterPct={detailOptions?.tableShare}
    />,
  )
}
