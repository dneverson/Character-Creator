import { describe, expect, it } from 'vitest'
import { classOptionCards } from './classOptions'
import { collectSources } from './sources'
import type { LoadedClass } from '../data/class'
import type { ClassOption } from '../data/classOptions'
import { build, deps, loadedClass } from '../test/derivedFixtures'

const style = (name: string, ...types: string[]): ClassOption => ({
  key: `${name}|PHB`,
  name,
  source: 'PHB',
  types,
})

const CATALOG = [
  style('Archery', 'FS:F', 'FS:R'),
  style('Defense', 'FS:F', 'FS:P', 'FS:R'),
  style('Dueling', 'FS:F', 'FS:P'),
  style('Blessed Warrior', 'FS:P'),
]

const progression = (type: string, at: Record<string, number>) => [
  { name: 'Fighting Style', featureType: [type], progression: at },
]

const fighter = (): LoadedClass => {
  const base = loadedClass('Fighter', [], [])
  return {
    entry: { ...base.entry, optionalfeatureProgression: progression('FS:F', { '1': 1 }) },
    file: {
      subclass: [
        {
          name: 'Champion',
          shortName: 'Champion',
          source: 'PHB',
          className: 'Fighter',
          classSource: 'PHB',
          subclassFeatures: [],
          optionalfeatureProgression: progression('FS:F', { '10': 1 }),
        },
      ],
    },
  }
}

const paladin = (): LoadedClass => {
  const base = loadedClass('Paladin', [], [])
  return {
    entry: { ...base.entry, optionalfeatureProgression: progression('FS:P', { '2': 1 }) },
    file: {},
  }
}

const cardsOf = (c: ReturnType<typeof build>, classes: LoadedClass[]) =>
  classOptionCards(collectSources(c, deps(classes)), CATALOG)

describe('class option cards', () => {
  it('offers the styles of the class and counts how many it gives at the level', () => {
    const [card] = cardsOf(build('Fighter', 1, {}, []), [fighter()])
    expect(card).toMatchObject({
      tag: 'class:Fighter|PHB|FS:F',
      label: 'Class · Fighter fighting style',
      count: 1,
      left: 1,
      kinds: ['option'],
    })
    expect(card.chips.map((chip) => chip.label)).toEqual([
      'Archery',
      'Defense',
      'Dueling',
    ])
  })

  it('gives nothing before the level and a second pick with the Champion at 10', () => {
    expect(cardsOf(build('Paladin', 1, {}, []), [paladin()])).toEqual([])
    const c = build('Fighter', 10, {}, [])
    expect(cardsOf(c, [fighter()])[0].count).toBe(1)
    c.classes = [
      {
        ...c.classes[0],
        subclass: { name: 'Champion', shortName: 'Champion', source: 'PHB' },
      },
    ]
    expect(cardsOf(c, [fighter()])[0].count).toBe(2)
  })

  it('marks a pick, fills the card and takes the style away from the other class', () => {
    const c = build('Fighter', 1, {}, [])
    c.classes = [...c.classes, { name: 'Paladin', source: 'PHB', level: 2 }]
    c.classOptions = { 'class:Fighter|PHB|FS:F': ['Defense|PHB'] }
    const [f, p] = cardsOf(c, [fighter(), paladin()])
    expect(f).toMatchObject({ used: 1, left: 0, picks: ['Defense|PHB'] })
    expect(f.chips.map((chip) => chip.state)).toEqual(['full', 'picked', 'full'])
    expect(p.label).toBe('Multiclass · Paladin fighting style')
    expect(p.chips.map((chip) => [chip.label, chip.state, chip.takenBy])).toEqual([
      ['Defense', 'taken', 'Fighter'],
      ['Dueling', 'available', undefined],
      ['Blessed Warrior', 'available', undefined],
    ])
  })

  it('holds the option of a class the character has and not of one it left', () => {
    const c = build('Fighter', 1, {}, [])
    c.classOptions = {
      'class:Fighter|PHB|FS:F': ['Defense|PHB'],
      'class:Paladin|PHB|FS:P': ['Dueling|PHB'],
    }
    expect([...collectSources(c, deps([fighter()])).options]).toEqual(['Defense|PHB'])
  })
})
