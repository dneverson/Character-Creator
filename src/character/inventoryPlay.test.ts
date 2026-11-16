import { describe, expect, it } from 'vitest'
import { makeItem } from '../test/itemFixtures'
import {
  acquire,
  changeCoins,
  dispose,
  patchStack,
  payCoins,
  setCoin,
  takeCoins,
} from './inventoryPlay'
import type { EquipmentState } from './model'
import { defaultEquipment } from './model'

const sword = makeItem({ name: 'Longsword', kind: 'weapon', value: 1500 })
const free = makeItem({ name: 'Heirloom' })

function purse(gp: number, items: EquipmentState['items'] = []): EquipmentState {
  const equipment = defaultEquipment()
  return { ...equipment, items, currency: { ...equipment.currency, gp } }
}

describe('acquiring an item', () => {
  it('adds one with no cost, onto its stack when it has one', () => {
    const once = acquire(purse(10), sword, 'add')
    expect(once.equipment.currency.gp).toBe(10)
    expect(once.equipment.items).toEqual([
      { name: 'Longsword', source: 'PHB', quantity: 1 },
    ])
    expect(once.action).toEqual({
      type: 'inventory',
      change: 'add',
      item: 'Longsword',
      quantity: 1,
    })
    expect(acquire(once.equipment, sword, 'add').equipment.items[0].quantity).toBe(2)
  })

  it('buys one for its listed price', () => {
    const out = acquire(purse(20), sword, 'buy')
    expect(out.equipment.currency.gp).toBe(5)
    expect(out.action).toMatchObject({ change: 'buy', price: 1500 })
    expect(out.short).toBeUndefined()
  })

  it('buys with the purse short, paying all of it and saying by how much', () => {
    const out = acquire(purse(10), sword, 'buy')
    expect(out.equipment.currency.gp).toBe(0)
    expect(out.equipment.items).toHaveLength(1)
    expect(out.short).toBe(500)
    expect(out.action).toMatchObject({ short: 500 })
  })

  it('breaks a larger coin for the change', () => {
    const equipment = { ...purse(0), currency: { pp: 2, gp: 0, ep: 0, sp: 0, cp: 0 } }
    const out = acquire(equipment, sword, 'buy')
    expect(out.broke).toBe('pp')
    expect(out.equipment.currency).toEqual({ pp: 0, gp: 5, ep: 0, sp: 0, cp: 0 })
  })

  it('spends nothing on an item with no listed price', () => {
    const out = acquire(purse(10), free, 'buy')
    expect(out.unpriced).toBe(true)
    expect(out.equipment.currency.gp).toBe(10)
    expect(out.equipment.items).toHaveLength(1)
  })

  it('makes an item of a generic variant and a base item', () => {
    const template = makeItem({
      name: '+1 Weapon',
      source: 'DMG',
      magic: true,
      variant: {
        requires: [],
        excludes: {},
        appliesTo: 'Any weapon',
        namePrefix: '+1 ',
        propertyAdd: [],
      },
    })
    const base = makeItem({ name: 'Longsword', kind: 'weapon', value: 1500 })
    const out = acquire(purse(0), template, 'add', base)
    expect(out.equipment.items[0]).toMatchObject({
      variantOf: template.key,
      base: base.key,
      quantity: 1,
    })
  })
})

describe('letting an item go', () => {
  const stacked = purse(0, [{ name: 'Longsword', source: 'PHB', quantity: 3 }])

  it('sells some of a stack and puts the price in the purse', () => {
    const out = dispose(stacked, 'Longsword|PHB', 2, 'sell', 1500)
    expect(out?.equipment.items[0].quantity).toBe(1)
    expect(out?.equipment.currency.gp).toBe(15)
    expect(out?.action).toMatchObject({ change: 'sell', quantity: 2, price: 1500 })
  })

  it('removes the whole stack when the count covers it, and drops for nothing', () => {
    const out = dispose(stacked, 'Longsword|PHB', 9, 'drop', 999)
    expect(out?.equipment.items).toEqual([])
    expect(out?.equipment.currency.gp).toBe(0)
    expect(out?.action).toEqual({
      type: 'inventory',
      change: 'drop',
      item: 'Longsword',
      quantity: 3,
    })
  })

  it('does nothing for a stack that is not there or a count below one', () => {
    expect(dispose(stacked, 'Dagger|PHB', 1, 'drop')).toBeUndefined()
    expect(dispose(stacked, 'Longsword|PHB', 0, 'drop')).toBeUndefined()
  })
})

describe('changing a stack in place', () => {
  const owned = purse(0, [{ name: 'Longsword', source: 'PHB', quantity: 2 }])

  it('names what a change was', () => {
    const kind = (patch: Parameters<typeof patchStack>[2]) =>
      patchStack(owned, 'Longsword|PHB', patch)?.action.change
    expect(kind({ equipped: true })).toBe('equip')
    expect(kind({ equipped: false })).toBe('unequip')
    expect(kind({ attuned: true })).toBe('attune')
    expect(kind({ attuned: false })).toBe('unattune')
    expect(kind({ quantity: 5 })).toBe('quantity')
    expect(kind({ note: 'found' })).toBe('note')
  })

  it('applies the patch to that stack only', () => {
    const out = patchStack(owned, 'Longsword|PHB', { quantity: 5 })
    expect(out?.equipment.items[0].quantity).toBe(5)
    expect(out?.action.quantity).toBe(5)
  })

  it('drops the stack when the count falls below one, and ignores a missing stack', () => {
    expect(patchStack(owned, 'Longsword|PHB', { quantity: 0 })?.action.change).toBe(
      'drop',
    )
    expect(patchStack(owned, 'Longsword|PHB', { quantity: 0 })?.equipment.items).toEqual(
      [],
    )
    expect(patchStack(owned, 'Dagger|PHB', { equipped: true })).toBeUndefined()
  })
})

describe('the purse', () => {
  it('sets a typed count and records the difference', () => {
    const out = setCoin(purse(10), 'gp', 4)
    expect(out.equipment.currency.gp).toBe(4)
    expect(out.action).toMatchObject({ change: 'coins', item: 'gp', quantity: -6 })
    expect(setCoin(purse(10), 'gp', -3).equipment.currency.gp).toBe(0)
  })

  it('takes and pays coins', () => {
    expect(takeCoins(purse(1), 'gp', 4).equipment.currency.gp).toBe(5)
    const paid = payCoins(purse(3), 'gp', 5)
    expect(paid.equipment.currency.gp).toBe(0)
    expect(paid.short).toBe(200)
    expect(paid.action).toMatchObject({ quantity: -5, short: 200 })
    expect(payCoins(purse(9), 'gp', 4).short).toBeUndefined()
  })

  it('changes coins, or does nothing when none would change', () => {
    const equipment = { ...purse(0), currency: { pp: 0, gp: 0, ep: 0, sp: 25, cp: 0 } }
    const out = changeCoins(equipment, 'sp', 'gp', 25)
    expect(out?.equipment.currency).toMatchObject({ sp: 5, gp: 2 })
    expect(out?.action.item).toBe('20 sp for 2 gp')
    expect(changeCoins(equipment, 'sp', 'gp', 3)).toBeUndefined()
  })
})
