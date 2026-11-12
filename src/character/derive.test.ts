import { describe, expect, it } from 'vitest'
import {
  racialBonus,
  backgroundBonus,
  characterAbilityBreakdown,
  characterAbilityTotals,
  originBonus,
  totalLevel,
} from './derive'
import { POINT_BUY_MIN } from '../dice/dice'
import { createCharacter, type Character } from './model'

function withRace(overrides: Partial<Character['race']> = {}): Character {
  const c = createCharacter()
  c.race = {
    name: 'Half-Elf',
    baseName: 'Half-Elf',
    source: 'PHB',
    abilityFixed: { cha: 2 },
    abilityChoices: { dex: 1 },
    ...overrides,
  }
  return c
}

describe('racialBonus', () => {
  it('returns 0 when the character has no race', () => {
    expect(racialBonus(createCharacter(), 'str')).toBe(0)
  })

  it('sums the fixed race bonus and the player-chosen bonus', () => {
    const c = withRace()
    expect(racialBonus(c, 'cha')).toBe(2) // fixed only
    expect(racialBonus(c, 'dex')).toBe(1) // choice only
    expect(racialBonus(c, 'str')).toBe(0) // neither
  })
})

describe('backgroundBonus', () => {
  it('returns 0 when no background is set', () => {
    expect(backgroundBonus(createCharacter(), 'wis')).toBe(0)
  })

  it('reads the assigned 2024 background ability increase', () => {
    const c = createCharacter()
    c.background = {
      name: 'Sage',
      source: 'XPHB',
      abilityChoices: { int: 2, con: 1 },
    }
    expect(backgroundBonus(c, 'int')).toBe(2)
    expect(backgroundBonus(c, 'con')).toBe(1)
    expect(backgroundBonus(c, 'str')).toBe(0)
  })
})

describe('originBonus', () => {
  it('adds race and background contributions for the same ability', () => {
    const c = withRace({ abilityFixed: { con: 1 }, abilityChoices: {} })
    c.background = { name: 'Soldier', source: 'XPHB', abilityChoices: { con: 2 } }
    expect(originBonus(c, 'con')).toBe(3)
  })
})

describe('characterAbilityBreakdown', () => {
  it('sums base + origin + feats + other, treating an unassigned pool base as 0', () => {
    const c = withRace()
    c.statMethod = 'array'
    c.abilities.cha = { base: 15, other: 1 }
    c.abilities.dex = { base: null, other: 0 }
    const breakdown = characterAbilityBreakdown(c, { cha: 1, dex: 1 })
    expect(breakdown.cha).toEqual({ base: 15, origin: 2, feats: 1, other: 1, total: 19 })
    expect(breakdown.dex).toEqual({ base: null, origin: 1, feats: 1, other: 0, total: 2 })
    // The totals are the breakdown's.
    const totals = characterAbilityTotals(c, { cha: 1, dex: 1 })
    expect(totals.cha).toBe(19)
    expect(totals.dex).toBe(2)
  })

  it('reads a missing point-buy base as the point-buy floor', () => {
    const c = createCharacter()
    c.statMethod = 'pointbuy'
    c.abilities.str = { base: null, other: 0 }
    expect(characterAbilityBreakdown(c).str).toEqual({
      base: POINT_BUY_MIN,
      origin: 0,
      feats: 0,
      other: 0,
      total: POINT_BUY_MIN,
    })
  })
})

describe('totalLevel', () => {
  it('is 0 for a classless character', () => {
    expect(totalLevel(createCharacter())).toBe(0)
  })

  it('sums levels across multiclasses and tolerates missing levels', () => {
    const c = createCharacter()
    c.classes = [
      { name: 'Fighter', source: 'PHB', level: 3 },
      { name: 'Rogue', source: 'PHB', level: 2 },
      { name: 'Wizard', source: 'PHB', level: 0 as unknown as number },
    ]
    expect(totalLevel(c)).toBe(5)
  })
})
