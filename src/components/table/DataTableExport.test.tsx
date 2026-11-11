import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DataTable } from './DataTable'
import type { Column } from './types'

const downloads = vi.hoisted(() => [] as { text: string; name: string }[])
vi.mock('./csv', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./csv')>()),
  downloadCsv: (text: string, name: string) => downloads.push({ text, name }),
}))

interface Pet {
  id: string
  name: string
  legs: number
}
const PETS: Pet[] = [
  { id: 'cat', name: 'Cat', legs: 4 },
  { id: 'bird', name: 'Bird', legs: 2 },
  { id: 'snake', name: 'Snake', legs: 0 },
]
const columns: Column<Pet>[] = [
  { key: 'name', header: 'Name', render: (p) => <b>{p.name}</b> },
  { key: 'legs', header: 'Legs', render: (p) => p.legs, sortValue: (p) => p.legs },
]

beforeEach(() => {
  localStorage.clear()
  downloads.length = 0
})

describe('DataTable export', () => {
  it('exports the rows as filtered, sorted and with the columns as shown', async () => {
    const user = userEvent.setup()
    render(
      <DataTable<Pet>
        tableId="pets"
        rows={PETS}
        columns={columns}
        rowMeta={(p) => ({ id: p.id, standard: true })}
        searchText={(p) => p.name}
        ariaLabel="Pets"
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Legs filter menu' }))
    await user.click(screen.getByRole('button', { name: 'Sort Z to A' }))
    await user.type(screen.getByLabelText('Search table'), 'a')
    await user.click(screen.getByRole('button', { name: 'Export CSV' }))
    await waitFor(() => expect(downloads).toHaveLength(1))
    expect(downloads[0].text).toBe('\uFEFFName,Legs\r\nCat,4\r\nSnake,0\r\n')
    expect(downloads[0].name).toMatch(/^pets-\d{4}-\d{2}-\d{2}\.csv$/)
  })
  it('leaves out an action column: only data columns are exported', async () => {
    const user = userEvent.setup()
    render(
      <DataTable<Pet>
        tableId="pets-action"
        rows={PETS}
        columns={[
          {
            key: 'go',
            header: 'Choose',
            action: true,
            render: () => <button>Choose</button>,
          },
          ...columns,
        ]}
        rowMeta={(p) => ({ id: p.id, standard: true })}
        ariaLabel="Pets"
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Export CSV' }))
    await waitFor(() => expect(downloads).toHaveLength(1))
    expect(downloads[0].text).toBe('﻿Name,Legs\r\nCat,4\r\nBird,2\r\nSnake,0\r\n')
  })
})
