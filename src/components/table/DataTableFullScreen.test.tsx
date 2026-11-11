import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { DataTable } from './DataTable'
import type { Column } from './types'

interface Pet {
  id: string
  name: string
}
const PETS: Pet[] = [
  { id: 'cat', name: 'Cat' },
  { id: 'dog', name: 'Dog' },
  { id: 'cow', name: 'Cow' },
]
const columns: Column<Pet>[] = [{ key: 'name', header: 'Name', render: (p) => p.name }]

function Table({ withDetail = true }: { withDetail?: boolean }) {
  return (
    <DataTable<Pet>
      tableId="pets"
      rows={PETS}
      columns={columns}
      rowMeta={(p) => ({ id: p.id, standard: true })}
      searchText={(p) => p.name}
      selectionMode="multi"
      renderDetail={withDetail ? (p) => <div>Detail for {p.name}</div> : undefined}
      ariaLabel="Pets"
    />
  )
}

beforeEach(() => localStorage.clear())

describe('DataTable full screen', () => {
  it('shows the same table, with its state, in a window and back', async () => {
    const user = userEvent.setup()
    render(<Table />)
    await user.type(screen.getByLabelText('Search table'), 'c')
    await user.click(screen.getByText('Cat'))
    await user.click(screen.getAllByRole('checkbox', { name: 'Select row' })[0])
    await user.click(screen.getByRole('button', { name: 'Full screen' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText('Search table')).toHaveValue('c')
    expect(within(dialog).getByText('Detail for Cat')).toBeInTheDocument()
    expect(within(dialog).queryByText('Dog')).not.toBeInTheDocument()
    expect(
      within(dialog).getAllByRole('checkbox', { name: 'Select row' })[0],
    ).toBeChecked()
    // One table, not a copy: nothing of it is left behind the window.
    expect(screen.getAllByLabelText('Search table')).toHaveLength(1)
    expect(
      within(dialog).queryByRole('button', { name: 'Full screen' }),
    ).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Search table')).toHaveValue('c')
    expect(screen.getByText('Detail for Cat')).toBeInTheDocument()
  })

  it('closes on Escape, first closing an open detail pane', async () => {
    const user = userEvent.setup()
    render(<Table />)
    await user.click(screen.getByText('Dog'))
    await user.click(screen.getByRole('button', { name: 'Full screen' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByText('Cat'))
    expect(within(dialog).getByText('Detail for Cat')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByText('Detail for Cat')).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('works for a table with no detail pane', async () => {
    const user = userEvent.setup()
    render(<Table withDetail={false} />)
    await user.click(screen.getByRole('button', { name: 'Full screen' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
