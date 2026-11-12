import { describe, expect, it } from 'vitest'
import { build, deps, featOf, loadedClass } from '../test/derivedFixtures'
import type { PlayableBackground } from '../data/background'
import type { PlayableRace } from '../data/race'
import { featureRows } from './features'
import { collectSources } from './sources'

const fighter = () => {
  const loaded = loadedClass('Fighter', [], [], {
    classFeature: [
      {
        name: 'Second Wind',
        source: 'PHB',
        className: 'Fighter',
        classSource: 'PHB',
        level: 1,
        entries: ['You can heal.'],
      },
      {
        name: 'Action Surge',
        source: 'PHB',
        className: 'Fighter',
        classSource: 'PHB',
        level: 2,
        entries: ['Take an extra action.'],
      },
    ],
  })
  loaded.entry.classFeatures = ['Second Wind|Fighter|PHB|1', 'Action Surge|Fighter|PHB|2']
  return loaded
}

const race: PlayableRace = {
  key: 'dwarf|phb',
  name: 'Dwarf',
  baseName: 'Dwarf',
  source: 'PHB',
  abilityOptions: [],
  featGrants: [],
  entries: [
    'Plain text with no name.',
    { type: 'entries', name: 'Darkvision', entries: ['See in the dark.'] },
    { type: 'entries', name: 'Dwarven Resilience' },
  ],
}

const background: PlayableBackground = {
  key: 'soldier|phb',
  name: 'Soldier',
  source: 'PHB',
  abilityOptions: [],
  featGrants: [],
  storyTables: [],
  entries: [
    {
      type: 'entries',
      name: 'Feature: Military Rank',
      entries: ['You have rank.'],
      data: { isFeature: true },
    },
    { type: 'entries', name: 'Suggested Characteristics', entries: ['Roll a d8.'] },
  ],
}

describe('featureRows', () => {
  it('lists the class features up to the level, with their text', () => {
    const c = build('Fighter', 1, {}, [])
    const rows = featureRows(collectSources(c, deps([fighter()])))
    expect(rows).toEqual([
      expect.objectContaining({
        name: 'Second Wind',
        from: 'Fighter',
        kind: 'Class',
        level: 1,
        entries: ['You can heal.'],
      }),
    ])
    const level2 = build('Fighter', 2, {}, [])
    expect(
      featureRows(collectSources(level2, deps([fighter()]))).map((r) => r.name),
    ).toEqual(['Second Wind', 'Action Surge'])
  })

  it('gives nothing for a class of level 0 or one whose data is not loaded', () => {
    expect(
      featureRows(collectSources(build('Fighter', 0, {}, []), deps([fighter()]))),
    ).toEqual([])
    expect(featureRows(collectSources(build('Fighter', 2, {}, []), deps([])))).toEqual([])
  })

  it('adds the named traits of the species and the background, leaving out those with no text', () => {
    const c = build('Fighter', 1, {}, [])
    const rows = featureRows(
      collectSources(c, { ...deps([fighter()]), race, background }),
    )
    expect(rows.filter((r) => r.kind === 'Species')).toEqual([
      expect.objectContaining({
        name: 'Darkvision',
        from: 'Dwarf',
        entries: ['See in the dark.'],
      }),
    ])
    expect(rows.filter((r) => r.kind === 'Background')).toEqual([
      expect.objectContaining({ name: 'Military Rank', from: 'Soldier' }),
    ])
  })

  it('adds each feat taken', () => {
    const c = build('Fighter', 1, {}, [])
    const sources = collectSources(c, deps([fighter()]))
    const feat = { ...featOf('Alert', 'PHB'), entries: ['You cannot be surprised.'] }
    const rows = featureRows({
      ...sources,
      feats: [{ feat, source: { kind: 'feat', tag: 'feat:one', label: 'Alert' } }],
    })
    expect(rows.at(-1)).toEqual({
      id: 'feat:one',
      name: 'Alert',
      from: 'Feat',
      kind: 'Feat',
      entries: ['You cannot be surprised.'],
    })
  })
})
