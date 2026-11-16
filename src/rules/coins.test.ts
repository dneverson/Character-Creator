import { describe, expect, it } from 'vitest'
import type { Currency } from '../character/model'
import {
  addCoins,
  coinListText,
  coinsFor,
  coinsText,
  exchangeCoins,
  priceCoin,
  receiveCoins,
  spendCoins,
} from './coins'
import { purseValue } from './equipment'

const purse = (c: Partial<Currency>): Currency => ({
  pp: 0,
  gp: 0,
  ep: 0,
  sp: 0,
  cp: 0,
  ...c,
})

describe('adding coins', () => {
  it('puts coins of one kind in, and never goes below none', () => {
    expect(addCoins(purse({ gp: 3 }), 'gp', 4).gp).toBe(7)
    expect(addCoins(purse({ gp: 3 }), 'gp', -9).gp).toBe(0)
  })

  it('writes an amount of copper as gold, silver and copper', () => {
    expect(coinsFor(1234)).toEqual({ gp: 12, sp: 3, cp: 4 })
    expect(coinsFor(0)).toEqual({})
    expect(receiveCoins(purse({ gp: 1, cp: 1 }), { gp: 2, sp: 5 })).toEqual(
      purse({ gp: 3, sp: 5, cp: 1 }),
    )
  })

  it('names the coin a price is quoted in', () => {
    expect([priceCoin(1500), priceCoin(250), priceCoin(7), priceCoin(0)]).toEqual([
      'gp',
      'sp',
      'cp',
      'cp',
    ])
  })

  it('writes coins as words', () => {
    expect(coinsText(1205)).toBe('12 gp 5 cp')
    expect(coinsText(0)).toBe('0 cp')
    expect(coinListText({ gp: 2, sp: 1 })).toBe('2 gp 1 sp')
  })
})

describe('spending coins', () => {
  it('takes the coins of the kind asked for first', () => {
    const paid = spendCoins(purse({ gp: 20, sp: 50 }), 1500, 'gp')
    expect(paid.purse).toEqual(purse({ gp: 5, sp: 50 }))
    expect(paid.short).toBe(0)
    expect(paid.broke).toBeUndefined()
  })

  it('then uses smaller coins before larger ones', () => {
    const paid = spendCoins(purse({ pp: 1, gp: 2, sp: 30 }), 500, 'gp')
    // The two gold pieces and thirty silver pay it; the platinum piece is not touched.
    expect(paid.purse).toEqual(purse({ pp: 1 }))
  })

  it('breaks a larger coin and gives change when only large coins are left', () => {
    const paid = spendCoins(purse({ pp: 2 }), 1500, 'gp')
    expect(paid.broke).toBe('pp')
    expect(paid.change).toEqual({ gp: 5 })
    expect(paid.purse).toEqual(purse({ gp: 5 }))
  })

  it('breaks a gold piece into silver and copper', () => {
    const paid = spendCoins(purse({ gp: 1 }), 33, 'cp')
    expect(paid.broke).toBe('gp')
    expect(paid.change).toEqual({ sp: 6, cp: 7 })
    expect(paid.purse).toEqual(purse({ sp: 6, cp: 7 }))
  })

  it('pays everything and says how short a poor purse is', () => {
    const paid = spendCoins(purse({ gp: 2, sp: 5 }), 1000, 'gp')
    expect(paid.purse).toEqual(purse({}))
    expect(paid.short).toBe(1000 - 250)
  })

  it('pays an exact purse without being short', () => {
    const paid = spendCoins(purse({ gp: 5 }), 500, 'gp')
    expect(paid.short).toBe(0)
    expect(purseValue(paid.purse)).toBe(0)
  })

  it('works from the nearest larger coin up, and never loses value', () => {
    const start = purse({ pp: 1, gp: 1, ep: 1, sp: 1, cp: 1 })
    const price = 777
    const paid = spendCoins(start, price, 'ep')
    expect(paid.short).toBe(0)
    expect(purseValue(paid.purse)).toBe(purseValue(start) - price)
  })
})

describe('changing coins', () => {
  it('changes whole coins only', () => {
    const swap = exchangeCoins(purse({ sp: 25 }), 'sp', 'gp', 25)
    expect(swap.gave).toBe(20)
    expect(swap.got).toBe(2)
    expect(swap.purse).toEqual(purse({ sp: 5, gp: 2 }))
  })

  it('changes up to what the purse has, and down to smaller coins', () => {
    expect(exchangeCoins(purse({ gp: 3 }), 'gp', 'sp', 10).purse).toEqual(
      purse({ sp: 30 }),
    )
    expect(exchangeCoins(purse({ pp: 1 }), 'pp', 'ep', 5).got).toBe(20)
  })

  it('changes nothing when the amount is too small or the kind is the same', () => {
    const start = purse({ sp: 3 })
    expect(exchangeCoins(start, 'sp', 'gp', 3).got).toBe(0)
    expect(exchangeCoins(start, 'sp', 'gp', 3).purse).toBe(start)
    expect(exchangeCoins(start, 'sp', 'sp', 3).got).toBe(0)
  })
})
