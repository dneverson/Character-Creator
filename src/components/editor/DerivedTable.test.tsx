import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { formatMod } from '../../dice/dice'
import { BASE_SOURCE, quantity, type Line } from '../../derived/types'
import { DerivedTable } from './DerivedTable'

const lines: Line[] = [
  {
    id: 'a',
    label: 'Armor',
    source: { kind: 'item', tag: 'i', label: 'Chain Mail' },
    amount: 16,
    op: 'base',
    status: 'applied',
    how: 'base 16',
  },
  {
    id: 'b',
    label: 'Shield',
    source: BASE_SOURCE,
    amount: 2,
    op: 'add',
    status: 'applied',
    badge: 'Manual',
  },
  {
    id: 'c',
    label: 'Dueling',
    source: BASE_SOURCE,
    amount: 2,
    op: 'add',
    status: 'conditional',
    when: 'with one weapon',
  },
  {
    id: 'd',
    label: 'Strength',
    source: BASE_SOURCE,
    op: 'note',
    status: 'flag',
    why: 'You are slower.',
  },
]

describe('DerivedTable', () => {
  it('shows each line with its source, how it adds up and the total', () => {
    render(
      <DerivedTable
        quantity={quantity(lines)}
        ariaLabel="Armor class breakdown"
        amountHeader="Armor class"
        totalLabel="Armor class"
      />,
    )
    const table = screen.getByRole('table', { name: 'Armor class breakdown' })
    expect(within(table).getByText('(Chain Mail)')).toBeTruthy()
    expect(within(table).getByText('base 16')).toBeTruthy()
    expect(within(table).getAllByText('+2', { selector: 'td' })).toHaveLength(2)
    expect(within(table).getByText('Manual')).toBeTruthy()
    expect(within(table).getByText('with one weapon')).toBeTruthy()
    expect(within(table).getByText('You are slower.')).toBeTruthy()
    expect(within(table).getByText('18')).toBeTruthy()
  })

  it('formats the total and lets a caller draw a row', () => {
    render(
      <DerivedTable
        quantity={quantity(lines)}
        ariaLabel="t"
        amountHeader="x"
        totalLabel="Total"
        format={formatMod}
        renderRow={(line) =>
          line.id === 'b' ? (
            <tr>
              <td colSpan={3}>custom row</td>
            </tr>
          ) : undefined
        }
      />,
    )
    expect(screen.getByText('custom row')).toBeTruthy()
    expect(screen.getByText('+18')).toBeTruthy()
  })

  it('holds its three columns at fixed widths when asked, and not otherwise', () => {
    const { rerender } = render(
      <DerivedTable
        quantity={quantity(lines)}
        ariaLabel="t"
        amountHeader="x"
        totalLabel="Total"
        aligned
      />,
    )
    const widths = () =>
      [...screen.getByRole('table').querySelectorAll('col')].map((c) => c.style.width)
    expect(widths()).toEqual(['40%', '44%', '16%'])
    rerender(
      <DerivedTable
        quantity={quantity(lines)}
        ariaLabel="t"
        amountHeader="x"
        totalLabel="Total"
      />,
    )
    expect(widths()).toEqual([])
  })
})
