import { describe, expect, it } from 'vitest'
import type { SpellGrant } from '../character/spellGrants'
import type { Item } from '../data/items'
import { ability, byLevel, column, fixed, perLevel, prof } from '../rules/resources'
import { build, deps, featOf, loadedClass } from '../test/derivedFixtures'
import { makeItem } from '../test/itemFixtures'
import { deriveSheet } from '.'
import { featureRows } from './features'
import { countUses, deriveResources, type CountContext } from './resources'
import { collectSources, type Sources } from './sources'

const TOTALS = { str: 10, dex: 14, con: 12, int: 8, wis: 13, cha: 16 }

const ctx = (extra: Partial<CountContext> = {}): CountContext => ({
  totals: TOTALS,
  prof: 3,
  level: 5,
  tables: [],
  ...extra,
})

describe('countUses', () => {
  it('counts a fixed number, the proficiency bonus and an ability modifier', () => {
    expect(countUses(fixed(2), ctx()).max).toBe(2)
    expect(countUses(prof(), ctx())).toEqual({ max: 3, basis: 'Proficiency bonus' })
    expect(countUses(prof(2), ctx()).max).toBe(6)
    expect(countUses(ability('cha'), ctx())).toEqual({
      max: 3,
      basis: 'Charisma modifier, at least 1',
    })
    // Intelligence 8 is -1: never below the minimum.
    expect(countUses(ability('int'), ctx()).max).toBe(1)
    expect(countUses(ability('int', 0), ctx()).max).toBe(0)
    expect(countUses(ability('cha', 1, 1, 1), ctx()).max).toBe(4)
    expect(countUses(ability('cha', 2, 2), ctx()).max).toBe(6)
  })

  it('counts by the class level', () => {
    const surge = byLevel([2, 1], [17, 2])
    expect(countUses(surge, ctx({ level: 1 })).max).toBe(0)
    expect(countUses(surge, ctx({ level: 16 })).max).toBe(1)
    expect(countUses(surge, ctx({ level: 17 }))).toEqual({
      max: 2,
      basis: '1 from class level 2, 2 from class level 17',
    })
    expect(countUses(perLevel(5), ctx()).max).toBe(25)
    expect(countUses(perLevel(1, 1), ctx())).toEqual({
      max: 6,
      basis: '1 + class level (5)',
    })
  })

  it('reads a column of the level table, unlimited where the table says so', () => {
    const rows = Array.from({ length: 20 }, (_, i) => [
      i < 19 ? Math.ceil((i + 1) / 4) : 'Unlimited',
    ])
    const tables = [{ colLabels: ['{@tip Number|Psionic Energy Die Number}'], rows }]
    expect(countUses(column('Number'), ctx({ level: 5, tables }))).toEqual({
      max: 2,
      basis: 'Number column at class level 5',
    })
    expect(countUses(column('Number'), ctx({ level: 20, tables })).max).toBeUndefined()
    expect(countUses(column('Rages'), ctx({ tables })).max).toBe(0)
  })
})

const feature = (name: string, level: number, className = 'Fighter') => ({
  name,
  source: 'PHB',
  className,
  classSource: 'PHB',
  level,
  entries: [`${name} text.`],
})

const fighter = () => {
  const loaded = loadedClass('Fighter', [], [], {
    classFeature: [feature('Second Wind', 1), feature('Action Surge', 2)],
  })
  loaded.entry.classFeatures = ['Second Wind|Fighter|PHB|1', 'Action Surge|Fighter|PHB|2']
  return loaded
}

const bard = () => {
  const loaded = loadedClass('Bard', [], [], {
    classFeature: [
      feature('Bardic Inspiration', 1, 'Bard'),
      feature('Font of Inspiration', 5, 'Bard'),
    ],
  })
  loaded.entry.classFeatures = [
    'Bardic Inspiration|Bard|PHB|1',
    'Font of Inspiration|Bard|PHB|5',
  ]
  return loaded
}

const sourcesOf = (className: string, level: number, loaded = fighter()): Sources =>
  collectSources(build(className, level, { cha: 16 }, []), deps([loaded]))

describe('the counters on the derived sheet', () => {
  it('puts a feature with no row of its own on the row whose text takes it in', () => {
    const sorcerer = loadedClass('Sorcerer', [], [], {
      classFeature: [
        {
          ...feature('Font of Magic', 2, 'Sorcerer'),
          entries: [
            'A wellspring of magic.',
            { type: 'refClassFeature', classFeature: 'Sorcery Points|Sorcerer||2' },
          ],
        },
        feature('Sorcery Points', 2, 'Sorcerer'),
      ],
    })
    sorcerer.entry.classFeatures = ['Font of Magic|Sorcerer|PHB|2']
    sorcerer.entry.classTableGroups = [
      {
        colLabels: ['Sorcery Points'],
        rows: Array.from({ length: 20 }, (_, i) => [i === 0 ? '-' : i + 1]),
      },
    ]
    const sheet = deriveSheet(build('Sorcerer', 3, {}, []), deps([sorcerer]))
    const host = sheet.features.find((f) => f.name === 'Font of Magic')
    expect(host?.nested).toEqual(['class:Sorcerer|PHB#Sorcery Points'])
    expect(sheet.resources).toMatchObject([
      {
        label: 'Sorcery Points',
        max: 3,
        anchor: host?.anchor,
        entries: host?.entries,
      },
    ])
  })
})

describe('deriveResources', () => {
  it('gives a Fighter Second Wind and Action Surge, on the rows of those features', () => {
    const sources = sourcesOf('Fighter', 17)
    const found = deriveResources(sources, [], TOTALS, 6)
    expect(found.map((r) => [r.label, r.max, r.recharge])).toEqual([
      ['Second Wind', 1, 'short'],
      ['Action Surge', 2, 'short'],
    ])
    const anchors = featureRows(sources).map((r) => r.anchor)
    expect(found.every((r) => anchors.includes(r.anchor))).toBe(true)
    expect(found[0]).toMatchObject({
      id: 'use:classFeature|Second Wind|PHB|Fighter#Second Wind',
      from: 'Fighter',
      restores: 'All on a short or long rest',
    })
  })

  it('changes the recharge of Bardic Inspiration once Font of Inspiration is gained', () => {
    const at = (level: number) =>
      deriveResources(sourcesOf('Bard', level, bard()), [], TOTALS, 3)
    expect(at(1)).toMatchObject([
      { label: 'Bardic Inspiration', max: 3, recharge: 'long' },
    ])
    expect(at(5)).toMatchObject([{ label: 'Bardic Inspiration', recharge: 'short' }])
  })

  it('adds the dice of a feat and an option to one counter', () => {
    const sources = sourcesOf('Fighter', 1)
    const pooled = deriveResources(
      {
        ...sources,
        feats: [
          {
            feat: featOf('Martial Adept', 'PHB'),
            source: { kind: 'feat', tag: 'feat:one', label: 'Martial Adept' },
          },
        ],
        options: new Set(['Superior Technique|TCE']),
      },
      [],
      TOTALS,
      2,
    ).find((r) => r.label === 'Superiority Dice')
    expect(pooled).toMatchObject({ max: 2, recharge: 'short' })
    expect(pooled?.basis).toContain('Superior Technique')
  })

  it('counts the free casts of a granted spell, shared by the spells of one list', () => {
    const grant = (name: string, pool: string): SpellGrant => ({
      id: name,
      sourceId: 'race',
      from: 'Tiefling',
      origin: 'race',
      mode: 'innate',
      gate: 0,
      locked: false,
      uses: '1 per long rest',
      spell: { name, source: 'PHB', cantrip: false },
      limit: { count: 1, rest: 'long', pool },
    })
    const found = deriveResources(
      sourcesOf('Fighter', 1),
      [grant('hellish rebuke', 'a'), grant('darkness', 'a'), grant('thaumaturgy', 'b')],
      TOTALS,
      2,
    ).filter((r) => r.kind === 'spell')
    expect(found.map((r) => [r.label, r.max, r.recharge])).toEqual([
      ['hellish rebuke, darkness', 1, 'long'],
      ['thaumaturgy', 1, 'long'],
    ])
  })

  it('counts the charges of an equipped item, restored by hand when they come at dawn', () => {
    const wand = (on: string): Item =>
      makeItem({
        name: `Wand ${on}`,
        source: 'DMG',
        entries: ['A wand.'],
        charges: { max: '7', recharge: 'at dawn', on, amount: '1d6 + 1' },
      })
    const sources = sourcesOf('Fighter', 1)
    const held = (item: Item) => ({
      item,
      stack: { name: item.name, source: 'DMG', quantity: 1 },
      baseName: item.name,
      active: true,
      source: { kind: 'item' as const, tag: `item:${item.key}`, label: item.name },
    })
    const found = deriveResources(
      { ...sources, items: [held(wand('dawn')), held(wand('restLong'))] },
      [],
      TOTALS,
      2,
    ).filter((r) => r.kind === 'item')
    expect(found).toMatchObject([
      { max: 7, recharge: 'none', restores: 'Regains 1d6 + 1 at dawn' },
      { max: 7, recharge: 'long', restores: 'All on a long rest' },
    ])
  })
})
