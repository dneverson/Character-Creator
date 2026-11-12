import { describe, expect, it } from 'vitest'
import {
  clearedAbilities,
  gauntletScores,
  generatePool,
  pointBuyBaseline,
  poolGroupTotals,
  poolScores,
  remainingPool,
  unassignedAbilities,
  usesPool,
} from './stats'
import type { Abilities, GauntletSlot } from './model'

function gauntletSlots(totals: number[], rerolls = 0): GauntletSlot[] {
  return totals.map((total) => ({ total, rerolls }))
}

function abilitiesWith(bases: (number | null)[]): Abilities {
  const keys = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
  return Object.fromEntries(
    keys.map((k, i) => [k, { base: bases[i] ?? null, other: 0 }]),
  ) as Abilities
}

describe('generatePool', () => {
  it('returns the standard array for "array"', () => {
    expect(generatePool('array')).toEqual([15, 14, 13, 12, 10, 8])
  })
  it('returns an empty pool for point buy and matrix', () => {
    expect(generatePool('pointbuy')).toEqual([])
    expect(generatePool('matrix')).toEqual([])
  })
  it('returns six scores for the roll method', () => {
    expect(generatePool('roll', { dice: 4, rerolls: 0 })).toHaveLength(6)
  })
})

describe('remainingPool', () => {
  it('removes assigned bases as a multiset', () => {
    const pool = [15, 15, 13, 12, 10, 8]
    const abilities = abilitiesWith([15, null, null, null, null, null])
    // One 15 consumed, one 15 still available.
    expect(remainingPool(pool, abilities)).toEqual([15, 13, 12, 10, 8])
  })
  it('returns the whole pool when nothing is assigned', () => {
    const pool = [15, 14, 13, 12, 10, 8]
    expect(remainingPool(pool, abilitiesWith([]))).toEqual([15, 14, 13, 12, 10, 8])
  })
})

describe('point-buy helpers', () => {
  it('baseline sets every base to 8', () => {
    const b = pointBuyBaseline()
    expect(Object.values(b).every((e) => e.base === 8)).toBe(true)
  })
  it('usesPool is false only for point buy', () => {
    expect(usesPool('pointbuy')).toBe(false)
    expect(usesPool('array')).toBe(true)
    expect(usesPool('roll')).toBe(true)
  })
})

describe('unassignedAbilities', () => {
  it('names the pool abilities with no score yet, and none under point buy', () => {
    const abilities = abilitiesWith([15, null, 13, 12, 10, null])
    expect([...unassignedAbilities(abilities, 'array')]).toEqual(['dex', 'cha'])
    // Point buy reads a missing base as its floor, so nothing is unassigned.
    expect(unassignedAbilities(abilities, 'pointbuy').size).toBe(0)
  })
})

describe('clearedAbilities', () => {
  it('nulls bases but keeps other bonuses', () => {
    const before = abilitiesWith([15, 14, 13, 12, 10, 8])
    before.str.other = 2
    const after = clearedAbilities(before)
    expect(after.str.base).toBeNull()
    expect(after.str.other).toBe(2)
  })
})

describe('gauntletScores', () => {
  it('returns every slot total as soon as six slots exist (no lock step)', () => {
    expect(gauntletScores(gauntletSlots([15, 14, 13, 12, 10, 8]))).toEqual([
      15, 14, 13, 12, 10, 8,
    ])
  })
  it('returns [] unless there are exactly six slots', () => {
    expect(gauntletScores(gauntletSlots([15, 14, 13]))).toEqual([])
    expect(gauntletScores([])).toEqual([])
  })
})

describe('poolGroupTotals', () => {
  it('sums complete groups and leaves incomplete ones null', () => {
    // Groups 0 and 2 hold three dice; group 1 holds two, the rest are ungrouped.
    const dice = [6, 5, 4, 3, 2, 6, 6, 6]
    const groups = [0, 0, 0, 1, 1, 2, 2, 2]
    expect(poolGroupTotals(dice, groups)).toEqual([15, null, 18, null, null, null])
  })
})

describe('poolScores', () => {
  it('sums the dice of each complete group of three', () => {
    // 18 dice, groups 0..5 each holding three consecutive dice.
    const dice = [6, 5, 4, 3, 2, 1, 6, 6, 6, 1, 1, 1, 4, 4, 4, 2, 3, 5]
    const groups = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5]
    expect(poolScores(dice, groups)).toEqual([15, 6, 18, 3, 12, 10])
  })
  it('returns [] while any die is still ungrouped', () => {
    const dice = Array(18).fill(3)
    const groups: (number | null)[] = Array(18)
      .fill(0)
      .map((_, i) => (i < 15 ? i % 5 : null))
    expect(poolScores(dice, groups)).toEqual([])
  })
  it('returns [] when a group does not hold exactly three dice', () => {
    const dice = Array(18).fill(3)
    // Four dice in group 0, two in group 1; the rest spread 3 each.
    const groups = [0, 0, 0, 0, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5]
    expect(poolScores(dice, groups)).toEqual([])
  })
})
