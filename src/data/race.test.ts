import { beforeEach, describe, expect, it, vi } from 'vitest'
import { findPlayableRace, loadRaces, type PlayableRace } from './race'
import { fetchData } from './dataClient'
import { ABILITIES } from '../dice/dice'

vi.mock('./dataClient', () => ({ fetchData: vi.fn() }))
const mockFetch = vi.mocked(fetchData)

beforeEach(() => {
  mockFetch.mockReset()
})

describe('loadRaces', () => {
  it('extracts fixed and choose ability bonuses from a base race', async () => {
    mockFetch.mockResolvedValue({
      race: [
        {
          name: 'Human',
          source: 'PHB',
          edition: 'classic',
          size: ['M'],
          speed: 30,
          ability: [
            { str: 1, dex: 1, choose: { from: ['con', 'int'], count: 1, amount: 2 } },
          ],
        },
      ],
    })

    const races = await loadRaces()
    expect(races).toHaveLength(1)
    const human = races[0]
    expect(human.baseName).toBe('Human')
    expect(human.abilityOptions).toEqual([
      { fixed: { str: 1, dex: 1 }, amounts: [2], from: ['con', 'int'] },
    ])
    expect(human.name).toBe('Human')
    expect(mockFetch).toHaveBeenCalledWith('races.json')
  })

  it('merges each subrace onto its base race and inherits base fields', async () => {
    mockFetch.mockResolvedValue({
      race: [{ name: 'Elf', source: 'PHB', size: ['M'], speed: 30, darkvision: 60 }],
      subrace: [
        {
          name: 'High',
          source: 'PHB',
          raceName: 'Elf',
          raceSource: 'PHB',
          ability: [{ int: 1 }],
        },
        {
          name: 'Wood',
          source: 'PHB',
          raceName: 'Elf',
          raceSource: 'PHB',
          ability: [{ wis: 1 }],
          speed: 35,
        },
      ],
    })

    const races = await loadRaces()
    expect(races.map((r) => r.name)).toEqual(['Elf (High)', 'Elf (Wood)'])
    const high = races[0]
    expect(high.abilityOptions).toEqual([{ fixed: { int: 1 }, amounts: [], from: [] }])
    expect(high.darkvision).toBe(60) // inherited from base
    expect(high.speed).toBe(30) // base speed when subrace omits it
    expect(races[1].speed).toBe(35) // subrace overrides base
  })

  it('keeps a base race with no subraces as a single playable entry', async () => {
    mockFetch.mockResolvedValue({
      race: [{ name: 'Dwarf', source: 'PHB', ability: [{ con: 2 }] }],
      subrace: [{ name: 'Other', source: 'PHB', raceName: 'Gnome', raceSource: 'PHB' }],
    })

    const races = await loadRaces()
    expect(races.map((r) => r.name)).toEqual(['Dwarf'])
    expect(races[0].abilityOptions).toEqual([
      { fixed: { con: 2 }, amounts: [], from: [] },
    ])
  })

  it('adds a subrace’s ability increases to its race’s and resolves _copy races', async () => {
    mockFetch.mockResolvedValue({
      race: [
        { name: 'Dwarf', source: 'PHB', ability: [{ con: 2 }], darkvision: 60 },
        // A homebrew race that copies Dwarf via the 5etools _copy system.
        { name: 'Deep Dwarf', source: 'HB', _copy: { name: 'Dwarf', source: 'PHB' } },
      ],
      subrace: [
        {
          name: 'Hill',
          source: 'PHB',
          raceName: 'Dwarf',
          raceSource: 'PHB',
          ability: [{ wis: 1 }],
        },
      ],
    })

    const races = await loadRaces()
    // Deep Dwarf inherits Dwarf's darkvision through _copy resolution.
    const deep = races.find((r) => r.baseName === 'Deep Dwarf')!
    expect(deep.darkvision).toBe(60)
    // Hill takes the base CON with the subrace WIS, as one way to take them.
    const hill = races.find((r) => r.name === 'Dwarf (Hill)')!
    expect(hill.abilityOptions).toEqual([
      { fixed: { con: 2, wis: 1 }, amounts: [], from: [] },
    ])
  })

  it('yields no ability options for a race with no ability blocks', async () => {
    mockFetch.mockResolvedValue({
      race: [{ name: 'Construct', source: 'HB', size: ['M'], speed: 30 }],
    })

    const races = await loadRaces()
    expect(races.map((r) => r.name)).toEqual(['Construct'])
    expect(races[0].abilityOptions).toEqual([])
  })

  it('ignores non-ability keys and filters choose lists to real abilities', async () => {
    mockFetch.mockResolvedValue({
      race: [
        {
          name: 'Test',
          source: 'HB',
          ability: [{ str: 1, notAnAbility: 5, choose: { from: ['dex', 'bogus'] } }],
        },
      ],
    })

    const races = await loadRaces()
    // count/amount default to 1 when omitted.
    expect(races[0].abilityOptions).toEqual([
      { fixed: { str: 1 }, amounts: [1], from: ['dex'] },
    ])
  })

  it('lists a nameless subrace as the race itself', async () => {
    mockFetch.mockResolvedValue({
      race: [{ name: 'Human', source: 'PHB', ability: [{ str: 1 }] }],
      subrace: [
        { source: 'PHB', raceName: 'Human', raceSource: 'PHB' },
        { name: 'Variant', source: 'PHB', raceName: 'Human', raceSource: 'PHB' },
      ],
    })

    const races = await loadRaces()
    expect(races.map((r) => r.name)).toEqual(['Human', 'Human (Variant)'])
    expect(races[0].subraceName).toBeUndefined()
  })
})

describe('subrace merge', () => {
  const tiefling = {
    name: 'Tiefling',
    source: 'PHB',
    ability: [{ cha: 2, int: 1 }],
    languageProficiencies: [{ common: true, infernal: true }],
    skillProficiencies: [{ any: 2 }],
    resist: ['fire'],
    darkvision: 60,
    speed: 30,
    entries: [
      { type: 'entries', name: 'Darkvision', entries: ['60 feet.'] },
      { type: 'entries', name: 'Infernal Legacy', entries: ['Thaumaturgy.'] },
    ],
  }
  const sub = (fields: Record<string, unknown>) => ({
    name: 'Sub',
    source: 'MTF',
    raceName: 'Tiefling',
    raceSource: 'PHB',
    ...fields,
  })
  const load = async (fields: Record<string, unknown>) => {
    mockFetch.mockResolvedValue({ race: [tiefling], subrace: [sub(fields)] })
    const [race] = await loadRaces()
    return race
  }

  it('replaces the race’s increases when the subrace overwrites them', async () => {
    const race = await load({
      ability: [{ cha: 2, str: 1 }],
      overwrite: { ability: true },
    })
    expect(race.abilityOptions).toEqual([
      { fixed: { str: 1, cha: 2 }, amounts: [], from: [] },
    ])
  })

  it('lets the subrace’s value stand where both raise the same ability', async () => {
    // The subrace restates the total; the two are not added together.
    const race = await load({ ability: [{ cha: 1, wis: 1 }] })
    expect(race.abilityOptions).toEqual([
      { fixed: { int: 1, wis: 1, cha: 1 }, amounts: [], from: [] },
    ])
  })

  it('adds the subrace’s grants to the race’s, block by block', async () => {
    const race = await load({
      languageProficiencies: [{ anyStandard: 1 }, { elvish: true }],
      toolProficiencies: [{ "smith's tools": true }],
    })
    expect(race.languageProficiencies).toEqual([
      { common: true, infernal: true, anyStandard: 1 },
      { elvish: true },
    ])
    // Only the subrace grants tools, only the race grants skills.
    expect(race.toolProficiencies).toEqual([{ "smith's tools": true }])
    expect(race.skillProficiencies).toEqual([{ any: 2 }])
  })

  it('replaces a grant the subrace overwrites, and drops one it clears', async () => {
    const race = await load({
      skillProficiencies: [{ perception: true }],
      overwrite: { skillProficiencies: true },
      languageProficiencies: null,
    })
    expect(race.skillProficiencies).toEqual([{ perception: true }])
    expect(race.languageProficiencies).toEqual([])
  })

  it('gathers what both list plainly, once each', async () => {
    const race = await load({ resist: ['fire', 'cold'], immune: ['poison'] })
    expect(race.resist).toEqual(['fire', 'cold'])
    expect(race.immune).toEqual(['poison'])
    expect(race.vulnerable).toEqual([])
  })

  it('drops a plain list the subrace clears', async () => {
    const race = await load({ resist: null })
    expect(race.resist).toEqual([])
  })

  it('takes the subrace’s own stats, even where it states there are none', async () => {
    const race = await load({ darkvision: null, speed: { walk: 30, fly: 30 } })
    expect(race.darkvision).toBeUndefined()
    expect(race.speed).toEqual({ walk: 30, fly: 30 })
  })

  it('puts the subrace’s traits after the race’s, replacing one it names', async () => {
    const superior = {
      type: 'entries',
      name: 'Superior Darkvision',
      entries: ['120 feet.'],
      data: { overwrite: 'darkvision' },
    }
    const wings = { type: 'entries', name: 'Wings', entries: ['You can fly.'] }
    const lost = {
      type: 'entries',
      name: 'Lost',
      entries: ['Replaces nothing.'],
      data: { overwrite: 'No Such Trait' },
    }
    const race = await load({ entries: [superior, wings, lost, 'A plain line.'] })
    expect(race.entries).toEqual([
      superior,
      tiefling.entries[1],
      wings,
      lost,
      'A plain line.',
    ])
  })
})

describe('lineage rules', () => {
  const anyOf = (weights: number[]) => ({
    fixed: {},
    amounts: weights,
    from: [...ABILITIES],
  })

  it('gives a lineage race its increases and languages', async () => {
    mockFetch.mockResolvedValue({
      race: [
        { name: 'Fairy', source: 'MPMM', lineage: 'VRGR' },
        { name: 'Viashino', source: 'UA', lineage: 'UA1' },
      ],
    })
    const [fairy, viashino] = await loadRaces()
    expect(fairy.abilityOptions).toEqual([anyOf([2, 1]), anyOf([1, 1, 1])])
    expect(fairy.languageProficiencies).toEqual([{ common: true, anyStandard: 1 }])
    expect(viashino.abilityOptions).toEqual([anyOf([2, 1])])
  })

  it('keeps what a lineage race states for itself', async () => {
    mockFetch.mockResolvedValue({
      race: [
        {
          name: 'Custom Lineage',
          source: 'TCE',
          lineage: 'VRGR',
          ability: [{ choose: { from: [...ABILITIES], amount: 2 } }],
          languageProficiencies: [{ common: true, anyStandard: 1, elvish: true }],
        },
      ],
    })
    const [custom] = await loadRaces()
    expect(custom.abilityOptions).toEqual([anyOf([2])])
    expect(custom.languageProficiencies).toEqual([
      { common: true, anyStandard: 1, elvish: true },
    ])
  })

  it('gives languages but no increases under rules it does not know', async () => {
    mockFetch.mockResolvedValue({
      race: [
        { name: 'Marked', source: 'HB', lineage: true },
        { name: 'Odd', source: 'HB', lineage: 'FUTURE' },
      ],
    })
    const [marked, odd] = await loadRaces()
    expect(marked.abilityOptions).toEqual([])
    expect(marked.languageProficiencies).toEqual([{ common: true, anyStandard: 1 }])
    expect(odd.abilityOptions).toEqual([])
  })

  it('leaves a race alone when a copy clears the lineage', async () => {
    mockFetch.mockResolvedValue({
      race: [
        { name: 'Goblin', source: 'MPMM', lineage: 'VRGR', darkvision: 60 },
        {
          name: 'Boggart',
          source: 'LFL',
          _copy: { name: 'Goblin', source: 'MPMM' },
          lineage: null,
        },
      ],
    })
    const races = await loadRaces()
    const boggart = races.find((r) => r.name === 'Boggart')!
    expect(boggart.darkvision).toBe(60)
    expect(boggart.abilityOptions).toEqual([])
    expect(boggart.languageProficiencies).toEqual([])
  })
})

describe('race feat grants and proficiencies', () => {
  it('concatenates base and subrace feat grants and proficiencies', async () => {
    mockFetch.mockResolvedValue({
      race: [
        {
          name: 'Human',
          source: 'PHB',
          feats: [{ any: 1 }],
          weaponProficiencies: [{ 'longsword|phb': true }],
        },
      ],
      subrace: [
        {
          name: 'Variant',
          source: 'PHB',
          raceName: 'Human',
          raceSource: 'PHB',
          feats: [{ any: 1 }],
          armorProficiencies: [{ light: true }],
        },
      ],
    })
    const [variant] = await loadRaces()
    expect(variant.featGrants).toEqual([
      { named: [], categories: 'any' },
      { named: [], categories: 'any' },
    ])
    expect(variant.armorProficiencies).toEqual([{ light: true }])
    expect(variant.weaponProficiencies).toEqual([{ 'longsword|phb': true }])
  })
})

describe('findPlayableRace', () => {
  const race = (name: string, subraceName?: string): PlayableRace => ({
    key: name,
    name,
    baseName: name,
    source: 'PHB',
    subraceName,
    abilityOptions: [],
    featGrants: [],
  })
  const ref = (baseName: string, subraceName?: string) => ({
    name: baseName,
    baseName,
    source: 'PHB',
    subraceName,
    abilityFixed: {},
    abilityChoices: {},
  })

  it('matches base name, source and subrace', () => {
    const elfHigh = race('Elf', 'High')
    const human = race('Human')
    const list = [race('Elf', 'Wood'), elfHigh, human]
    expect(findPlayableRace(list, ref('Elf', 'High'))).toBe(elfHigh)
    expect(findPlayableRace(list, ref('Human'))).toBe(human)
    expect(findPlayableRace(list, ref('Gnome'))).toBeUndefined()
  })

  it('returns undefined without a reference or loaded races', () => {
    expect(findPlayableRace([race('Human')], undefined)).toBeUndefined()
    expect(findPlayableRace(null, ref('Human'))).toBeUndefined()
  })
})
