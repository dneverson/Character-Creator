import { describe, expect, it, vi } from 'vitest'
import { dataDir } from '../test/dataAudit'
import { loadRaces } from '../data/race'
import { ensureCharacterDefaults, type RaceRef } from './model'
import { LEGACY_DRAGONS } from './legacyDragon'

vi.mock('../data/dataClient', async () => {
  const { readFileSync: read } = await import('node:fs')
  return {
    fetchData: (path: string): Promise<unknown> =>
      Promise.resolve(JSON.parse(read(`.local/data/${path}`, 'utf8'))),
  }
})

const ref = (baseName: string, source: string, subraceName?: string): RaceRef => ({
  name: baseName,
  baseName,
  baseSource: 'PHB',
  source,
  ...(subraceName ? { subraceName } : {}),
  abilityFixed: {},
  abilityChoices: {},
})

/** A save from before the dragon was a pick: the type was a resist pick of the race. */
const oldSave = (race: RaceRef, type: string, tag = 'race') =>
  ensureCharacterDefaults({ race, grantPicks: { resist: { [type]: tag } } })

// Every damage type of every dragonborn race, and the dragons that have it.
const TYPES: [baseName: string, source: string, baseSource: string, type: string][] = [
  ...['acid', 'lightning', 'fire', 'poison', 'cold'].flatMap((t) =>
    ['PHB', 'XPHB'].map((s): [string, string, string, string] => ['Dragonborn', s, s, t]),
  ),
  ...['acid', 'lightning', 'fire', 'poison', 'cold'].map(
    (t): [string, string, string, string] => ['Dragonborn (Chromatic)', 'FTD', 'FTD', t],
  ),
  ...['acid', 'lightning', 'fire', 'cold'].map((t): [string, string, string, string] => [
    'Dragonborn (Metallic)',
    'FTD',
    'FTD',
    t,
  ]),
  ...['force', 'radiant', 'psychic', 'thunder', 'necrotic'].map(
    (t): [string, string, string, string] => ['Dragonborn (Gem)', 'FTD', 'FTD', t],
  ),
]

describe('an old dragonborn save', () => {
  it.each(TYPES)('%s %s keeps or names its dragon for %s', (name, source, base, type) => {
    const race: RaceRef = { ...ref(name, source), baseSource: base }
    const dragons = LEGACY_DRAGONS[`${name}|${base}`]
    const named = Object.keys(dragons).filter((d) => dragons[d] === type)
    const saved = oldSave(race, type)
    if (named.length === 1) {
      expect(saved.race?.trait).toBe(named[0])
      // The dragon resists the type itself, so the pick goes.
      expect(saved.grantPicks.resist).toEqual({})
    } else {
      expect(named.length).toBeGreaterThan(1)
      expect(saved.race?.trait).toBeUndefined()
      expect(saved.grantPicks.resist).toEqual({ [type]: 'race' })
    }
  })

  it('names the dragon of an EGW subrace by the base race', () => {
    const saved = oldSave(ref('Dragonborn', 'EGW', 'Draconblood'), 'poison')
    expect(saved.race?.trait).toBe('Green')
  })

  it('leaves a race with a dragon, another race, or another source alone', () => {
    const taken = { ...ref('Dragonborn', 'PHB'), trait: 'Gold' }
    expect(oldSave(taken, 'poison').race?.trait).toBe('Gold')
    expect(oldSave(ref('Elf', 'PHB'), 'poison').race?.trait).toBeUndefined()
    expect(oldSave(ref('Dragonborn', 'PHB'), 'poison', 'bg').race?.trait).toBeUndefined()
    expect(ensureCharacterDefaults({}).race).toBeUndefined()
  })

  it('drops the pick of the type its dragon has, and keeps one of another type', () => {
    const red = {
      ...ref('Dragonborn (Chromatic)', 'FTD'),
      baseSource: 'FTD',
      trait: 'Red',
    }
    expect(oldSave(red, 'fire').grantPicks.resist).toEqual({})
    expect(oldSave(red, 'fire').race?.trait).toBe('Red')
    expect(oldSave(red, 'cold').grantPicks.resist).toEqual({ cold: 'race' })
    expect(oldSave({ ...red, trait: 'Purple' }, 'fire').grantPicks.resist).toEqual({
      fire: 'race',
    })
  })

  it('does nothing twice', () => {
    const once = oldSave(ref('Dragonborn', 'PHB'), 'poison')
    expect(ensureCharacterDefaults(once)).toEqual(once)
  })
})

describe.skipIf(!dataDir)('the dragons of an old save against the data', () => {
  it('are the dragons and damage types the races list', async () => {
    const races = await loadRaces()
    for (const [key, dragons] of Object.entries(LEGACY_DRAGONS)) {
      const [baseName, baseSource] = key.split('|')
      const race = races.find(
        (r) => r.baseName === baseName && r.baseSource === baseSource && !r.subraceName,
      )
      const fromData = Object.fromEntries(
        (race?.traitChoice?.options ?? []).map((o) => [
          o.name,
          (o.facts?.[0]?.value ?? '').toLowerCase(),
        ]),
      )
      expect(dragons).toEqual(fromData)
    }
  })
})
