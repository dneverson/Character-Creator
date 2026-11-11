import { describe, expect, it } from 'vitest'
import { defaultEquipment, type InventoryItem } from '../character/model'
import {
  attunedCount,
  carriedWeight,
  carryingCapacity,
  coinWeight,
  lacksClass,
  purseValue,
  strengthNeeded,
  totalValue,
} from './equipment'

const purse = (coins: Partial<ReturnType<typeof defaultEquipment>['currency']>) => ({
  ...defaultEquipment().currency,
  ...coins,
})

describe('coins', () => {
  it('weigh a pound for fifty, of whatever kind', () => {
    expect(coinWeight(purse({}))).toBe(0)
    expect(coinWeight(purse({ gp: 100 }))).toBe(2)
    expect(coinWeight(purse({ pp: 10, gp: 10, ep: 10, sp: 10, cp: 10 }))).toBe(1)
  })

  it('are worth what each kind is worth in copper', () => {
    expect(purseValue(purse({ pp: 1, gp: 2, ep: 1, sp: 3, cp: 4 }))).toBe(
      1000 + 200 + 50 + 30 + 4,
    )
  })
})

describe('carriedWeight', () => {
  it('adds weight times quantity and the weight of the coins', () => {
    const total = carriedWeight(
      [
        { quantity: 2, weight: 3 },
        { quantity: 10, weight: 1 },
      ],
      purse({ gp: 50 }),
    )
    expect(total).toEqual({ pounds: 17, unlisted: 0 })
  })

  it('counts a stack with no weight as nothing and says how many there are', () => {
    const total = carriedWeight(
      [{ quantity: 1 }, { quantity: 2, weight: 5 }, { quantity: 1 }],
      purse({}),
    )
    expect(total).toEqual({ pounds: 10, unlisted: 2 })
  })
})

describe('totalValue', () => {
  it('adds price times quantity and counts what has no price', () => {
    expect(
      totalValue([
        { quantity: 2, value: 150 },
        { quantity: 1 },
        { quantity: 3, value: 0 },
      ]),
    ).toEqual({ copper: 300, unlisted: 1 })
  })
})

describe('carryingCapacity', () => {
  it('is fifteen pounds for each point of Strength', () => {
    expect(carryingCapacity(10)).toBe(150)
    expect(carryingCapacity(16, 'M')).toBe(240)
    expect(carryingCapacity(16, 'S')).toBe(240)
  })

  it('is half for Tiny and two, three and four times for Large, Huge and Gargantuan', () => {
    expect(carryingCapacity(10, 'T')).toBe(75)
    expect(carryingCapacity(10, 'L')).toBe(300)
    expect(carryingCapacity(10, 'H')).toBe(450)
    expect(carryingCapacity(10, 'G')).toBe(600)
  })

  it('takes a size nobody knows for Medium', () => {
    expect(carryingCapacity(10, 'V')).toBe(150)
  })
})

describe('attunedCount', () => {
  it('counts the stacks attuned to', () => {
    const stack = (extra: Partial<InventoryItem>): InventoryItem => ({
      name: 'X',
      source: 'DMG',
      quantity: 1,
      ...extra,
    })
    expect(
      attunedCount([
        stack({ attuned: true }),
        stack({ attuned: false }),
        stack({}),
        stack({ attuned: true, equipped: true }),
      ]),
    ).toBe(2)
    expect(attunedCount([])).toBe(0)
  })
})

describe('strengthNeeded', () => {
  it('is the Strength asked when the character has less', () => {
    expect(strengthNeeded(15, 10)).toBe(15)
  })

  it('asks nothing of enough Strength, no requirement, or a Strength not set yet', () => {
    expect(strengthNeeded(15, 15)).toBeUndefined()
    expect(strengthNeeded(undefined, 8)).toBeUndefined()
    expect(strengthNeeded(15, 0)).toBeUndefined()
  })
})

describe('lacksClass', () => {
  it('is true when the item names classes and the character has none of them', () => {
    expect(lacksClass(['wizard'], ['fighter'])).toBe(true)
  })

  it('is false when one class matches, or the item names none', () => {
    expect(lacksClass(['cleric', 'paladin'], ['fighter', 'paladin'])).toBe(false)
    expect(lacksClass([], ['fighter'])).toBe(false)
  })
})
