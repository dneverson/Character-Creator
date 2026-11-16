import { describe, expect, it } from 'vitest'
import { createCharacter } from '../character/model'
import type { PlayableRace } from '../data/race'
import { ABILITIES } from '../dice/dice'
import { checkOriginIncreases } from './compliance'
import {
  CUSTOM_ORIGIN_NOTE,
  canCustomizeOrigin,
  raceAbilityOptions,
} from './customOrigin'

const race = (over: Partial<PlayableRace> = {}): PlayableRace => ({
  featGrants: [],
  key: 'Dwarf|PHB|Hill|PHB',
  name: 'Dwarf (Hill)',
  baseName: 'Dwarf',
  subraceName: 'Hill',
  source: 'PHB',
  baseSource: 'PHB',
  edition: 'classic',
  size: ['M'],
  speed: 25,
  abilityOptions: [{ fixed: { con: 2, wis: 1 }, amounts: [], from: [] }],
  ...over,
})

const withRace = (abilityFixed: object, abilityChoices: object, customOrigin?: true) => {
  const c = createCharacter('Tordek')
  c.race = {
    name: 'Dwarf (Hill)',
    baseName: 'Dwarf',
    source: 'PHB',
    subraceName: 'Hill',
    abilityFixed,
    abilityChoices,
    ...(customOrigin ? { customOrigin } : {}),
  }
  return c
}

describe("Tasha's Customizing Your Origin", () => {
  it('lets the player place every increase, keeping the amounts', () => {
    const ref = withRace({}, {}, true).race
    expect(raceAbilityOptions(race(), ref)).toEqual([
      { fixed: {}, amounts: [2, 1], from: [...ABILITIES], note: CUSTOM_ORIGIN_NOTE },
    ])
    expect(raceAbilityOptions(race(), withRace({}, {}).race)).toEqual(
      race().abilityOptions,
    )
  })

  it('has nothing to move for a 2024 species or a race without increases', () => {
    expect(canCustomizeOrigin(race({ edition: 'one', abilityOptions: [] }))).toBe(false)
    expect(canCustomizeOrigin(race({ abilityOptions: [] }))).toBe(false)
    expect(canCustomizeOrigin(race())).toBe(true)
    const species = race({ edition: 'one' })
    expect(raceAbilityOptions(species, withRace({}, {}, true).race)).toBe(
      species.abilityOptions,
    )
  })

  it('is respected by the origin check: moved increases are not flagged, stacked ones are', () => {
    const moved = withRace({}, { int: 2, dex: 1 }, true)
    expect(checkOriginIncreases(moved, race(), undefined)).toEqual([])
    // Without the rule, the same increases are off.
    const off = withRace({}, { int: 2, dex: 1 })
    expect(checkOriginIncreases(off, race(), undefined).map((d) => d.id)).toEqual([
      'origin-increase:race',
    ])
    // Each increase goes to a different ability.
    const stacked = withRace({}, { int: 3 }, true)
    expect(checkOriginIncreases(stacked, race(), undefined)).toHaveLength(1)
  })
})
