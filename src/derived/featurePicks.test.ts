import { describe, expect, it } from 'vitest'
import type { LoadedClass } from '../data/class'
import type { ClassOption } from '../data/classOptions'
import { ITEMS, build, deps, loadedClass } from '../test/derivedFixtures'
import { optionCards, cardChoiceWord } from './classOptions'
import { featurePickCards, featurePickWord } from './featurePicks'
import { deriveSheet } from '.'
import { featureRows } from './features'
import { grantBlocks } from './grantBlocks'
import { proficiencies } from './proficiencies'
import { collectSources } from './sources'

const feature = (name: string, level: number, source = 'PHB') => ({
  name,
  source,
  className: 'Ranger',
  classSource: 'PHB',
  level,
  entries: [`${name}.`],
  ...(source === 'TCE' && { isClassFeatureVariant: true }),
})

const ranger = (): LoadedClass =>
  loadedClass('Ranger', [], [], {
    classFeature: [
      feature('Favored Enemy', 1),
      {
        ...feature('Favored Foe', 1, 'TCE'),
        entries: ['{@i optional feature, which replaces the Favored Enemy feature}'],
      },
      feature('Natural Explorer', 1),
      feature('Favored Enemy and Natural Explorer improvements', 6),
      feature('Natural Explorer improvement', 10),
      feature('Favored Enemy improvement', 14),
    ],
  })

const ENEMY = 'class:Ranger|PHB|pick:Favored Enemy'
const TERRAIN = 'class:Ranger|PHB|pick:Natural Explorer'
const HUMANOIDS = `${ENEMY}|humanoids`

const rangerOf = (level: number, classOptions: Record<string, string[]> = {}) => {
  const c = build('Ranger', level, {}, [])
  c.selectedBooks = ['PHB', 'TCE']
  c.classOptions = classOptions
  return c
}

const cards = (level: number, classOptions?: Record<string, string[]>) =>
  featurePickCards(collectSources(rangerOf(level, classOptions), deps([ranger()])))

/** How many languages of favored enemies the grants give. */
const enemyLanguages = (level: number, classOptions?: Record<string, string[]>) =>
  grantBlocks(collectSources(rangerOf(level, classOptions), deps([ranger()])))
    .filter((b) => b.card.tag === 'class:Ranger|PHB|Favored Enemy')
    .flatMap((b) => b.read.alternatives.flatMap((a) => a.picks.map((p) => p.count)))
    .reduce((n, k) => n + k, 0)

describe('favored enemies and terrains', () => {
  it('counts one pick at 1st level and one more at each level the class table says', () => {
    const counts = (level: number) => cards(level).map((c) => [c.tag, c.count])
    expect(counts(1)).toEqual([
      [ENEMY, 1],
      [TERRAIN, 1],
    ])
    expect(counts(6)).toEqual([
      [ENEMY, 2],
      [TERRAIN, 2],
    ])
    expect(counts(10)).toEqual([
      [ENEMY, 2],
      [TERRAIN, 3],
    ])
    expect(counts(14)).toEqual([
      [ENEMY, 3],
      [TERRAIN, 3],
    ])
    expect([1, 6, 14].map((level) => enemyLanguages(level))).toEqual([1, 2, 3])
  })

  it('lists the thirteen creature types and the humanoid pair, and the eight terrains', () => {
    const [enemy, terrain] = cards(1)
    expect(enemy.chips.map((c) => c.label)).toEqual([
      'Aberrations',
      'Beasts',
      'Celestials',
      'Constructs',
      'Dragons',
      'Elementals',
      'Fey',
      'Fiends',
      'Giants',
      'Monstrosities',
      'Oozes',
      'Plants',
      'Undead',
      'Two humanoid races',
    ])
    expect(enemy.label).toBe('Class - Ranger Favored Enemy')
    expect(enemy.chips[0].detail?.entries).toEqual([
      'You have advantage on Wisdom (Survival) checks to track aberrations, and on Intelligence checks to recall information about them.',
    ])
    expect(terrain.chips.map((c) => c.value)).toEqual([
      'arctic',
      'coast',
      'desert',
      'forest',
      'grassland',
      'mountain',
      'swamp',
      'underdark',
    ])
  })

  it('opens a pick of two humanoid races for each humanoid pair taken', () => {
    const picked = cards(14, { [ENEMY]: ['undead', 'humanoids', 'humanoids'] })
    expect(picked.map((c) => c.tag)).toEqual([ENEMY, HUMANOIDS, TERRAIN])
    const [enemy, races] = picked
    expect(enemy).toMatchObject({ used: 3, left: 0 })
    // The pair can be taken again; the chip after the last taken is the next instance.
    expect(enemy.chips.filter((c) => c.value.startsWith('humanoids'))).toMatchObject([
      { label: 'Two humanoid races', state: 'picked', value: 'humanoids' },
      { label: 'Two humanoid races (again)', state: 'picked', value: 'humanoids#2' },
      { label: 'Two humanoid races (again)', state: 'full', value: 'humanoids#3' },
    ])
    expect(races).toMatchObject({ count: 4, left: 4, noun: 'favored humanoid races' })
    expect(races.note).toBe('Two humanoid races: choose 4, 2 for each time it is taken.')
    expect(races.chips.find((c) => c.value === 'gnoll')?.label).toBe('Gnoll')
  })

  it('shows what was taken on the sheet, the humanoid races by name', () => {
    const c = rangerOf(6, {
      [ENEMY]: ['undead', 'humanoids'],
      [HUMANOIDS]: ['gnoll', 'orc'],
      [TERRAIN]: ['forest'],
    })
    const rows = featureRows(collectSources(c, deps([ranger()])))
    const picked = rows.filter((r) => r.id.includes('|pick:'))
    expect(picked.map((r) => r.name)).toEqual([
      'Favored Enemy: Undead, Gnoll, Orc',
      'Natural Explorer: Forest',
    ])
    expect(picked[1].entries[0]).toMatch(/^Forest: In forest terrain/)
  })

  it('has no favored enemy, or its languages, once Favored Foe is taken', () => {
    const options = {
      'class:Ranger|PHB|feature:Favored Foe|1': ['Favored Foe|Ranger|PHB|1'],
    }
    expect(cards(14, options).map((c) => c.tag)).toEqual([TERRAIN])
    expect(enemyLanguages(14, options)).toBe(0)
  })

  it('counts open picks in the checklist words of the list', () => {
    const sources = collectSources(
      rangerOf(1, { [ENEMY]: ['humanoids'] }),
      deps([ranger()]),
    )
    const words = optionCards(sources, deps([ranger()]))
      .filter((card) => card.tag.includes('|pick:'))
      .map((card) => cardChoiceWord(card, sources.optionSlots, sources.featureSlots))
    expect(words).toEqual([
      'favored enemy choice',
      'favored humanoid race choice',
      'natural explorer choice',
    ])
    expect(featurePickWord('class:Ranger|PHB|FS:R')).toBeUndefined()
  })
})

describe('the choices inside a chosen feature or option', () => {
  const kensei = loadedClass('Monk', [], ['simple'], {
    subclassFeature: [
      {
        name: 'Path of the Kensei',
        source: 'XGE',
        className: 'Monk',
        classSource: 'PHB',
        subclassShortName: 'Kensei',
        subclassSource: 'XGE',
        level: 3,
        entries: ['Kensei Weapons.'],
      },
    ],
  })
  const KENSEI = 'class:Monk|PHB|pick:Kensei Weapons'
  const monk = (level: number, picks: string[] = []) => {
    const c = build('Monk', level, {}, [])
    c.classes[0].subclass = { name: 'Kensei', shortName: 'Kensei', source: 'XGE' }
    c.classOptions = { [KENSEI]: picks }
    return collectSources(c, deps([kensei]))
  }

  it('counts kensei weapons by monk level, from the weapons without heavy or special', () => {
    const count = (level: number) =>
      featurePickCards(monk(level), { items: ITEMS })[0]?.count
    expect([2, 3, 6, 11, 17].map(count)).toEqual([undefined, 2, 3, 4, 5])
    const [card] = featurePickCards(monk(3), { items: ITEMS })
    // The title names the subclass already, so only the class goes before it.
    expect(card.label).toBe('Class - Monk Kensei Weapons')
    // Greatsword is heavy; the longbow is heavy but named by the text.
    expect(card.chips.map((c) => c.label)).toEqual([
      'Dagger',
      'Longbow',
      'Longsword',
      'Rapier',
      'Shortsword',
    ])
    expect(card.chips[0].detail?.facts).toEqual([
      { label: 'Weapon', value: 'Simple Melee' },
      { label: 'Damage', value: '1d4 Piercing' },
    ])
  })

  it('makes the monk proficient with the kensei weapons picked', () => {
    const sources = monk(3, ['longsword', 'longbow'])
    const names = proficiencies(sources).weapons.flatMap((w) => w.grant.name ?? [])
    expect(names).toEqual(['longsword', 'longbow'])
    const rows = featureRows(sources, [], ITEMS).filter((r) => r.id === KENSEI)
    expect(rows.map((r) => r.name)).toEqual(['Kensei Weapons: Longbow, Longsword'])
  })

  it('offers an Agonizing Blast one of the known Warlock cantrips, each time it is taken', () => {
    const c = build('Warlock', 5, {}, [])
    c.classes[0].source = 'XPHB'
    c.spells = {
      'Warlock|XPHB': {
        cantrips: [
          { name: 'Eldritch Blast', source: 'XPHB', level: 0 },
          { name: 'Mage Hand', source: 'XPHB', level: 0 },
        ],
        spells: [],
      },
    }
    c.classOptions = {
      'class:Warlock|XPHB|EI': ['Agonizing Blast|XPHB', 'Agonizing Blast|XPHB'],
      'option:Agonizing Blast|XPHB|pick:Agonizing Blast cantrip': ['gone cantrip|xphb'],
    }
    const sources = {
      ...collectSources(c, deps([loadedClass('Warlock', [], [])])),
      options: new Set(['Agonizing Blast|XPHB']),
    }
    const [card] = featurePickCards(sources)
    expect(card).toMatchObject({
      count: 2,
      used: 1,
      label: 'Class - Agonizing Blast cantrip',
    })
    // A cantrip since swapped out still shows, picked, to be taken back.
    expect(card.chips.map((x) => [x.label, x.state])).toEqual([
      ['Eldritch Blast', 'available'],
      ['Mage Hand', 'available'],
      ['Gone Cantrip', 'picked'],
    ])
    // The card goes with the class or feat that took the invocation.
    const slot = (tag: string, kind: 'class' | 'feat', level: number) => ({
      tag: `${tag}|EI`,
      owner: { tag, name: 'Owner', kind, level },
      types: ['EI'],
      title: 'Eldritch Invocations',
      count: 3,
      required: [],
    })
    const ofClass = featurePickCards({
      ...sources,
      optionSlots: [slot('class:Warlock|XPHB', 'class', 5)],
    })[0]
    expect(ofClass).toMatchObject({ owner: 'class:Warlock|XPHB', kind: 'class' })
    const ofFeat = featurePickCards({
      ...sources,
      character: {
        ...c,
        classOptions: { ...c.classOptions, 'feat:adept|EI': ['Agonizing Blast|XPHB'] },
      },
      optionSlots: [slot('feat:adept', 'feat', 4)],
    })[0]
    expect(ofFeat).toMatchObject({
      owner: 'feat:adept',
      kind: 'feat',
      label: 'Feat - Agonizing Blast cantrip',
    })
  })

  it('offers the items of the Replicable Items tables, a higher table flagged', () => {
    const c = build('Artificer', 2, {}, [])
    c.classOptions = { 'class:Artificer|PHB|AI': ['Replicate Magic Item|TCE'] }
    const option: ClassOption = {
      key: 'Replicate Magic Item|TCE',
      name: 'Replicate Magic Item',
      source: 'TCE',
      types: ['AI'],
      entries: [
        {
          type: 'table',
          caption: 'Replicable Items (2nd-Level Artificer)',
          rows: [['{@item Bag of holding}', 'No']],
        },
        {
          type: 'table',
          caption: 'Replicable Items (6th-Level Artificer)',
          rows: [['{@item Cloak of elvenkind}', 'Yes']],
        },
      ],
    }
    const sources = {
      ...collectSources(c, deps([loadedClass('Artificer', [], [])])),
      options: new Set(['Replicate Magic Item|TCE']),
    }
    const [card] = featurePickCards(sources, { catalog: [option] })
    expect(card.chips.map((x) => [x.label, x.unmet])).toEqual([
      ['Bag of holding', undefined],
      ['Cloak of elvenkind', 'Needs class level 6 - allowed with DM approval'],
    ])
    expect(card.chips[1].detail?.facts).toEqual([
      { label: 'Level', value: '6' },
      { label: 'Attunement', value: 'Yes' },
    ])
  })
})

describe('the dragon ancestor of the Draconic sorcerer', () => {
  const draconic = loadedClass('Sorcerer', [], [], {
    subclassFeature: [
      {
        name: 'Dragon Ancestor',
        source: 'PHB',
        className: 'Sorcerer',
        classSource: 'PHB',
        subclassShortName: 'Draconic',
        subclassSource: 'PHB',
        level: 1,
        entries: ['Choose one type of dragon.'],
      },
      {
        name: 'Elemental Affinity',
        source: 'PHB',
        className: 'Sorcerer',
        classSource: 'PHB',
        subclassShortName: 'Draconic',
        subclassSource: 'PHB',
        level: 6,
        entries: ['Add your Charisma modifier.'],
      },
    ],
  })
  const ANCESTOR = 'class:Sorcerer|PHB|pick:Dragon Ancestor'
  const sorcerer = (level: number, picks: string[] = []) => {
    const c = build('Sorcerer', level, {}, [])
    c.classes[0].subclass = { name: 'Draconic', shortName: 'Draconic', source: 'PHB' }
    c.classOptions = { [ANCESTOR]: picks }
    return { c, d: deps([draconic]) }
  }

  it('offers the ten dragons, each with its damage type', () => {
    const { c, d } = sorcerer(1)
    const [card] = featurePickCards(collectSources(c, d))
    expect(card.count).toBe(1)
    expect(card.chips.map((chip) => chip.label)).toEqual([
      'Black',
      'Blue',
      'Brass',
      'Bronze',
      'Copper',
      'Gold',
      'Green',
      'Red',
      'Silver',
      'White',
    ])
    expect(card.chips[1].detail?.facts).toEqual([
      { label: 'Damage type', value: 'Lightning' },
    ])
  })

  it('resists the damage type of the dragon taken for Elemental Affinity', () => {
    const resists = (picks: string[]) => {
      const { c, d } = sorcerer(6, picks)
      return deriveSheet(c, d).defenses.map((r) => [r.label, r.conditional ? 'when' : ''])
    }
    expect(resists([])).toEqual([['The damage type of your draconic ancestry', 'when']])
    expect(resists(['silver'])).toEqual([['Cold', 'when']])
  })
})
