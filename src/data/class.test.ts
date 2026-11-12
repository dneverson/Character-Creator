import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  featuresForClass,
  loadClasses,
  multiclassRequirements,
  resolveClassFeatures,
  resolveSubclassFeatures,
  subclassesFor,
  subclassUnlockLevel,
  type ClassEntry,
  type ClassFile,
  type LoadedClass,
  type SubclassEntry,
} from './class'
import { fetchData } from './dataClient'

vi.mock('./dataClient', () => ({ fetchData: vi.fn() }))
const mockFetch = vi.mocked(fetchData)

// A fixture mirroring the real normalized 5etools class shape.
const file: ClassFile = {
  class: [
    {
      name: 'Barbarian',
      source: 'PHB',
      edition: 'classic',
      hd: { number: 1, faces: 12 },
      proficiency: ['str', 'con'],
      subclassTitle: 'Primal Path',
      classFeatures: [
        'Rage|Barbarian||1',
        'Unarmored Defense|Barbarian||1',
        { classFeature: 'Primal Path|Barbarian||3', gainSubclassFeature: true },
      ],
    },
  ],
  subclass: [
    {
      name: 'Path of the Berserker',
      shortName: 'Berserker',
      source: 'PHB',
      className: 'Barbarian',
      classSource: 'PHB',
      edition: 'classic',
      subclassFeatures: ['Frenzy|Barbarian||Berserker||3'],
    },
    {
      name: 'Path of the Giant',
      shortName: 'Giant',
      source: 'BGG',
      className: 'Barbarian',
      classSource: 'PHB',
      edition: 'classic',
      subclassFeatures: [],
    },
  ],
  classFeature: [
    {
      name: 'Rage',
      source: 'PHB',
      className: 'Barbarian',
      classSource: 'PHB',
      level: 1,
      entries: ['Rage text'],
    },
    {
      name: 'Unarmored Defense',
      source: 'PHB',
      className: 'Barbarian',
      classSource: 'PHB',
      level: 1,
      entries: ['UD text'],
    },
  ],
  subclassFeature: [
    {
      name: 'Frenzy',
      source: 'PHB',
      className: 'Barbarian',
      classSource: 'PHB',
      subclassShortName: 'Berserker',
      subclassSource: 'PHB',
      level: 3,
      entries: ['Frenzy text'],
    },
  ],
}

const loaded: LoadedClass = { entry: file.class![0], file }

describe('resolveClassFeatures', () => {
  it('gives an unresolved copy stub no features and no subclass level', () => {
    const stub: LoadedClass = {
      entry: { ...loaded.entry, classFeatures: undefined },
      file: {},
    }
    expect(resolveClassFeatures(stub).size).toBe(0)
    expect(subclassUnlockLevel(stub)).toBe(1)
  })

  it('resolves refs to feature entries by level', () => {
    const byLevel = resolveClassFeatures(loaded)
    const lvl1 = byLevel.get(1)!
    expect(lvl1.map((f) => f.name)).toEqual(['Rage', 'Unarmored Defense'])
    expect(lvl1[0].entries).toEqual(['Rage text'])
  })
  it('adds a subclass slot marker at the gain level', () => {
    const lvl3 = resolveClassFeatures(loaded).get(3)!
    expect(lvl3[0].isSubclassSlot).toBe(true)
    expect(lvl3[0].name).toContain('Primal Path')
  })

  it('keeps a bare feature when no pool entry matches the ref', () => {
    const orphan: LoadedClass = {
      entry: {
        name: 'Homebrew',
        source: 'HB',
        edition: 'classic',
        hd: { number: 1, faces: 6 },
        proficiency: [],
        classFeatures: ['Ghost Feature|Homebrew||2'],
      },
      file: { classFeature: [] },
    }
    const lvl2 = resolveClassFeatures(orphan).get(2)!
    expect(lvl2).toEqual([{ name: 'Ghost Feature', level: 2, entries: [] }])
  })

  it('labels a subclass slot generically and defaults a malformed ref', () => {
    const noTitle: LoadedClass = {
      entry: {
        name: 'Mystic',
        source: 'HB',
        hd: { number: 1, faces: 8 },
        classFeatures: [
          // No subclassTitle on the entry -> the generic "Subclass" label.
          { classFeature: 'Order|Mystic||2', gainSubclassFeature: true },
          // Blank source and a non-numeric level exercise the ref fallbacks.
          'Ghost|Mystic||nope',
        ],
      },
      file: {},
    }
    const byLevel = resolveClassFeatures(noTitle)
    expect(byLevel.get(2)![0].name).toBe('Subclass Feature')
    // 'nope' is not a number, so the level defaults to 1.
    expect(byLevel.get(1)![0]).toEqual({ name: 'Ghost', level: 1, entries: [] })
  })
})

describe('featuresForClass', () => {
  const barbarian = (
    level: number,
    subclass?: { shortName: string; source: string },
  ) => ({
    name: 'Barbarian',
    source: 'PHB',
    level,
    subclass: subclass && { name: subclass.shortName, ...subclass },
  })

  it('lists class features only up to the class level', () => {
    expect(featuresForClass(loaded, barbarian(1)).map((f) => f.name)).toEqual([
      'Rage',
      'Unarmored Defense',
    ])
  })

  it('keeps the subclass slot while no subclass is chosen', () => {
    const features = featuresForClass(loaded, barbarian(3))
    expect(features.map((f) => f.isSubclassSlot ?? false)).toEqual([false, false, true])
  })

  it('replaces the subclass slot with the chosen subclass features', () => {
    const names = featuresForClass(
      loaded,
      barbarian(3, { shortName: 'Berserker', source: 'PHB' }),
    ).map((f) => f.name)
    expect(names).toEqual(['Rage', 'Unarmored Defense', 'Frenzy'])
  })

  it('keeps the slot when the chosen subclass is not in the data', () => {
    const features = featuresForClass(
      loaded,
      barbarian(3, { shortName: 'Nope', source: 'ZZZ' }),
    )
    expect(features.at(-1)?.isSubclassSlot).toBe(true)
  })
})

describe('resolveSubclassFeatures', () => {
  it('resolves subclass feature refs by level', () => {
    const berserker = file.subclass![0]
    const byLevel = resolveSubclassFeatures(file, berserker)
    expect(byLevel.get(3)![0].name).toBe('Frenzy')
    expect(byLevel.get(3)![0].entries).toEqual(['Frenzy text'])
  })

  it('falls back to the ref name when no pool feature matches', () => {
    const sub: SubclassEntry = {
      name: 'Path of X',
      shortName: 'X',
      source: 'HB',
      className: 'Barbarian',
      classSource: 'PHB',
      edition: 'classic',
      // A single-part ref leaves every later field undefined -> ref fallbacks.
      subclassFeatures: ['Unknown Power'],
    }
    // No subclassFeature array on the file -> empty pool via the ?? fallback.
    const byLevel = resolveSubclassFeatures({}, sub)
    expect(byLevel.get(1)![0]).toEqual({ name: 'Unknown Power', level: 1, entries: [] })
  })
})

describe('subclassesFor', () => {
  it('matches by class name/source and edition', () => {
    const subs = subclassesFor(loaded)
    expect(subs.map((s) => s.shortName)).toEqual(['Berserker', 'Giant'])
  })

  it('handles a missing subclass list and an edition-agnostic entry', () => {
    // No subclass array on the file -> empty result.
    expect(subclassesFor({ entry: loaded.entry, file: {} })).toEqual([])

    // Without an edition on the entry, edition is not used to filter.
    const noEdition: LoadedClass = {
      entry: {
        name: 'Barbarian',
        source: 'PHB',
        hd: { number: 1, faces: 12 },
        classFeatures: [],
      },
      file,
    }
    expect(subclassesFor(noEdition).map((s) => s.shortName)).toEqual([
      'Berserker',
      'Giant',
    ])
  })
})

describe('subclassUnlockLevel', () => {
  it('returns the first level that grants a subclass feature', () => {
    // The Barbarian fixture grants its Primal Path at level 3.
    expect(subclassUnlockLevel(loaded)).toBe(3)
  })

  it('picks the minimum across multiple subclass-feature grants', () => {
    const paladin: LoadedClass = {
      entry: {
        name: 'Paladin',
        source: 'PHB',
        hd: { number: 1, faces: 10 },
        subclassTitle: 'Sacred Oath',
        classFeatures: [
          'Divine Sense|Paladin||1',
          { classFeature: 'Sacred Oath|Paladin||3', gainSubclassFeature: true },
          { classFeature: 'Sacred Oath feature|Paladin||7', gainSubclassFeature: true },
        ],
      },
      file: {},
    }
    expect(subclassUnlockLevel(paladin)).toBe(3)
  })

  it('defaults to 1 when the class carries no subclass-feature marker', () => {
    const noMarker: LoadedClass = {
      entry: {
        name: 'Placeholder',
        source: 'PHB',
        hd: { number: 1, faces: 8 },
        classFeatures: ['Some Feature|Placeholder||1'],
      },
      file: {},
    }
    expect(subclassUnlockLevel(noMarker)).toBe(1)
  })
})

describe('multiclassRequirements', () => {
  const entry = (over: Partial<ClassEntry>): ClassEntry => ({
    name: 'Test',
    source: 'PHB',
    ...over,
  })

  it('reads a 2014 class from its multiclassing requirements', () => {
    expect(
      multiclassRequirements(entry({ multiclassing: { requirements: { wis: 13 } } })),
    ).toEqual({ wis: 13 })
    expect(
      multiclassRequirements(
        entry({ multiclassing: { requirements: { dex: 13, wis: 13 } } }),
      ),
    ).toEqual({ dex: 13, wis: 13 })
  })

  it('reads the abilities of one 2014 "or" group as alternatives', () => {
    // The 2014 Fighter: Strength 13 or Dexterity 13.
    const fighter = entry({
      edition: 'classic',
      multiclassing: { requirements: { or: [{ str: 13, dex: 13 }] } },
    })
    expect(multiclassRequirements(fighter)).toEqual({ or: [{ str: 13 }, { dex: 13 }] })
    // Two groups both apply: one ability of each.
    const both = entry({
      multiclassing: {
        requirements: { cha: 13, or: [{ str: 13, dex: 13 }, { int: 13 }] },
      },
    })
    expect(multiclassRequirements(both)).toEqual({
      cha: 13,
      or: [
        { str: 13, int: 13 },
        { dex: 13, int: 13 },
      ],
    })
  })

  it('needs 13 in the primary ability of a 2024 class', () => {
    const one = (primaryAbility: ClassEntry['primaryAbility']) =>
      multiclassRequirements(entry({ source: 'XPHB', edition: 'one', primaryAbility }))
    expect(one([{ wis: true }])).toEqual({ wis: 13 })
    // Fighter: Strength or Dexterity. Monk: Dexterity and Wisdom.
    expect(one([{ str: true }, { dex: true }])).toEqual({
      or: [{ str: 13 }, { dex: 13 }],
    })
    expect(one([{ dex: true, wis: true }])).toEqual({ dex: 13, wis: 13 })
    expect(one([])).toBeUndefined()
  })

  it('has none for a class with neither', () => {
    expect(multiclassRequirements(entry({ edition: 'classic' }))).toBeUndefined()
    // A primary ability alone does not apply the 2024 rule to a 2014 class.
    expect(
      multiclassRequirements(
        entry({ edition: 'classic', primaryAbility: [{ int: true }] }),
      ),
    ).toBeUndefined()
  })
})

describe('loadClasses', () => {
  beforeEach(() => mockFetch.mockReset())

  it('fetches every indexed file, flattens classes, and sorts by name', async () => {
    mockFetch.mockImplementation((path: string) => {
      if (path === 'class/index.json') {
        return Promise.resolve({
          Wizard: 'class-wizard.json',
          Barbarian: 'class-barbarian.json',
          Empty: 'class-empty.json',
        }) as never
      }
      if (path === 'class/class-wizard.json') {
        return Promise.resolve({ class: [file.class![0]] }) as never
      }
      // A file with no `class` array contributes nothing (the ?? [] fallback).
      if (path === 'class/class-empty.json') {
        return Promise.resolve({}) as never
      }
      return Promise.resolve({
        class: [{ ...file.class![0], name: 'Aardvark' }],
      }) as never
    })
    const classes = await loadClasses()
    expect(classes.map((c) => c.entry.name)).toEqual(['Aardvark', 'Barbarian'])
    expect(mockFetch).toHaveBeenCalledWith('class/index.json')
    expect(mockFetch).toHaveBeenCalledWith('class/class-empty.json')
  })
})
