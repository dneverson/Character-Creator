import { describe, expect, it } from 'vitest'
import { defaultPlayState, type PlayState } from '../character/model'
import { REST_RULES } from '../rules/restRules'
import { applyRest, hitDieHp, regainedDice, restWarning } from './rest'
import type { HitDicePool } from './derivePlay'

const dice = (die: string, total: number, spent: number): HitDicePool => ({
  faces: Number(die.slice(1)),
  die,
  total,
  spent,
  left: total - spent,
})

const worn: PlayState = {
  ...defaultPlayState(),
  damage: 20,
  tempHp: 6,
  exhaustion: 2,
  slotsSpent: [2, 1],
  pactSpent: 1,
  hitDiceSpent: { d8: 3, d10: 1 },
  deathSaves: { successes: 1, failures: 2 },
}
const pools = [dice('d8', 5, 3), dice('d10', 3, 1)]

describe('hit die hit points', () => {
  it('gives at least the minimum of the edition', () => {
    expect(hitDieHp(1, -2, 0)).toBe(0)
    expect(hitDieHp(1, -2, 1)).toBe(1)
    expect(hitDieHp(6, 2, 1)).toBe(8)
  })
})

describe('regainedDice', () => {
  it('gives half of the total, the largest first, never more than were spent', () => {
    expect(regainedDice(pools, 'half', 1)).toEqual({ d10: 1, d8: 3 })
    expect(regainedDice([dice('d8', 1, 1)], 'half', 1)).toEqual({ d8: 1 })
    expect(regainedDice([dice('d8', 4, 0)], 'half', 1)).toEqual({})
  })
  it('gives all spent dice for the 2024 rules', () => {
    expect(regainedDice(pools, 'all', 0)).toEqual({ d10: 1, d8: 3 })
  })
})

describe('restWarning', () => {
  it('warns at 0 hit points only where the rest needs 1', () => {
    expect(restWarning(REST_RULES.one.long, 0)).toMatch(/at least 1 hit point/)
    expect(restWarning(REST_RULES.one.long, 3)).toBeUndefined()
    expect(restWarning(REST_RULES.classic.short, 0)).toBeUndefined()
  })
})

describe('a short rest', () => {
  const spends = [
    { die: 'd8', roll: 4, hp: 6 },
    { die: 'd10', roll: 1, hp: 1 },
  ]
  it('heals with the dice spent and restores Pact Magic, in both editions', () => {
    for (const rules of [REST_RULES.classic.short, REST_RULES.one.short]) {
      const next = applyRest(worn, rules, { maxHp: 40, hitDice: pools, spends })
      expect(next.damage).toBe(13)
      expect(next.hitDiceSpent).toEqual({ d8: 4, d10: 2 })
      expect(next.pactSpent).toBe(0)
      expect(next.slotsSpent).toEqual([2, 1])
      expect(next.tempHp).toBe(6)
      expect(next.exhaustion).toBe(2)
    }
  })
  it('spends nothing without dice', () => {
    const next = applyRest(worn, REST_RULES.one.short, { maxHp: 40, hitDice: pools })
    expect(next.damage).toBe(20)
    expect(next.hitDiceSpent).toEqual(worn.hitDiceSpent)
  })
})

describe('a long rest', () => {
  it('2014: all hit points, half the dice, all slots, no temporary hit points, one exhaustion', () => {
    const next = applyRest(worn, REST_RULES.classic.long, { maxHp: 40, hitDice: pools })
    expect(next).toMatchObject({
      damage: 0,
      tempHp: 0,
      exhaustion: 1,
      slotsSpent: [],
      pactSpent: 0,
      deathSaves: { successes: 0, failures: 0 },
      hitDiceSpent: { d8: 0, d10: 0 },
    })
  })
  it('2024: every spent die comes back', () => {
    const next = applyRest(worn, REST_RULES.one.long, { maxHp: 40, hitDice: pools })
    expect(next.hitDiceSpent).toEqual({ d8: 0, d10: 0 })
    expect(next.damage).toBe(0)
  })
  it('never takes exhaustion below 0', () => {
    const next = applyRest({ ...worn, exhaustion: 0 }, REST_RULES.one.long, {
      maxHp: 40,
      hitDice: pools,
    })
    expect(next.exhaustion).toBe(0)
  })
})
