import { describe, expect, it } from 'vitest'
import type { Character } from '../character/model'
import type { LoadedClass } from '../data/class'
import type { Item } from '../data/itemTypes'
import { deriveSheet } from '.'
import {
  ITEMS,
  build,
  deps,
  featOf,
  item,
  loadedClass,
  stack,
} from '../test/derivedFixtures'
import { cardChoiceWord, optionCards } from './classOptions'
import { collectSources } from './sources'
import { masteryCards, masteredKinds, masterySnapshot } from './weaponMastery'

/** A fixture weapon with a mastery property. */
const mastered = (name: string, mastery: string): Item => {
  const base = item(name)
  const weapon = base.weapon
  if (!weapon) throw new Error(`${name} is not a weapon`)
  return {
    ...base,
    edition: 'one',
    weapon: { ...weapon, mastery: [{ name: mastery, rule: `${mastery} rule.` }] },
  }
}

const ITEMS_WITH_MASTERY: Item[] = [
  mastered('Longsword', 'Sap'),
  mastered('Dagger', 'Nick'),
  mastered('Greatsword', 'Graze'),
  mastered('Longbow', 'Slow'),
  ...ITEMS.filter((i) => i.name === 'Shield'),
]

/** A 2024 class with the Weapon Mastery feature, and the column if it grows. */
function masteryClass(name: string, weapons: string[], column?: string[]): LoadedClass {
  const c = loadedClass(name, [], weapons, {
    classFeature: [
      {
        name: 'Weapon Mastery',
        source: 'XPHB',
        className: name,
        classSource: 'PHB',
        level: 1,
        entries: ['Mastery.'],
      },
    ],
  })
  if (column) {
    c.entry.classTableGroups = [
      { colLabels: ['Weapon Mastery'], rows: column.map((v) => [v]) },
    ]
  }
  return c
}

const levels = (n: number, at: Record<number, string>) =>
  Array.from({ length: n }, (_, i) =>
    Object.entries(at).reduce((v, [lvl, cell]) => (i + 1 >= Number(lvl) ? cell : v), ''),
  )

const FIGHTER = masteryClass(
  'Fighter',
  ['simple', 'martial'],
  levels(20, {
    1: '3',
    4: '4',
    10: '5',
    16: '6',
  }),
)
const BARBARIAN = masteryClass(
  'Barbarian',
  ['simple', 'martial'],
  levels(20, {
    1: '2',
    4: '3',
    10: '4',
  }),
)
const ROGUE = masteryClass('Rogue', ['simple'])

const TAG = (name: string) => `class:${name}|PHB|mastery`

const of = (c: Character, classes: LoadedClass[]) =>
  masteryCards(collectSources(c, deps(classes, ITEMS_WITH_MASTERY)), ITEMS_WITH_MASTERY)

describe('weapon mastery picks', () => {
  it("counts the kinds by the class table's Weapon Mastery column", () => {
    const fighter = (lvl: number) => of(build('Fighter', lvl, {}, []), [FIGHTER])[0].count
    expect([1, 4, 10, 16].map(fighter)).toEqual([3, 4, 5, 6])
    const barbarian = (lvl: number) =>
      of(build('Barbarian', lvl, {}, []), [BARBARIAN])[0].count
    expect([1, 4, 10].map(barbarian)).toEqual([2, 3, 4])
    // Without the column, the number the feature's text names.
    expect(of(build('Rogue', 1, {}, []), [ROGUE])[0]).toMatchObject({
      tag: TAG('Rogue'),
      label: 'Class - Rogue weapon mastery',
      count: 2,
    })
  })

  it('has no card for a class without the feature', () => {
    const fighter = loadedClass('Fighter', [], ['simple', 'martial'])
    expect(of(build('Fighter', 5, {}, []), [fighter])).toEqual([])
  })

  it('offers only the kinds the character qualifies for', () => {
    const [barbarian] = of(build('Barbarian', 1, {}, []), [BARBARIAN])
    expect(barbarian.chips.map((c) => c.label)).toEqual([
      'Dagger',
      'Greatsword',
      'Longsword',
    ])
    const [rogue] = of(build('Rogue', 1, {}, []), [ROGUE])
    expect(rogue.chips.map((c) => c.label)).toEqual(['Dagger'])
    expect(rogue.chips[0].detail).toEqual({
      facts: [
        { label: 'Weapon', value: 'Simple Melee' },
        { label: 'Mastery', value: 'Nick' },
      ],
      entries: ['Nick rule.'],
    })
  })

  it('keeps a picked kind that no longer qualifies, flagged, not refused', () => {
    const c = build('Rogue', 1, {}, [])
    c.classOptions = { [TAG('Rogue')]: ['longsword'] }
    const [rogue] = of(c, [ROGUE])
    expect(rogue.chips.find((chip) => chip.value === 'longsword')).toMatchObject({
      state: 'picked',
      unmet: 'Not proficient with it - allowed with DM approval',
    })
  })

  it('flags a change since the last long rest, more than one for a Fighter', () => {
    const c = build('Fighter', 1, {}, [])
    c.classOptions = { [TAG('Fighter')]: ['dagger', 'greatsword', 'longbow'] }
    const [card] = of(c, [FIGHTER])
    expect(card.note).toBe(
      'Simple or Martial weapons: the mastery property of 3 kinds of weapon. Whenever you finish a Long Rest, you can change one of them.',
    )
    c.play = {
      ...c.play,
      masteryAtRest: { [TAG('Fighter')]: ['longsword', 'longbow', 'dagger'] },
    }
    expect(of(c, [FIGHTER])[0].note).toContain(
      '1 changed since your last Long Rest: the rules make the change when you finish a Long Rest - allowed with DM approval.',
    )
    c.play = {
      ...c.play,
      masteryAtRest: { [TAG('Fighter')]: ['longsword', 'shortsword', 'dagger'] },
    }
    expect(of(c, [FIGHTER])[0].note).toContain(
      '2 changed since your last Long Rest, more than the one allowed',
    )
  })

  it('lists a change since the last long rest among the rules exceptions', () => {
    const c = build('Fighter', 1, {}, [])
    c.classOptions = { [TAG('Fighter')]: ['longsword', 'shortsword', 'dagger'] }
    const d = deps([FIGHTER], ITEMS_WITH_MASTERY)
    expect(deriveSheet(c, d).exceptions).toEqual([])
    c.play = {
      ...c.play,
      masteryAtRest: { [TAG('Fighter')]: ['longsword', 'longbow', 'greatsword'] },
    }
    expect(deriveSheet(c, d).exceptions).toMatchObject([
      {
        id: `mastery-change:${TAG('Fighter')}`,
        rule: 'Weapon mastery change',
        section: 'class',
        detail: expect.stringContaining('2 changed since your last Long Rest, more than'),
      },
    ])
  })

  it('takes a snapshot of the picks at a long rest, and gives a feat its own card', () => {
    const c = build('Rogue', 1, {}, [])
    c.classOptions = { [TAG('Rogue')]: ['dagger'] }
    const d = deps([ROGUE], ITEMS_WITH_MASTERY)
    const sources = {
      ...collectSources(c, d),
      feats: [
        {
          feat: featOf('Weapon Master', 'XPHB'),
          source: {
            kind: 'feat' as const,
            tag: 'feat:Weapon Master',
            label: 'Weapon Master',
          },
        },
      ],
    }
    const cards = masteryCards(sources, ITEMS_WITH_MASTERY)
    expect(cards.map((card) => [card.tag, card.count])).toEqual([
      [TAG('Rogue'), 2],
      ['feat:Weapon Master|mastery', 1],
    ])
    // A kind picked for the class shows as taken on the feat's card.
    expect(cards[1].chips[0]).toMatchObject({
      value: 'dagger',
      state: 'taken',
      takenBy: 'Rogue',
    })
    expect(masterySnapshot(cards)).toEqual({
      [TAG('Rogue')]: ['dagger'],
      'feat:Weapon Master|mastery': [],
    })
    expect([...masteredKinds(sources).keys()]).toEqual(['dagger'])
  })

  it('names the open picks in the checklist', () => {
    const c = build('Fighter', 1, {}, [])
    const d = deps([FIGHTER], ITEMS_WITH_MASTERY)
    const sources = collectSources(c, d)
    const words = optionCards(sources, d)
      .filter((card) => card.tag.endsWith('|mastery'))
      .map((card) => cardChoiceWord(card, sources.optionSlots, sources.featureSlots))
    expect(words).toEqual(['weapon mastery choice'])
  })
})

describe('the mastery property on an attack', () => {
  const attack = (picks: string[]) => {
    const c = build('Fighter', 1, {}, [stack('Longsword'), stack('Dagger')])
    c.classOptions = { [TAG('Fighter')]: picks }
    return deriveSheet(c, deps([FIGHTER], ITEMS_WITH_MASTERY)).attacks
  }

  it('shows only for a kind picked, with its rule in the attack bonus detail', () => {
    const [sword, dagger] = attack(['longsword'])
    expect(sword.mastery).toEqual({ name: 'Sap', rule: 'Sap rule.' })
    expect(sword.toHit.lines.find((l) => l.label === 'Mastery: Sap')).toMatchObject({
      op: 'note',
      how: 'Sap rule.',
      source: { label: 'Fighter' },
    })
    expect(dagger.mastery).toBeUndefined()
    expect(attack([]).every((a) => a.mastery === undefined)).toBe(true)
  })
})
