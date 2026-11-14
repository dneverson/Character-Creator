// The class loader's `_copy` resolution: a reprinted class, subclass or feature is the
// whole of its original under its own name, wherever the original's file is.

import { describe, expect, it } from 'vitest'
import {
  featuresForClass,
  resolveClassFeatures,
  resolveClassFiles,
  resolveSubclassFeatures,
  subclassOf,
  subclassesFor,
  subclassUnlockLevel,
  type RawClassFile,
  type LoadedClass,
} from './class'

// A 2024 class and its subclass, and a book (WoW) that reprints both under another
// name in another file, the way the Priest reprints the Cleric.
const cleric: RawClassFile = {
  class: [
    {
      name: 'Cleric',
      source: 'XPHB',
      edition: 'one',
      hd: { number: 1, faces: 8 },
      classFeatures: [
        'Spellcasting|Cleric|XPHB|1',
        { classFeature: 'Cleric Subclass|Cleric|XPHB|3', gainSubclassFeature: true },
      ],
    },
  ],
  subclass: [
    {
      name: 'Life Domain',
      shortName: 'Life',
      source: 'XPHB',
      className: 'Cleric',
      classSource: 'XPHB',
      edition: 'one',
      subclassFeatures: ['Disciple of Life|Cleric|XPHB|Life|XPHB|3'],
    },
    {
      name: 'Life Domain',
      shortName: 'Life',
      source: 'PHB',
      className: 'Cleric',
      classSource: 'XPHB',
      edition: 'classic',
      subclassFeatures: ['Disciple of Life|Cleric|XPHB|Life||3'],
    },
    {
      // The data marks the 2024 Artificer's subclasses with no edition.
      name: 'Order Domain',
      shortName: 'Order',
      source: 'EFA',
      className: 'Cleric',
      classSource: 'XPHB',
      subclassFeatures: [],
    },
  ],
  classFeature: [
    {
      name: 'Spellcasting',
      source: 'XPHB',
      className: 'Cleric',
      classSource: 'XPHB',
      level: 1,
      entries: ['Cleric spellcasting'],
    },
  ],
  subclassFeature: [
    // The 2014 and 2024 versions share the name and the level.
    {
      name: 'Disciple of Life',
      source: 'PHB',
      className: 'Cleric',
      classSource: 'XPHB',
      subclassShortName: 'Life',
      subclassSource: 'PHB',
      level: 3,
      entries: ['2014 text'],
    },
    {
      name: 'Disciple of Life',
      source: 'XPHB',
      className: 'Cleric',
      classSource: 'XPHB',
      subclassShortName: 'Life',
      subclassSource: 'XPHB',
      level: 3,
      entries: ['2024 text', 'more'],
    },
  ],
}

const priest: RawClassFile = {
  class: [{ name: 'Priest', source: 'WoW', _copy: { name: 'Cleric', source: 'XPHB' } }],
  subclass: [
    {
      name: 'Life Domain',
      shortName: 'Life',
      source: 'WoW',
      className: 'Priest',
      classSource: 'WoW',
      _copy: {
        name: 'Life Domain',
        source: 'XPHB',
        shortName: 'Life',
        className: 'Cleric',
        classSource: 'XPHB',
      },
    },
    {
      name: 'Shadow Domain',
      shortName: 'Shadow',
      source: 'WoW',
      className: 'Priest',
      classSource: 'WoW',
      subclassFeatures: ['Shadow Domain|Priest|WoW|Shadow|WoW|3'],
    },
    {
      // The original is not in the data: only the copy's own fields remain.
      name: 'Lost Domain',
      shortName: 'Lost',
      source: 'WoW',
      className: 'Priest',
      classSource: 'WoW',
      _copy: { name: 'Lost Domain', source: 'NONE', className: 'Cleric' },
    },
  ],
  subclassFeature: [
    {
      // A feature that copies another and changes its text.
      name: 'Shadow Domain',
      source: 'WoW',
      className: 'Priest',
      classSource: 'WoW',
      subclassShortName: 'Shadow',
      subclassSource: 'WoW',
      level: 3,
      _copy: {
        name: 'Disciple of Life',
        source: 'XPHB',
        className: 'Cleric',
        classSource: 'XPHB',
        subclassShortName: 'Life',
        subclassSource: 'XPHB',
        level: 3,
        _mod: { entries: { mode: 'replaceArr', replace: { index: 0 }, items: 'Shadow' } },
      },
    },
    {
      // A copy of a feature not in the data has no text.
      name: 'Gone',
      source: 'WoW',
      className: 'Priest',
      classSource: 'WoW',
      subclassShortName: 'Shadow',
      subclassSource: 'WoW',
      level: 6,
      _copy: { name: 'Gone', source: 'NONE' },
    },
  ],
}

const [clericFile, priestFile] = resolveClassFiles([cleric, priest])
const loadedPriest: LoadedClass = { entry: priestFile.class![0], file: priestFile }
const loadedCleric: LoadedClass = { entry: clericFile.class![0], file: clericFile }

describe('resolveClassFiles', () => {
  it('gives a reprinted class the whole of its original, under its own name', () => {
    const entry = priestFile.class![0]
    expect(entry).toMatchObject({ name: 'Priest', source: 'WoW', edition: 'one' })
    expect(entry.hd).toEqual({ number: 1, faces: 8 })
    expect(entry._copy).toBeUndefined()
    // The original's features live in the other file and come along.
    expect(resolveClassFeatures(loadedPriest).get(1)![0].entries).toEqual([
      'Cleric spellcasting',
    ])
    expect(subclassUnlockLevel(loadedPriest)).toBe(3)
  })

  it('offers the reprinted subclass with the features of its original', () => {
    expect(subclassesFor(loadedPriest).map((s) => s.shortName)).toEqual([
      'Life',
      'Shadow',
      'Lost',
    ])
    const features = featuresForClass(loadedPriest, {
      name: 'Priest',
      source: 'WoW',
      level: 3,
      subclass: { name: 'Life Domain', shortName: 'Life', source: 'WoW' },
    })
    expect(features.at(-1)).toEqual({
      name: 'Disciple of Life',
      level: 3,
      entries: ['2024 text', 'more'],
    })
  })

  it('resolves a feature that copies another, and one whose original is missing', () => {
    const shadow = subclassesFor(loadedPriest)[1]
    expect(resolveSubclassFeatures(priestFile, shadow).get(3)![0].entries).toEqual([
      'Shadow',
      'more',
    ])
    const gone = priestFile.subclassFeature!.find((f) => f.name === 'Gone')
    expect(gone?.entries).toEqual([])
  })

  it('keeps a subclass whose original is missing, with no features', () => {
    expect(subclassesFor(loadedPriest)[2].subclassFeatures).toEqual([])
  })

  it('tells the 2014 and 2024 features of a subclass apart', () => {
    const [life2024, life2014] = clericFile.subclass!
    expect(resolveSubclassFeatures(clericFile, life2024).get(3)![0].entries[0]).toBe(
      '2024 text',
    )
    expect(resolveSubclassFeatures(clericFile, life2014).get(3)![0].entries[0]).toBe(
      '2014 text',
    )
  })

  it('leaves the given files unchanged', () => {
    expect(priest.class![0]._copy).toBeDefined()
    expect(priest.subclass![0].subclassFeatures).toBeUndefined()
  })

  it('keeps a file with no records as it is', () => {
    expect(resolveClassFiles([{}])).toEqual([{}])
  })
})

describe('subclassesFor and subclassOf', () => {
  it('offers a subclass with no edition, but not one marked for the other edition', () => {
    expect(subclassesFor(loadedCleric).map((s) => `${s.shortName}|${s.source}`)).toEqual([
      'Life|XPHB',
      'Order|EFA',
    ])
  })

  it('finds the chosen subclass among those the class offers', () => {
    expect(subclassOf(loadedCleric, { shortName: 'Life', source: 'XPHB' })?.edition).toBe(
      'one',
    )
    // The 2014 Life Domain is listed under the 2024 class, but not offered by it.
    expect(subclassOf(loadedCleric, { shortName: 'Life', source: 'PHB' })).toBeUndefined()
    expect(subclassOf(loadedCleric, undefined)).toBeUndefined()
  })
})
