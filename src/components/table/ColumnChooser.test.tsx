import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ColumnChooser } from './ColumnChooser'
import type { Column } from './types'

interface Row {
  id: string
}
const col = (key: string, header: string): Column<Row> => ({
  key,
  header,
  render: () => null,
})
const COLUMNS = [col('a', 'Alpha'), col('b', 'Beta'), col('c', 'Gamma')]

function Host({ hidden }: { hidden: string[] }) {
  const [order, setOrder] = useState(COLUMNS.map((c) => c.key))
  const [off, setOff] = useState(hidden)
  const byKey = new Map(COLUMNS.map((c) => [c.key, c]))
  return (
    <>
      <ColumnChooser<Row>
        columnOrder={order.flatMap((k) => {
          const column = byKey.get(k)
          return column ? [{ column, visible: !off.includes(k) }] : []
        })}
        onToggle={(key, visible) =>
          setOff((prev) => (visible ? prev.filter((k) => k !== key) : [...prev, key]))
        }
        onReorder={setOrder}
        onReset={() => setOff([])}
      />
      <output aria-label="order">{order.join(',')}</output>
    </>
  )
}

async function open(hidden: string[] = []) {
  const user = userEvent.setup()
  render(<Host hidden={hidden} />)
  await user.click(screen.getByRole('button', { name: 'Columns' }))
  return user
}
const checked = () =>
  screen.getAllByRole('checkbox').map((c) => (c as HTMLInputElement).checked)

describe('ColumnChooser', () => {
  it('toggles a column from a click on its name, not just the box', async () => {
    const user = await open()
    await user.click(screen.getByText('Beta'))
    expect(checked()).toEqual([true, false, true])
    await user.click(screen.getByText('Beta'))
    expect(checked()).toEqual([true, true, true])
  })

  it('selects all and selects none, keeping one column on', async () => {
    const user = await open(['b'])
    await user.click(screen.getByRole('button', { name: 'Select all' }))
    expect(checked()).toEqual([true, true, true])
    expect(screen.getByRole('button', { name: 'Select all' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Select none' }))
    expect(checked()).toEqual([true, false, false])
    expect(screen.getByRole('button', { name: 'Select none' })).toBeDisabled()
  })

  it('reorders with the arrow buttons, which are icons with a label', async () => {
    const user = await open()
    const up = screen.getByRole('button', { name: 'Move Gamma up' })
    expect(up).toHaveTextContent('')
    await user.click(up)
    expect(screen.getByLabelText('order')).toHaveTextContent('a,c,b')
    expect(screen.getByRole('button', { name: 'Move Alpha up' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Move Alpha down' }))
    expect(screen.getByLabelText('order')).toHaveTextContent('c,a,b')
  })

  it('reorders by dragging a row onto another', async () => {
    await open()
    const row = (name: string) =>
      screen.getByText(name).closest('[draggable]') as HTMLElement
    const dataTransfer = { setData: () => undefined, effectAllowed: '' }
    fireEvent.dragStart(row('Alpha'), { dataTransfer })
    fireEvent.dragOver(row('Gamma'), { dataTransfer })
    fireEvent.drop(row('Gamma'), { dataTransfer })
    expect(screen.getByLabelText('order')).toHaveTextContent('b,c,a')
    // A drag that ends elsewhere changes nothing.
    fireEvent.dragStart(row('Beta'), { dataTransfer })
    fireEvent.dragEnd(row('Beta'), { dataTransfer })
    fireEvent.drop(row('Gamma'), { dataTransfer })
    expect(screen.getByLabelText('order')).toHaveTextContent('b,c,a')
  })
})
