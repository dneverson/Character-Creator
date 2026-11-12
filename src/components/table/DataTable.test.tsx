import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DataTable } from './DataTable'
import type { Column } from './types'

// A dataset-agnostic fixture - the table knows nothing about D&D, so the test
// uses a small "spell" shape to exercise search, filter, sort, selection, the
// focus→detail flow, and gated/non-standard rows.
interface Spell {
  id: string
  name: string
  school: string
  level: number
  homebrew?: boolean
  locked?: string
}

const SPELLS: Spell[] = [
  { id: 'fireball', name: 'Fireball', school: 'Evocation', level: 3 },
  { id: 'bless', name: 'Bless', school: 'Enchantment', level: 1 },
  { id: 'counterspell', name: 'Counterspell', school: 'Abjuration', level: 3 },
  {
    id: 'aid',
    name: 'Aid',
    school: 'Abjuration',
    level: 2,
    locked: 'Learned at level 5',
  },
  {
    id: 'homebrew-bolt',
    name: 'Custom Bolt',
    school: 'Evocation',
    level: 1,
    homebrew: true,
  },
]

const columns: Column<Spell>[] = [
  {
    key: 'name',
    header: 'Name',
    render: (s) => <span data-testid="name-cell">{s.name}</span>,
    sortable: true,
    sortValue: (s) => s.name,
  },
  {
    key: 'school',
    header: 'School',
    render: (s) => s.school,
    filterable: true,
    filterValue: (s) => s.school,
  },
  {
    key: 'level',
    header: 'Level',
    render: (s) => s.level,
    sortable: true,
    sortValue: (s) => s.level,
  },
]

const rowMeta = (s: Spell) => ({
  id: s.id,
  standard: !s.homebrew,
  gated: s.locked ? { reason: s.locked } : undefined,
})

function renderTable(props: Partial<Parameters<typeof DataTable<Spell>>[0]> = {}) {
  return render(
    <DataTable<Spell>
      tableId="spells"
      rows={SPELLS}
      columns={columns}
      rowMeta={rowMeta}
      searchText={(s) => `${s.name} ${s.school}`}
      renderDetail={(s) => <div>Detail for {s.name}</div>}
      ariaLabel="Spells"
      {...props}
    />,
  )
}

function visibleNames() {
  return screen.getAllByTestId('name-cell').map((el) => el.textContent)
}

describe('DataTable', () => {
  // Each test starts from a clean persisted layout so a resize or column change
  // in one test can't leak into the next through localStorage.
  beforeEach(() => localStorage.clear())

  it('renders every row by default', () => {
    renderTable()
    expect(visibleNames()).toEqual([
      'Fireball',
      'Bless',
      'Counterspell',
      'Aid',
      'Custom Bolt',
    ])
  })

  it('filters rows by free-text search', async () => {
    const user = userEvent.setup()
    renderTable()
    await user.type(screen.getByLabelText('Search table'), 'bless')
    expect(visibleNames()).toEqual(['Bless'])
  })

  // Drive a column's header menu the way a user does: open it, untick "(Select
  // all)", tick the wanted values, then Apply.
  async function filterColumn(
    user: ReturnType<typeof userEvent.setup>,
    columnLabel: string,
    values: string[],
  ) {
    await user.click(screen.getByRole('button', { name: `${columnLabel} filter menu` }))
    await user.click(screen.getByRole('checkbox', { name: 'Toggle all values' }))
    for (const value of values) {
      await user.click(screen.getByRole('checkbox', { name: value }))
    }
    await user.click(screen.getByRole('button', { name: 'Apply' }))
  }

  it('filters rows by a column facet', async () => {
    const user = userEvent.setup()
    renderTable()
    await filterColumn(user, 'School', ['Abjuration'])
    expect(visibleNames()).toEqual(['Counterspell', 'Aid'])
  })

  it('stacks column filters, each further narrowing the rows', async () => {
    const user = userEvent.setup()
    renderTable()
    // Every column is filterable by default, including Level (no filterValue).
    await filterColumn(user, 'School', ['Evocation'])
    expect(visibleNames()).toEqual(['Fireball', 'Custom Bolt'])
    await filterColumn(user, 'Level', ['1'])
    expect(visibleNames()).toEqual(['Custom Bolt'])
  })

  it('Clear filters appears only while a filter is active and resets every column', async () => {
    const user = userEvent.setup()
    renderTable()
    expect(
      screen.queryByRole('button', { name: 'Clear filters' }),
    ).not.toBeInTheDocument()
    await filterColumn(user, 'School', ['Abjuration'])
    expect(visibleNames()).toEqual(['Counterspell', 'Aid'])
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(visibleNames()).toEqual([
      'Fireball',
      'Bless',
      'Counterspell',
      'Aid',
      'Custom Bolt',
    ])
    expect(
      screen.queryByRole('button', { name: 'Clear filters' }),
    ).not.toBeInTheDocument()
  })

  it('gives each column header a resize handle', () => {
    renderTable()
    expect(
      screen.getByRole('separator', { name: 'Resize Name column' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('separator', { name: 'Resize School column' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('separator', { name: 'Resize Level column' }),
    ).toBeInTheDocument()
  })

  it('sorts by a sortable column and toggles direction', async () => {
    const user = userEvent.setup()
    renderTable()
    const nameHeader = screen.getByRole('button', { name: 'Name' })
    await user.click(nameHeader)
    expect(visibleNames()).toEqual([
      'Aid',
      'Bless',
      'Counterspell',
      'Custom Bolt',
      'Fireball',
    ])
    await user.click(nameHeader)
    expect(visibleNames()).toEqual([
      'Fireball',
      'Custom Bolt',
      'Counterspell',
      'Bless',
      'Aid',
    ])
  })

  it('sorts a column that declares no sortValue by its displayed text', async () => {
    const user = userEvent.setup()
    renderTable()
    // School has no sortValue and was never marked sortable, yet it sorts.
    await user.click(screen.getByRole('button', { name: 'School' }))
    expect(visibleNames()).toEqual([
      'Counterspell',
      'Aid',
      'Bless',
      'Fireball',
      'Custom Bolt',
    ])
  })

  it('keeps the detail pane absent until a row is focused', async () => {
    const user = userEvent.setup()
    renderTable()
    // No pane, and therefore no placeholder, before anything is focused.
    expect(screen.queryByText('Select a row to see its details.')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('separator', { name: 'Resize panes' }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByText('Fireball'))
    expect(screen.getByText('Detail for Fireball')).toBeInTheDocument()
  })

  it('closes the pane when the focused row is clicked again', async () => {
    const user = userEvent.setup()
    renderTable()
    await user.click(screen.getByText('Fireball'))
    expect(screen.getByText('Detail for Fireball')).toBeInTheDocument()
    await user.click(screen.getByText('Fireball'))
    expect(screen.queryByText('Detail for Fireball')).not.toBeInTheDocument()
  })

  it('switches to a different row without closing', async () => {
    const user = userEvent.setup()
    renderTable()
    await user.click(screen.getByText('Fireball'))
    await user.click(screen.getByText('Bless'))
    expect(screen.queryByText('Detail for Fireball')).not.toBeInTheDocument()
    expect(screen.getByText('Detail for Bless')).toBeInTheDocument()
  })

  it('closes the pane via the close button', async () => {
    const user = userEvent.setup()
    renderTable()
    await user.click(screen.getByText('Fireball'))
    expect(screen.getByText('Detail for Fireball')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close details' }))
    expect(screen.queryByText('Detail for Fireball')).not.toBeInTheDocument()
  })

  it('closes the pane via the Escape key and returns focus to the row', async () => {
    const user = userEvent.setup()
    renderTable()
    await user.click(screen.getByText('Fireball'))
    expect(screen.getByText('Detail for Fireball')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByText('Detail for Fireball')).not.toBeInTheDocument()
  })

  it('returns focus to the row when Escape is pressed inside the pane', async () => {
    const user = userEvent.setup()
    renderTable({ renderDetail: (s) => <button>Act on {s.name}</button> })
    await user.click(screen.getByText('Fireball'))
    screen.getByRole('button', { name: 'Act on Fireball' }).focus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('button', { name: 'Act on Fireball' })).toBeNull()
    expect(screen.getByText('Fireball').closest('tr')).toHaveFocus()
  })

  it('single-select replaces the selection', async () => {
    const user = userEvent.setup()
    const onSelectionChange = vi.fn()
    renderTable({ selectionMode: 'single', selectedIds: [], onSelectionChange })
    const radios = screen.getAllByRole('radio')
    await user.click(radios[0])
    expect(onSelectionChange).toHaveBeenLastCalledWith(['fireball'])
  })

  it('multi-select accumulates the selection', async () => {
    const user = userEvent.setup()
    let selected: string[] = []
    const onSelectionChange = vi.fn((ids: string[]) => {
      selected = ids
    })
    const { rerender } = renderTable({
      selectionMode: 'multi',
      selectedIds: selected,
      onSelectionChange,
    })
    // Scope to the per-row boxes; index 0 is now the header's master checkbox.
    const boxes = screen.getAllByRole('checkbox', { name: 'Select row' })
    await user.click(boxes[0])
    expect(onSelectionChange).toHaveBeenLastCalledWith(['fireball'])
    rerender(
      <DataTable<Spell>
        tableId="spells"
        rows={SPELLS}
        columns={columns}
        rowMeta={rowMeta}
        selectionMode="multi"
        selectedIds={selected}
        onSelectionChange={onSelectionChange}
        searchText={(s) => `${s.name} ${s.school}`}
        renderDetail={(s) => <div>Detail for {s.name}</div>}
        ariaLabel="Spells"
      />,
    )
    await user.click(screen.getAllByRole('checkbox', { name: 'Select row' })[1])
    expect(onSelectionChange).toHaveBeenLastCalledWith(['fireball', 'bless'])
  })

  it('toggles selection on row-body click when rowClick is "select"', async () => {
    const user = userEvent.setup()
    let selected: string[] = []
    const onSelectionChange = vi.fn((ids: string[]) => {
      selected = ids
    })
    renderTable({
      selectionMode: 'multi',
      rowClick: 'select',
      selectedIds: selected,
      onSelectionChange,
    })
    await user.click(screen.getByText('Fireball'))
    expect(onSelectionChange).toHaveBeenLastCalledWith(['fireball'])
  })

  it('shift-clicking a row body selects the range from the last-clicked anchor', async () => {
    const user = userEvent.setup()
    let selected: string[] = []
    const onSelectionChange = vi.fn((ids: string[]) => {
      selected = ids
    })
    const { rerender } = renderTable({
      selectionMode: 'multi',
      rowClick: 'select',
      selectedIds: selected,
      onSelectionChange,
    })
    await user.click(screen.getByText('Fireball'))
    expect(onSelectionChange).toHaveBeenLastCalledWith(['fireball'])
    rerender(
      <DataTable<Spell>
        tableId="spells"
        rows={SPELLS}
        columns={columns}
        rowMeta={rowMeta}
        selectionMode="multi"
        rowClick="select"
        selectedIds={selected}
        onSelectionChange={onSelectionChange}
        searchText={(s) => `${s.name} ${s.school}`}
        ariaLabel="Spells"
      />,
    )
    await user.keyboard('{Shift>}')
    await user.click(screen.getByText('Counterspell'))
    await user.keyboard('{/Shift}')
    expect(onSelectionChange).toHaveBeenLastCalledWith([
      'fireball',
      'bless',
      'counterspell',
    ])
  })

  it('header checkbox selects every visible selectable row, then clears it', async () => {
    const user = userEvent.setup()
    let selected: string[] = ['bless']
    const onSelectionChange = vi.fn((ids: string[]) => {
      selected = ids
    })
    const { rerender } = renderTable({
      selectionMode: 'multi',
      selectedIds: selected,
      onSelectionChange,
    })
    // A partial selection reads as indeterminate; clicking it selects all. Gated
    // (Aid) and non-standard-when-disallowed rows aside, every selectable visible
    // row is added; here allowNonStandard defaults to true, so the only exclusion
    // is the gated Aid row.
    const selectAll = screen.getByRole('checkbox', { name: 'Select all rows' })
    expect((selectAll as HTMLInputElement).indeterminate).toBe(true)
    await user.click(selectAll)
    expect(onSelectionChange).toHaveBeenLastCalledWith([
      'bless',
      'fireball',
      'counterspell',
      'homebrew-bolt',
    ])
    rerender(
      <DataTable<Spell>
        tableId="spells"
        rows={SPELLS}
        columns={columns}
        rowMeta={rowMeta}
        selectionMode="multi"
        selectedIds={selected}
        onSelectionChange={onSelectionChange}
        searchText={(s) => `${s.name} ${s.school}`}
        renderDetail={(s) => <div>Detail for {s.name}</div>}
        ariaLabel="Spells"
      />,
    )
    // Every selectable row is now in, so the box is checked; clicking clears all.
    expect(screen.getByRole('checkbox', { name: 'Select all rows' })).toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: 'Select all rows' }))
    expect(onSelectionChange).toHaveBeenLastCalledWith([])
  })

  it('does not render the select-all header checkbox outside multi mode', () => {
    renderTable({ selectionMode: 'single' })
    expect(
      screen.queryByRole('checkbox', { name: 'Select all rows' }),
    ).not.toBeInTheDocument()
  })

  it('gated rows cannot be selected', () => {
    renderTable()
    const aidRow = screen.getByText('Aid').closest('tr') as HTMLElement
    expect(within(aidRow).getByRole('radio')).toBeDisabled()
  })

  it('renders no selection control in "none" mode but still drives detail on row click', async () => {
    const user = userEvent.setup()
    renderTable({ selectionMode: 'none' })
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    await user.click(screen.getByText('Counterspell'))
    expect(screen.getByText('Detail for Counterspell')).toBeInTheDocument()
  })

  it('omits the detail pane and its placeholder when no renderDetail is given', () => {
    render(
      <DataTable<Spell>
        tableId="spells"
        rows={SPELLS}
        columns={columns}
        rowMeta={rowMeta}
        searchText={(s) => `${s.name} ${s.school}`}
        ariaLabel="Spells"
      />,
    )
    expect(visibleNames()).toHaveLength(SPELLS.length)
    expect(screen.queryByText('Select a row to see its details.')).not.toBeInTheDocument()
  })

  it('non-standard rows are not selectable when allowNonStandard is false', () => {
    renderTable({ allowNonStandard: false })
    const homebrewRow = screen.getByText('Custom Bolt').closest('tr') as HTMLElement
    expect(within(homebrewRow).getByRole('radio')).toBeDisabled()
    const standardRow = screen.getByText('Fireball').closest('tr') as HTMLElement
    expect(within(standardRow).getByRole('radio')).not.toBeDisabled()
  })

  it('greys a non-standard row with its reason, selectable or not', () => {
    const reasoned = (s: Spell) => ({
      ...rowMeta(s),
      reason: s.homebrew ? 'Not in the books' : undefined,
    })
    renderTable({ rowMeta: reasoned })
    const homebrewRow = screen.getByText('Custom Bolt').closest('tr') as HTMLElement
    // Selectable (allowNonStandard defaults to true), and still greyed.
    expect(within(homebrewRow).getByRole('radio')).toBeEnabled()
    expect(homebrewRow).toHaveClass('text-body-secondary')
    expect(homebrewRow).not.toHaveClass('data-table-grid__gated')
    expect(homebrewRow).toHaveAttribute('title', 'Not in the books')
    const standardRow = screen.getByText('Fireball').closest('tr') as HTMLElement
    expect(standardRow).not.toHaveClass('text-body-secondary')
  })

  it('lists standard rows first under any sort when asked', async () => {
    const user = userEvent.setup()
    const rows = [SPELLS[4], ...SPELLS.slice(0, 4)]
    renderTable({ rows, standardFirst: true })
    expect(visibleNames().at(-1)).toBe('Custom Bolt')
    const nameHeader = screen.getByRole('button', { name: 'Name' })
    await user.click(nameHeader)
    await user.click(nameHeader)
    // Descending by name would put Custom Bolt third; it stays last.
    expect(visibleNames()).toEqual([
      'Fireball',
      'Counterspell',
      'Bless',
      'Aid',
      'Custom Bolt',
    ])
  })

  // Data columns in display order (the leading select header carries no text).
  function headerTexts() {
    return screen
      .getAllByRole('columnheader')
      .map((h) => h.textContent ?? '')
      .filter((t) => t.trim() !== '')
  }

  function hasHeader(name: string) {
    return headerTexts().some((t) => t.includes(name))
  }

  it('the Columns chooser hides a column and can restore it', async () => {
    const user = userEvent.setup()
    renderTable()
    expect(hasHeader('School')).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Columns' }))
    const panel = screen.getByRole('menu', { name: 'Choose columns' })
    await user.click(within(panel).getByLabelText('School'))
    expect(hasHeader('School')).toBe(false)

    await user.click(within(panel).getByLabelText('School'))
    expect(hasHeader('School')).toBe(true)
  })

  it('the Columns chooser reorders a column', async () => {
    const user = userEvent.setup()
    renderTable()
    expect(headerTexts().map((t) => t.replace(/\s*\(.*/, ''))).toEqual([
      'Name',
      'School',
      'Level',
    ])

    await user.click(screen.getByRole('button', { name: 'Columns' }))
    const panel = screen.getByRole('menu', { name: 'Choose columns' })
    await user.click(within(panel).getByRole('button', { name: 'Move Level up' }))

    expect(headerTexts().map((t) => t.replace(/\s*\(.*/, ''))).toEqual([
      'Name',
      'Level',
      'School',
    ])
  })

  it('a column that starts hidden is offered in the chooser and hidden again by Reset', async () => {
    const user = userEvent.setup()
    renderTable({
      columns: [
        ...columns,
        { key: 'id', header: 'Identifier', render: (s) => s.id, defaultHidden: true },
      ],
    })
    expect(hasHeader('Identifier')).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Columns' }))
    const panel = screen.getByRole('menu', { name: 'Choose columns' })
    await user.click(within(panel).getByLabelText('Identifier'))
    expect(hasHeader('Identifier')).toBe(true)

    await user.click(within(panel).getByRole('button', { name: 'Reset' }))
    expect(hasHeader('Identifier')).toBe(false)
    expect(hasHeader('School')).toBe(true)
  })

  it('Reset restores the declared columns and order', async () => {
    const user = userEvent.setup()
    renderTable()

    await user.click(screen.getByRole('button', { name: 'Columns' }))
    const panel = screen.getByRole('menu', { name: 'Choose columns' })
    await user.click(within(panel).getByLabelText('School'))
    await user.click(within(panel).getByRole('button', { name: 'Move Level up' }))
    expect(hasHeader('School')).toBe(false)

    await user.click(within(panel).getByRole('button', { name: 'Reset' }))
    expect(headerTexts().map((t) => t.replace(/\s*\(.*/, ''))).toEqual([
      'Name',
      'School',
      'Level',
    ])
  })

  it('sizes the columns to their content until a column is resized', () => {
    renderTable()
    const grid = document.querySelector('.data-table-grid') as HTMLElement
    expect(grid).toHaveClass('data-table-grid--auto')

    // The first drag freezes every column at a width of its own.
    const handle = screen.getByRole('separator', { name: 'Resize Name column' })
    fireEvent.pointerDown(handle, { clientX: 100 })
    fireEvent.pointerUp(window)
    expect(grid).not.toHaveClass('data-table-grid--auto')
    expect(grid).toHaveClass('data-table-grid')
  })

  it('gives the table its asked-for share of the width beside the detail pane', async () => {
    const user = userEvent.setup()
    const { unmount } = renderTable()
    await user.click(screen.getByText('Fireball'))
    expect(screen.getByRole('separator', { name: 'Resize panes' })).toHaveAttribute(
      'aria-valuenow',
      '55',
    )
    unmount()

    renderTable({ detail: { tableShare: 70 } })
    await user.click(screen.getByText('Fireball'))
    expect(screen.getByRole('separator', { name: 'Resize panes' })).toHaveAttribute(
      'aria-valuenow',
      '70',
    )
  })

  it('hands a clicked row to the detail target and keeps no pane of its own', async () => {
    const user = userEvent.setup()
    const show = vi.fn()
    const { rerender } = renderTable({ detailTarget: { openId: null, show } })
    await user.click(screen.getByText('Fireball'))
    expect(show).toHaveBeenCalledTimes(1)
    expect(show.mock.calls[0][0]).toBe('fireball')
    render(<>{show.mock.calls[0][1]}</>)
    expect(screen.getByText('Detail for Fireball')).toBeInTheDocument()
    expect(document.querySelector('.data-table-detail')).toBeNull()
    expect(screen.queryByRole('separator', { name: 'Resize panes' })).toBeNull()

    // The row it says is open is the one marked; the target decides, not the table.
    rerender(
      <DataTable<Spell>
        tableId="spells"
        rows={SPELLS}
        columns={columns}
        rowMeta={rowMeta}
        renderDetail={(s) => <div>Detail for {s.name}</div>}
        detailTarget={{ openId: 'bless', show }}
        ariaLabel="Spells"
      />,
    )
    const marked = document.querySelectorAll('tr.table-active')
    expect(marked).toHaveLength(1)
    expect(marked[0]).toHaveTextContent('Bless')
  })
})
