import { describe, expect, it } from 'vitest'
import { hpBreakdown } from '../character/hp'
import { createCharacter } from '../character/model'
import { build, deps, FIGHTER } from '../test/derivedFixtures'
import { hpQuantity } from './hp'

describe('hpQuantity', () => {
  it('adds up to the average hit points of the breakdown', () => {
    const c = build('Fighter', 4, { con: 14 }, [])
    const classByKey = deps([FIGHTER]).classByKey
    const breakdown = hpBreakdown(c, classByKey)
    expect(hpQuantity(c, breakdown, false).value).toBe(breakdown.averageHP)
  })

  it('includes the manual adjustments', () => {
    const c = build('Fighter', 2, {}, [])
    c.hp = { ...c.hp, perLevelBonus: 1, flatBonus: 3 }
    const breakdown = hpBreakdown(c, deps([FIGHTER]).classByKey)
    const q = hpQuantity(c, breakdown, false)
    expect(q.value).toBe(breakdown.averageHP)
    expect(q.lines.filter((l) => l.badge === 'Manual')).toHaveLength(2)
  })

  it('has no lines for a character without classes beyond the manual rows', () => {
    const c = createCharacter('Empty')
    const q = hpQuantity(c, hpBreakdown(c, new Map()), false)
    expect(q.value).toBe(0)
  })
})
