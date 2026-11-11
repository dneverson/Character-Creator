import { describe, expect, it } from 'vitest'
import { BASE_SOURCE, quantity, sumLines, type Line } from './types'

const line = (extra: Partial<Line>): Line => ({
  id: 'x',
  label: 'x',
  source: BASE_SOURCE,
  amount: 1,
  op: 'add',
  status: 'applied',
  ...extra,
})

describe('quantity', () => {
  it('sums only the applied base and add lines', () => {
    const lines = [
      line({ op: 'base', amount: 10 }),
      line({ amount: 2 }),
      line({ status: 'conditional', amount: 5 }),
      line({ status: 'inactive', amount: 7 }),
      line({ op: 'alt', amount: 9 }),
      line({ op: 'note', status: 'flag', amount: undefined }),
    ]
    expect(sumLines(lines)).toBe(12)
    expect(quantity(lines).value).toBe(12)
  })

  it('is zero for no lines', () => {
    expect(quantity([]).value).toBe(0)
  })
})
