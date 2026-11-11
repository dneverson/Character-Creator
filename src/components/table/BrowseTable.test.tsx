import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BrowseTable, type BrowseTableProps, type RowAction } from './BrowseTable'
import { factColumn, type Describe, type Fact } from './facts'

interface Pet {
  id: string
  name: string
  legs: number
  year: string
  wild?: boolean
}

const PETS: Pet[] = [
  { id: 'cat', name: 'Cat', legs: 4, year: '2014' },
  { id: 'dog', name: 'Dog', legs: 4, year: '2024' },
  { id: 'wolf', name: 'Wolf', legs: 4, year: '2014', wild: true },
]

const legs: Fact<Pet> = { key: 'legs', label: 'Legs', text: (p) => String(p.legs) }
const describePets: Describe<Pet> = () => [
  { key: 'basics', title: 'Basics', facts: [legs] },
]

function renderTable(props: Partial<BrowseTableProps<Pet>> = {}) {
  return render(
    <BrowseTable<Pet>
      tableId="pets"
      rows={PETS}
      columns={[{ key: 'name', header: 'Name', render: (p) => p.name }, factColumn(legs)]}
      idOf={(p) => p.id}
      nameOf={(p) => p.name}
      describe={describePets}
      searchText={(p) => p.name}
      labels={{
        compare: 'Compare pets',
        search: 'Search pets…',
        table: 'Pets',
      }}
      {...props}
    />,
  )
}

const rowOf = (name: string) => screen.getByText(name).closest('tr') as HTMLElement
const detailPane = () => document.querySelector('.data-table-detail') as HTMLElement

beforeEach(() => localStorage.clear())

describe('BrowseTable', () => {
  it('lists the rows under the given labels, with no detail pane until a row is clicked', () => {
    renderTable()
    expect(screen.getByRole('table', { name: 'Pets' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search pets…')).toBeInTheDocument()
    expect(screen.queryByText('Select a pet to see its details.')).not.toBeInTheDocument()
    expect(screen.getByText('Wolf')).toBeInTheDocument()
  })

  it('compares the ticked rows, and clears the ticks', async () => {
    const user = userEvent.setup()
    renderTable({ tagsOf: (p) => [p.year] })
    const compare = screen.getByRole('button', { name: 'Compare' })
    expect(compare).toBeDisabled()
    expect(
      screen.queryByRole('button', { name: 'Clear selection' }),
    ).not.toBeInTheDocument()

    await user.click(within(rowOf('Cat')).getByRole('checkbox'))
    expect(screen.getByRole('button', { name: 'Compare (1)' })).toBeDisabled()
    await user.click(within(rowOf('Dog')).getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Compare (2)' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Compare pets')).toBeInTheDocument()
    expect(within(dialog).getByRole('columnheader', { name: /Cat/ })).toBeInTheDocument()
    expect(within(dialog).getByRole('columnheader', { name: /Dog/ })).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))

    await user.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(screen.getByRole('button', { name: 'Compare' })).toBeDisabled()
  })

  it('shows a clicked row in full, with its tags and anything further', async () => {
    const user = userEvent.setup()
    renderTable({
      tagsOf: (p) => [p.year],
      detailFooter: (p) => <p>More about {p.name}</p>,
    })
    await user.click(screen.getByText('Dog'))
    const detail = detailPane()
    expect(within(detail).getByRole('heading', { name: 'Dog' })).toBeInTheDocument()
    expect(within(detail).getByText('2024')).toBeInTheDocument()
    expect(within(detail).getByRole('rowheader', { name: 'Legs' })).toBeInTheDocument()
    expect(within(detail).getByText('More about Dog')).toBeInTheDocument()
  })

  it('leads each row with its action, which does not open the row', async () => {
    const user = userEvent.setup()
    const adopt = vi.fn()
    renderTable({
      action: {
        header: 'Adopt',
        of: (p): RowAction | undefined =>
          p.wild ? undefined : { label: 'Adopt', run: () => adopt(p.id) },
      },
    })
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent ?? '')
    const named = headers.filter((text) => text.trim() !== '')
    expect(named[0]).toContain('Adopt')

    await user.click(within(rowOf('Cat')).getByRole('button', { name: 'Adopt' }))
    expect(adopt).toHaveBeenCalledWith('cat')
    expect(
      screen.queryByRole('button', { name: 'Close details' }),
    ).not.toBeInTheDocument()
    // A row with nothing to do has no button.
    expect(within(rowOf('Wolf')).queryByRole('button')).not.toBeInTheDocument()
  })

  it('repeats the action in the detail pane, saying more where there is room', async () => {
    const user = userEvent.setup()
    const release = vi.fn()
    renderTable({
      action: {
        key: 'keep',
        header: 'Keep',
        of: (p) => ({
          label: 'Release',
          detailLabel: `Release ${p.name}`,
          variant: 'danger',
          run: () => release(p.id),
        }),
      },
    })
    expect(within(rowOf('Dog')).getByRole('button', { name: 'Release' })).toHaveClass(
      'btn-danger',
    )
    await user.click(screen.getByText('Dog'))
    await user.click(within(detailPane()).getByRole('button', { name: 'Release Dog' }))
    expect(release).toHaveBeenCalledWith('dog')
  })

  it('uses the short label in the detail pane when there is no longer one', async () => {
    const user = userEvent.setup()
    renderTable({ action: { header: 'Adopt', of: () => ({ label: 'Adopt', run() {} }) } })
    await user.click(screen.getByText('Cat'))
    expect(within(detailPane()).getByRole('button', { name: 'Adopt' })).toHaveClass(
      'btn-primary',
    )
  })

  describe('standard and non-standard rows', () => {
    const rowMeta = (p: Pet) => ({
      standard: !p.wild,
      reason: p.wild ? 'Wild animals need a DM' : undefined,
    })
    const adopt = vi.fn()
    const action = {
      header: 'Adopt',
      of: (p: Pet): RowAction => ({
        label: 'Adopt',
        detailLabel: `Adopt ${p.name}`,
        run: () => adopt(p.id),
      }),
    }
    const SWITCH = 'Allow non-standard choices (DM approval)'
    const headerTexts = () =>
      screen.getAllByRole('columnheader').map((h) => h.textContent ?? '')

    beforeEach(() => adopt.mockClear())

    it('greys a non-standard row with its reason, and still lets it be ticked', () => {
      renderTable({ rowMeta })
      expect(rowOf('Wolf')).toHaveClass('text-body-secondary')
      expect(rowOf('Wolf')).toHaveAttribute('title', 'Wild animals need a DM')
      expect(rowOf('Cat')).not.toHaveClass('text-body-secondary')
      expect(within(rowOf('Wolf')).getByRole('checkbox')).toBeEnabled()
    })

    it('flags a non-standard row with its reason beside the name, and lists it last', () => {
      renderTable({ rowMeta, rows: [PETS[2], ...PETS.slice(0, 2)] })
      const badge = within(rowOf('Wolf')).getByRole('note')
      expect(badge).toHaveTextContent('Wild animals need a DM')
      expect(badge.closest('td')).toBe(
        within(rowOf('Wolf')).getByText('Wolf').closest('td'),
      )
      expect(
        within(rowOf('Wolf')).getByTitle('Wild animals need a DM'),
      ).toBeInTheDocument()
      expect(within(rowOf('Cat')).queryByRole('note')).not.toBeInTheDocument()
      const lines = screen.getAllByRole('row').map((r) => r.textContent ?? '')
      const at = (name: string) => lines.findIndex((t) => t.includes(name))
      expect(at('Wolf')).toBeGreaterThan(at('Cat'))
      expect(at('Wolf')).toBeGreaterThan(at('Dog'))
    })

    it('says Non-standard when a row gives no reason', () => {
      renderTable({
        rowMeta: (p) => (p.wild ? { standard: false } : { standard: true }),
      })
      expect(within(rowOf('Wolf')).getByRole('note')).toHaveTextContent('Non-standard')
    })

    it('offers the Rules column hidden, right after the name once chosen', async () => {
      const user = userEvent.setup()
      renderTable({ rowMeta })
      expect(headerTexts().some((text) => text.includes('Rules'))).toBe(false)
      await user.click(screen.getByRole('button', { name: 'Columns' }))
      await user.click(screen.getByRole('checkbox', { name: 'Rules' }))
      const heads = headerTexts()
      const at = (text: string) => heads.findIndex((t) => t.includes(text))
      expect(at('Rules')).toBe(at('Name') + 1)
      expect(within(rowOf('Wolf')).getAllByText('Wild animals need a DM')).toHaveLength(2)
    })

    it('has neither a Rules column nor a switch without rowMeta', () => {
      renderTable()
      expect(headerTexts().some((text) => text.includes('Rules'))).toBe(false)
      expect(screen.queryByLabelText(/non-standard choices/)).not.toBeInTheDocument()
    })

    it('has no switch when every row is standard', () => {
      renderTable({ rowMeta: () => ({ standard: true }) })
      expect(screen.queryByLabelText(/non-standard choices/)).not.toBeInTheDocument()
    })

    it('holds the action of a non-standard row until the switch is on, in the table and the pane', async () => {
      const user = userEvent.setup()
      renderTable({ rowMeta, action })
      const toggle = screen.getByLabelText(SWITCH)
      expect(toggle).not.toBeChecked()
      const wolf = rowOf('Wolf')
      expect(within(wolf).getByRole('button', { name: 'Adopt' })).toBeDisabled()
      expect(within(rowOf('Cat')).getByRole('button', { name: 'Adopt' })).toBeEnabled()

      await user.click(wolf)
      expect(
        within(detailPane()).getByRole('button', { name: 'Adopt Wolf' }),
      ).toBeDisabled()
      // The pane says why.
      expect(within(detailPane()).getByText('Wild animals need a DM')).toBeInTheDocument()

      await user.click(toggle)
      expect(within(wolf).getByRole('button', { name: 'Adopt' })).toBeEnabled()
      await user.click(within(detailPane()).getByRole('button', { name: 'Adopt Wolf' }))
      expect(adopt).toHaveBeenCalledWith('wolf')
    })

    it('never holds back taking something away', () => {
      renderTable({
        rowMeta,
        action: {
          header: 'Keep',
          of: () => ({ label: 'Release', variant: 'danger', run() {} }),
        },
      })
      expect(within(rowOf('Wolf')).getByRole('button', { name: 'Release' })).toBeEnabled()
    })

    it('can be controlled by the section, which owns the switch', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      renderTable({
        rowMeta,
        action,
        allowNonStandard: true,
        onAllowNonStandardChange: onChange,
      })
      expect(screen.getByLabelText(SWITCH)).toBeChecked()
      expect(within(rowOf('Wolf')).getByRole('button', { name: 'Adopt' })).toBeEnabled()
      await user.click(screen.getByLabelText(SWITCH))
      expect(onChange).toHaveBeenCalledWith(false)
    })

    it('names the reason in the compare window too', async () => {
      const user = userEvent.setup()
      renderTable({ rowMeta })
      await user.click(within(rowOf('Cat')).getByRole('checkbox'))
      await user.click(within(rowOf('Wolf')).getByRole('checkbox'))
      await user.click(screen.getByRole('button', { name: /^Compare/ }))
      expect(
        within(screen.getByRole('dialog')).getByText('Wild animals need a DM'),
      ).toBeInTheDocument()
    })

    it('says so when a non-standard row has no reason', async () => {
      const user = userEvent.setup()
      renderTable({ rowMeta: (p) => ({ standard: !p.wild }) })
      await user.click(screen.getByText('Wolf'))
      expect(within(detailPane()).getByText('Not a standard choice')).toBeInTheDocument()
    })
  })

  it('takes Compare and Clear selection into full screen with the table', async () => {
    const user = userEvent.setup()
    renderTable()
    await user.click(screen.getAllByRole('checkbox', { name: 'Select row' })[0])
    await user.click(screen.getByRole('button', { name: 'Full screen' }))
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByRole('button', { name: 'Compare (1)' }),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: 'Clear selection' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Compare (1)' })).toHaveLength(1)
  })

  it('puts further controls beside Compare, given the ticked rows', async () => {
    const user = userEvent.setup()
    renderTable({
      toolbar: (selected) => (
        <span>Ticked: {selected.map((p) => p.name).join(', ') || 'none'}</span>
      ),
    })
    expect(screen.getByText('Ticked: none')).toBeInTheDocument()
    await user.click(within(rowOf('Dog')).getByRole('checkbox'))
    await user.click(within(rowOf('Cat')).getByRole('checkbox'))
    // In table order, not the order ticked.
    expect(screen.getByText('Ticked: Cat, Dog')).toBeInTheDocument()
  })

  it('gives the table its asked-for share of the width beside the detail pane', async () => {
    const user = userEvent.setup()
    const { unmount } = renderTable()
    await user.click(screen.getByText('Dog'))
    const split = () => screen.getByRole('separator', { name: 'Resize panes' })
    expect(split()).toHaveAttribute('aria-valuenow', '55')
    unmount()

    renderTable({ tableShare: 70 })
    await user.click(screen.getByText('Dog'))
    expect(split()).toHaveAttribute('aria-valuenow', '70')
  })

  describe('compact', () => {
    const wildRules = (p: Pet) =>
      p.wild ? { standard: false, reason: 'Not a pet' } : { standard: true }

    it('drops the search box and the column chooser, and keeps the rest', async () => {
      const user = userEvent.setup()
      renderTable({ compact: true, tagsOf: (p) => [p.year] })
      expect(screen.queryByPlaceholderText('Search pets…')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Columns/ })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Compare' })).toBeInTheDocument()
      // No empty detail pane takes width before a row is clicked.
      expect(
        screen.queryByText('Select a pet to see its details.'),
      ).not.toBeInTheDocument()
      await user.click(screen.getByText('Dog'))
      expect(
        within(detailPane()).getByRole('heading', { name: 'Dog' }),
      ).toBeInTheDocument()
    })

    it('leaves out the switch for non-standard rows', () => {
      renderTable({ compact: true, rowMeta: wildRules })
      expect(screen.queryByLabelText(/Allow non-standard/)).not.toBeInTheDocument()
      expect(screen.getByText('Not a pet')).toBeInTheDocument()
    })

    it('flags a non-standard row by its name and has no Rules column', () => {
      renderTable({ compact: true, rowMeta: wildRules })
      expect(within(rowOf('Wolf')).getByRole('note')).toHaveTextContent('Not a pet')
      expect(
        screen.queryByRole('columnheader', { name: /Rules/ }),
      ).not.toBeInTheDocument()
    })

    it('keeps the search box, chooser and switch when not compact', () => {
      renderTable({ rowMeta: wildRules })
      expect(screen.getByPlaceholderText('Search pets…')).toBeInTheDocument()
      expect(screen.getByLabelText(/Allow non-standard/)).toBeInTheDocument()
    })
  })
})
