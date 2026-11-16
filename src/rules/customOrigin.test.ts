import { describe, expect, it } from 'vitest'
import { createCharacter } from '../character/model'
import type { PlayableRace } from '../data/race'
import { ABILITIES } from '../dice/dice'
import { checkOriginIncreases } from './compliance'
import {
  CUSTOM_ORIGIN_NOTE,
  canCustomizeOrigin,
  originValues,
  raceAbilityOptions,
  swapPick,
  swapRowOf,
  swappedValues,
  withSwaps,
} from './customOrigin'
import type { RaceRef } from '../character/model'

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

describe('Customizing Your Origin: languages and proficiencies', () => {
  const elf = race({
    name: 'Elf (High)',
    skillProficiencies: [{ perception: true }],
    languageProficiencies: [{ common: true, elvish: true, anyStandard: 1 }],
    weaponProficiencies: [{ 'longsword|phb': true, 'shortbow|phb': true }],
    armorProficiencies: [{ light: true }],
    toolProficiencies: [{ "smith's tools": true }],
  })
  const ref = (swaps?: string[], customOrigin = true): RaceRef => ({
    name: 'Elf (High)',
    baseName: 'Elf',
    source: 'PHB',
    abilityFixed: {},
    abilityChoices: {},
    ...(customOrigin ? { customOrigin: true } : {}),
    ...(swaps ? { swaps } : {}),
  })

  it('lists what the race gives outright, not what it lets the player choose', () => {
    expect(originValues(elf).map((v) => `${v.kind}:${v.key}`)).toEqual([
      'skill:perception',
      'language:common',
      'language:elvish',
      "tool:smith's tools",
      'weapon:longsword',
      'weapon:shortbow',
      'armor:light',
    ])
    expect(originValues(race({ languageProficiencies: [{ other: true }] }))).toEqual([])
  })

  it('swaps only with the switch on', () => {
    expect(swappedValues(elf, ref(['weapon:longsword'], false))).toEqual([])
    expect(withSwaps(elf, ref(['weapon:longsword'], false))).toBe(elf)
    expect(swappedValues(elf, ref(['weapon:longsword', 'weapon:dagger']))).toEqual([
      { kind: 'weapon', key: 'longsword' },
    ])
  })

  it('takes a swapped value away, and turns a swapped skill into a free skill pick', () => {
    const swapped = withSwaps(elf, ref(['skill:perception', 'weapon:longsword']))
    expect(swapped.skillProficiencies).toEqual([{ any: 1 }])
    expect(swapped.weaponProficiencies).toEqual([{ 'shortbow|phb': true }])
    expect(swapped.originSwaps).toEqual([
      { kind: 'skill', key: 'perception' },
      { kind: 'weapon', key: 'longsword' },
    ])
    const lang = withSwaps(elf, ref(['language:elvish']))
    expect(lang.languageProficiencies).toEqual([{ common: true, anyStandard: 1 }])
  })

  it('reads each row of the Proficiency Swaps table', () => {
    const category = (n: string): 'simple' | 'martial' =>
      n === 'handaxe' ? 'simple' : 'martial'
    expect(swapRowOf({ kind: 'weapon', key: 'handaxe' }, category)).toBe('simpleWeapon')
    expect(swapRowOf({ kind: 'weapon', key: 'simple' }, () => undefined)).toBe(
      'simpleWeapon',
    )
    expect(swapRowOf({ kind: 'weapon', key: 'longsword' }, category)).toBe(
      'martialWeapon',
    )
    expect(swapRowOf({ kind: 'armor', key: 'light' }, category)).toBe('armor')
    const tool = swapPick('tool', { kind: 'tool', key: "smith's tools" })
    expect(tool).toMatchObject({
      count: 1,
      kinds: ['weapon', 'tool'],
      filter: 'type=simple weapon',
      text: "Tool or simple weapon, for Smith's Tools",
    })
    const language = swapPick('language', { kind: 'language', key: 'elvish' })
    expect(language.from).toHaveLength(16)
    expect(swapPick('armor', { kind: 'armor', key: 'light' }).filter).toBeUndefined()
  })
})
