import { beforeEach, describe, expect, it, vi } from 'vitest'
import { findPlayableRace, holdsRace, loadRaces, type PlayableRace } from './race'
import { fetchData } from './dataClient'
import { ABILITIES } from '../dice/dice'
import type { RaceRef } from '../character/model'

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
    baseSource: 'PHB',
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

  it('takes the size chosen of a race of several sizes, and only one of them', () => {
    const lineage = { ...race('Lineage'), size: ['S', 'M'] }
    expect(findPlayableRace([lineage], { ...ref('Lineage'), size: 'S' })).toMatchObject({
      size: ['S'],
      sizeOptions: ['S', 'M'],
    })
    expect(findPlayableRace([lineage], { ...ref('Lineage'), size: 'L' })).toBe(lineage)
  })
})

describe('subraces from other books, and copies of a subrace', () => {
  it('keeps the base race book apart from the subrace book', async () => {
    mockFetch.mockResolvedValue({
      race: [{ name: 'Elf', source: 'PHB', speed: 30 }],
      subrace: [{ name: 'Pallid', source: 'EGW', raceName: 'Elf', raceSource: 'PHB' }],
    })
    const [pallid] = await loadRaces()
    expect(pallid).toMatchObject({ baseName: 'Elf', baseSource: 'PHB', source: 'EGW' })
  })

  it('copies the subrace of the race the copy names, not one of the same name', async () => {
    mockFetch.mockResolvedValue({
      race: [
        { name: 'Goblin', source: 'PSZ', speed: 30 },
        { name: 'Vampire', source: 'PSZ', speed: 30 },
        // A race named like the subrace is not what a subrace copy means.
        { name: 'Ixalan', source: 'PSX', speed: 25 },
      ],
      subrace: [
        {
          name: 'Ixalan',
          source: 'PSX',
          raceName: 'Goblin',
          raceSource: 'PSZ',
          darkvision: 60,
        },
        {
          name: 'Ixalan',
          source: 'PSX',
          raceName: 'Vampire',
          raceSource: 'PSZ',
          darkvision: 120,
        },
        {
          name: 'Copied',
          source: 'TST',
          _copy: {
            name: 'Ixalan',
            source: 'PSX',
            raceName: 'Vampire',
            raceSource: 'PSZ',
          },
        },
      ],
    })
    const copied = (await loadRaces()).find((r) => r.subraceName === 'Copied')
    expect(copied).toMatchObject({
      baseName: 'Vampire',
      baseSource: 'PSZ',
      darkvision: 120,
    })
  })
})

describe('holdsRace', () => {
  const pallid = {
    baseName: 'Elf',
    baseSource: 'PHB',
    source: 'EGW',
    subraceName: 'Pallid',
  }

  it('holds the base race rules for a subrace from another book', () => {
    expect(holdsRace(pallid, { baseName: 'Elf', source: 'PHB' })).toBe(true)
    expect(holdsRace(pallid, { baseName: 'Elf', source: 'EGW' })).toBe(false)
  })

  it('holds a subrace rule by the subrace book and name', () => {
    expect(
      holdsRace(pallid, { baseName: 'Elf', source: 'EGW', subraceName: 'Pallid' }),
    ).toBe(true)
    expect(
      holdsRace(pallid, { baseName: 'Elf', source: 'PHB', subraceName: 'Pallid' }),
    ).toBe(false)
    expect(
      holdsRace(pallid, { baseName: 'Elf', source: 'EGW', subraceName: 'Sea' }),
    ).toBe(false)
  })

  it('reads a saved race without the base book as from the subrace book', () => {
    const saved = { baseName: 'Elf', source: 'PHB', subraceName: 'High' }
    expect(holdsRace(saved, { baseName: 'Elf', source: 'PHB' })).toBe(true)
    expect(holdsRace(saved, { baseName: 'Dwarf', source: 'PHB' })).toBe(false)
    expect(holdsRace(undefined, { baseName: 'Elf', source: 'PHB' })).toBe(false)
  })
})

describe('a race trait with options', () => {
  const lineage = {
    name: 'Custom Lineage',
    source: 'TCE',
    size: ['S', 'M'],
    speed: 30,
    darkvision: 60,
    skillProficiencies: [{ any: 1 }],
    entries: [
      { type: 'entries', name: 'Variable Trait', entries: ['Darkvision or a skill.'] },
    ],
    _versions: [
      {
        name: 'Custom Lineage; Darkvision',
        source: 'TCE',
        _mod: {
          entries: {
            mode: 'replaceArr',
            replace: 'Variable Trait',
            items: {
              name: 'Variable Trait; Darkvision',
              type: 'entries',
              entries: ['Darkvision 60.'],
            },
          },
        },
        skillProficiencies: null,
      },
      {
        name: 'Custom Lineage; Skill Proficiency',
        source: 'TCE',
        _mod: {
          entries: {
            mode: 'replaceArr',
            replace: 'Variable Trait',
            items: {
              name: 'Variable Trait; Skill',
              type: 'entries',
              entries: ['One skill.'],
            },
          },
        },
        darkvision: null,
      },
    ],
  }
  const ref = (trait?: string) => ({
    name: 'Custom Lineage',
    baseName: 'Custom Lineage',
    source: 'TCE',
    abilityFixed: {},
    abilityChoices: {},
    ...(trait ? { trait } : {}),
  })

  it('offers each version as an option, and gives neither before one is taken', async () => {
    mockFetch.mockResolvedValue({ race: [lineage] })
    const [race] = await loadRaces()
    expect(race.traitChoice?.title).toBe('Variable Trait')
    expect(race.traitChoice?.options.map((o) => [o.name, o.text])).toEqual([
      ['Darkvision', ['Darkvision 60.']],
      ['Skill Proficiency', ['One skill.']],
    ])
    expect(race.darkvision).toBeUndefined()
    expect(race.skillProficiencies).toEqual([])
  })

  it('gives what the option taken gives', async () => {
    mockFetch.mockResolvedValue({ race: [lineage] })
    const races = await loadRaces()
    const dark = findPlayableRace(races, ref('Darkvision'))
    expect(dark).toMatchObject({
      darkvision: 60,
      skillProficiencies: [],
      trait: 'Darkvision',
    })
    expect(dark?.traitChoice?.options).toHaveLength(2)
    const skill = findPlayableRace(races, ref('Skill Proficiency'))
    expect(skill?.darkvision).toBeUndefined()
    expect(skill?.skillProficiencies).toEqual([{ any: 1 }])
    expect(findPlayableRace(races, ref())?.trait).toBeUndefined()
  })

  it('takes a lineage that sets spells as an option, with all it gives', async () => {
    mockFetch.mockResolvedValue({
      race: [
        {
          name: 'Elf',
          source: 'XPHB',
          speed: 30,
          darkvision: 60,
          additionalSpells: [
            { name: 'Drow' },
            { name: 'High Elf' },
            { name: 'Wood Elf' },
          ],
          _versions: [
            {
              name: 'Elf; Drow Lineage',
              darkvision: 120,
              additionalSpells: [{ known: {} }],
            },
            { name: 'Elf; High Elf Lineage', additionalSpells: [{ known: {} }] },
            {
              name: 'Elf; Wood Elf Lineage',
              speed: 35,
              additionalSpells: [{ known: {} }],
            },
          ],
        },
      ],
    })
    const races = await loadRaces()
    const [elf] = races
    // Before a lineage is taken: the race's own numbers, and none of the lineage spells.
    expect(elf.traitChoice?.options.map((o) => o.name)).toEqual([
      'Drow Lineage',
      'High Elf Lineage',
      'Wood Elf Lineage',
    ])
    expect(elf.additionalSpells).toBeUndefined()
    expect(elf.darkvision).toBe(60)
    const ref = (trait: string): RaceRef => ({
      name: 'Elf',
      baseName: 'Elf',
      source: 'XPHB',
      abilityFixed: {},
      abilityChoices: {},
      trait,
    })
    const drow = findPlayableRace(races, ref('Drow Lineage'))
    expect(drow?.darkvision).toBe(120)
    // The race's sets of spells stay, the lineage's taken, so a choice keeps its place.
    expect(drow?.additionalSpells).toHaveLength(3)
    expect(drow?.spellSet).toBe('Drow')
    expect(findPlayableRace(races, ref('Wood Elf Lineage'))?.speed).toBe(35)
    // A save from before names the set of spells taken.
    expect(findPlayableRace(races, ref('High Elf'))?.trait).toBe('High Elf Lineage')
  })
})
