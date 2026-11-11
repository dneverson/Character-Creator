// Search box and per-table controls. Multi-select uses a master checkbox in
// the grid's select-column header (not a toolbar button); per-column sorting and
// faceted filtering live in each column's own header menu (ColumnHeaderMenu), the
// way a spreadsheet puts them on the column, so the toolbar stays a thin,
// presentational strip with no selection or filter state of its own.

import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import { ColumnChooser } from './ColumnChooser'
import type { Column } from './types'

interface Props<T> {
  /** Leaves out the search box and the column chooser. */
  compact?: boolean
  searchable: boolean
  search: string
  onSearch: (query: string) => void
  searchPlaceholder?: string
  /** True when any column filter is active. */
  hasFilters: boolean
  /** Clears every column filter and the search box together. */
  onClearFilters: () => void
  /** Every column with its visibility, in order - drives the Columns chooser. */
  columnOrder: { column: Column<T>; visible: boolean }[]
  onToggleColumn: (key: string, visible: boolean) => void
  onReorderColumns: (order: string[]) => void
  onResetColumns: () => void
}

export function TableToolbar<T>({
  compact = false,
  searchable,
  search,
  onSearch,
  searchPlaceholder = 'Search…',
  hasFilters,
  onClearFilters,
  columnOrder,
  onToggleColumn,
  onReorderColumns,
  onResetColumns,
}: Props<T>) {
  const showClear = hasFilters || (!compact && search !== '')
  if (compact && !showClear) return null
  return (
    <div className="d-flex flex-wrap gap-2 mb-2 align-items-end">
      {searchable && !compact && (
        <Form.Control
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label="Search table"
          style={{ maxWidth: 240 }}
        />
      )}
      {showClear && (
        <Button type="button" variant="secondary" size="sm" onClick={onClearFilters}>
          Clear filters
        </Button>
      )}
      {!compact && (
        <div className="ms-auto">
          <ColumnChooser
            columnOrder={columnOrder}
            onToggle={onToggleColumn}
            onReorder={onReorderColumns}
            onReset={onResetColumns}
          />
        </div>
      )}
    </div>
  )
}
