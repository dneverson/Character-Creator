import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  backgroundToPlayable,
  findBackground,
  loadBackgrounds,
  startingGold,
  type BackgroundEntry,
} from './background'
import { parseAbilityOptions } from './abilityOptions'
import { fetchData } from './dataClient'
import { grantSets, grantText } from './grants'
import type { Entry } from '../text/Entries'

vi.mock('./dataClient', () => ({ fetchData: vi.fn() }))
const mockFetch = vi.mocked(fetchData)

// Mirrors the real Acolyte (PHB 2014) shape.
const acolyte2014: BackgroundEntry = {
  name: 'Acolyte',
  source: 'PHB',
  skillProficiencies: [{ insight: true, religion: true }],
  languageProficiencies: [{ anyStandard: 2 }],
  entries: [{ type: 'entries', name: 'Feature', entries: ['Shelter of the Faithful'] }],
}

// Mirrors the real Acolyte (XPHB 2024) shape: ability options + feat + tool.
const acolyte2024: BackgroundEntry = {
  name: 'Acolyte',
  source: 'XPHB',
  edition: 'one',
  ability: [
    { choose: { weighted: { from: ['int', 'wis', 'cha'], weights: [2, 1] } } },
    { choose: { weighted: { from: ['int', 'wis', 'cha'], weights: [1, 1, 1] } } },
  ],
  feats: [{ 'magic initiate; cleric|xphb': true }],
  skillProficiencies: [{ insight: true, religion: true }],
  toolProficiencies: [{ "calligrapher's supplies": true }],
  startingEquipment: [{ A: [{ value: 800 }], B: [{ value: 5000 }] }],
}

/** A die table as the books print one, rows 1..N. */
function table(label: string, rows: string[], caption?: string): Entry {
  return {
    type: 'table',
    ...(caption !== undefined && { caption }),
    colLabels: [`d${rows.length}`, label],
    rows: rows.map((text, i) => [String(i + 1), text]),
  }
}

const characteristics = (tables: Entry[]): Entry => ({
  type: 'entries',
  name: 'Suggested Characteristics',
  entries: ['Soldiers are shaped by war.', ...tables],
})

const soldier: BackgroundEntry = {
  name: 'Soldier',
  source: 'PHB',
  entries: [
    {
      type: 'entries',
      name: 'Specialty',
      entries: [table('Specialty', ['Officer', 'Scout'])],
    },
    characteristics([
      table('Personality Trait', ['Polite', 'Brave', 'Loud', 'Calm']),
      table('Ideal', ['Greater Good. (Good)', 'Responsibility. (Lawful)']),
      table('Bond', ['My comrades', 'My flag']),
      table('Flaw', ['Fear', 'Rage']),
    ]),
  ],
}

// Mirrors SCAG's City Watch: its characteristics are the Soldier's.
const cityWatch: BackgroundEntry = {
  name: 'City Watch',
  source: 'SCAG',
  entries: [
    {
      type: 'entries',
      name: 'Watch Duty',
      entries: [table('Beat', ['Docks', 'Market'])],
    },
    {
      type: 'entries',
      name: 'Suggested Characteristics',
      entries: [
        "Use the tables for the {@background soldier} background in the Player's Handbook.",
      ],
    },
  ],
}

describe('backgroundToPlayable', () => {
  it('carries the proficiencies as the data lists them, and the edition', () => {
    const bg = backgroundToPlayable(acolyte2014)
    expect(bg.skillProficiencies).toEqual([{ insight: true, religion: true }])
    expect(bg.languageProficiencies).toEqual([{ anyStandard: 2 }])
    expect(bg.toolProficiencies).toEqual([])
    expect(bg.edition).toBeUndefined()
    expect(bg.abilityOptions).toEqual([])
  })

  it('reads 2024 ability options and the feat it grants', () => {
    const bg = backgroundToPlayable(acolyte2024)
    expect(bg.edition).toBe('one')
    expect(bg.abilityOptions).toEqual(parseAbilityOptions(acolyte2024.ability))
    expect(bg.abilityOptions).toHaveLength(2)
    expect(bg.featGrants).toEqual([
      { named: ['magic initiate; cleric|xphb'], categories: [] },
    ])
    expect(bg.startingEquipment).toEqual(acolyte2024.startingEquipment)
  })

  it('keeps languages out of the skills and preserves description entries', () => {
    const bg = backgroundToPlayable(acolyte2014)
    // languageProficiencies must not leak into skills.
    expect(grantText(grantSets(bg.skillProficiencies, 'skill'))).toBe('Insight, Religion')
    expect(bg.entries.length).toBe(1)
    expect(backgroundToPlayable({ name: 'Bare', source: 'HB' }).entries).toEqual([])
  })

  it('gives each die table the story field its rows go in', () => {
    const bg = backgroundToPlayable(soldier)
    expect(bg.storyTables.map((t) => [t.key, t.field, t.count, t.die])).toEqual([
      ['specialty', 'backstory', 1, 2],
      ['personality trait', 'personalityTraits', 2, 4],
      ['ideal', 'ideals', 1, 2],
      ['bond', 'bonds', 1, 2],
      ['flaw', 'flaws', 1, 2],
    ])
    expect(bg.storyTables[1].section).toBe('Suggested Characteristics')
    expect(bg.storyTables[2].rows[1].text).toBe('Responsibility. (Lawful)')
    expect(bg.storyTables.some((t) => t.from !== undefined)).toBe(false)
  })

  it('reads "Trait" and "Contacts" by their label, and keys tables apart', () => {
    const bg = backgroundToPlayable({
      name: 'Azorius Functionary',
      source: 'GGR',
      entries: [
        table('Trait', ['Stern', 'Fair']),
        table('Contact', ['A judge', 'A clerk'], 'Azorius Contacts'),
        table('Contacts', ['A thief', 'A merchant'], 'Azorius Contacts'),
        table('Object or item:', ['A deed', 'A key']),
      ],
    })
    expect(bg.storyTables.map((t) => [t.key, t.field, t.count])).toEqual([
      ['trait', 'personalityTraits', 2],
      ['azorius contacts', 'allies', 1],
      ['azorius contacts 2', 'allies', 1],
      ['object or item', 'backstory', 1],
    ])
  })
})

describe('startingGold', () => {
  it('counts the coin of each way of taking the equipment, in copper', () => {
    // Acolyte PHB: a pouch with 15 gp, and a prayer book or a prayer wheel.
    expect(
      startingGold([
        { _: ['common clothes|phb', { item: 'pouch|phb', containsValue: 1500 }] },
        { a: [{ item: 'book|phb' }], b: [{ special: 'prayer wheel' }] },
      ]),
    ).toEqual([1500])
    // Acolyte XPHB: (A) the kit and 8 gp, or (B) 50 gp.
    expect(startingGold(acolyte2024.startingEquipment)).toEqual([800, 5000])
  })

  it('adds what is given to each alternative, and leaves out what is not coin', () => {
    expect(
      startingGold([
        {
          _: [
            { special: 'jewelry', worthValue: 1000 },
            { item: 'pouch|phb', containsValue: 500 },
            'not a block',
          ],
        },
        { a: [{ value: 100 }], b: [{ value: 200 }] },
        { A: [{ value: 'much' }], B: [{ value: 1 }] },
        null,
      ]),
    ).toEqual([600, 601, 700, 701])
  })

  it('is nothing without equipment', () => {
    expect(startingGold(undefined)).toEqual([])
    expect(startingGold([{ _: 'odd' }])).toEqual([0])
  })
})

describe('loadBackgrounds', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    loadBackgrounds.clear()
  })

  it('resolves copies, converts, and sorts alphabetically', async () => {
    mockFetch.mockResolvedValue({
      background: [
        { name: 'Zealot', source: 'PHB', skillProficiencies: [{ religion: true }] },
        {
          name: 'Apprentice',
          source: 'PHB',
          _copy: { name: 'Zealot', source: 'PHB' },
        },
      ],
    })
    const backgrounds = await loadBackgrounds()
    expect(backgrounds.map((b) => b.name)).toEqual(['Apprentice', 'Zealot'])
    // Apprentice inherits Zealot's skill grant through _copy resolution.
    expect(backgrounds[0].skillProficiencies).toEqual([{ religion: true }])
    expect(mockFetch).toHaveBeenCalledWith('backgrounds.json')
  })

  it('loads once, until cleared', async () => {
    mockFetch.mockResolvedValue({ background: [acolyte2014] })
    const first = await loadBackgrounds()
    expect(await loadBackgrounds()).toBe(first)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    loadBackgrounds.clear()
    await loadBackgrounds()
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('lends a background the characteristic tables its text points to', async () => {
    mockFetch.mockResolvedValue({ background: [soldier, cityWatch] })
    const [watch] = await loadBackgrounds()
    expect(watch.storyTables.map((t) => [t.key, t.field, t.from])).toEqual([
      // Its own other tables stay, and the lender's specialty is not lent.
      ['beat', 'backstory', undefined],
      ['personality trait', 'personalityTraits', 'Soldier'],
      ['ideal', 'ideals', 'Soldier'],
      ['bond', 'bonds', 'Soldier'],
      ['flaw', 'flaws', 'Soldier'],
    ])
  })

  it('finds the lender by the source named, case aside', async () => {
    const pointing = (source: string): BackgroundEntry => ({
      ...cityWatch,
      name: `Watch ${source}`,
      entries: [characteristics([`Use the {@background SOLDIER|${source}} tables.`])],
    })
    mockFetch.mockResolvedValue({
      background: [
        soldier,
        { ...soldier, source: 'HB' },
        pointing('hb'),
        pointing('XGE'),
      ],
    })
    const backgrounds = await loadBackgrounds()
    const tables = (name: string) =>
      backgrounds.find((b) => b.name === name)?.storyTables.map((t) => t.from)
    expect(tables('Watch hb')).toEqual(['Soldier', 'Soldier', 'Soldier', 'Soldier'])
    // A lender that is not loaded lends nothing.
    expect(tables('Watch XGE')).toEqual([])
  })

  it('lends nothing to a background with characteristics of its own', async () => {
    const own: BackgroundEntry = {
      name: 'Haunted',
      source: 'HB',
      entries: [
        characteristics([
          'Use the tables for the {@background soldier} background.',
          table('Flaw', ['Dread', 'Doubt']),
        ]),
      ],
    }
    // Nor when the lender has no characteristics to lend.
    const empty: BackgroundEntry = {
      name: 'Empty',
      source: 'HB',
      entries: [characteristics(['Use the {@background bare|hb} tables.'])],
    }
    mockFetch.mockResolvedValue({
      background: [soldier, own, empty, { name: 'Bare', source: 'HB' }],
    })
    const backgrounds = await loadBackgrounds()
    const keys = (name: string) =>
      backgrounds.find((b) => b.name === name)?.storyTables.map((t) => t.key)
    expect(keys('Haunted')).toEqual(['flaw'])
    expect(keys('Empty')).toEqual([])
  })
})

describe('findBackground', () => {
  it('matches a background reference by name and source', () => {
    const list = [backgroundToPlayable(acolyte2014), backgroundToPlayable(acolyte2024)]
    const ref = { name: 'Acolyte', source: 'XPHB', abilityChoices: {} }
    expect(findBackground(list, ref)).toBe(list[1])
    expect(findBackground(list, { ...ref, source: 'ERLW' })).toBeUndefined()
    expect(findBackground(list, undefined)).toBeUndefined()
    expect(findBackground(undefined, ref)).toBeUndefined()
  })
})
