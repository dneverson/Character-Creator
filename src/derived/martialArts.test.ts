// Monk weapons in the attack math (Martial Arts), and the picks that make more weapons
// monk weapons or give a weapon's proficiency: kensei weapons, a dedicated weapon, a
// bladesinger's weapon.

import { describe, expect, it } from 'vitest'
import type { Character } from '../character/model'
import type { LoadedClass } from '../data/class'
import { ITEMS, build, deps, loadedClass, stack } from '../test/derivedFixtures'
import { featurePickCards } from './featurePicks'
import { deriveSheet } from './index'
import { collectSources } from './sources'

const die = (faces: number) => [{ type: 'dice', toRoll: [{ number: 1, faces }] }]

/** A Monk of a printing: a d4 Martial Arts die to 4th level and a d6 from 5th. */
function monkClass(source: 'PHB' | 'XPHB', extra: Partial<LoadedClass['file']> = {}) {
  const monk = loadedClass('Monk', [], ['simple', 'shortsword'], extra)
  monk.entry.source = source
  monk.entry.classTableGroups = [
    {
      colLabels: ['Martial Arts'],
      rows: Array.from({ length: 20 }, (_, i) => die(i < 4 ? 4 : 6)),
    },
  ]
  return monk
}

const monkOf = (
  level: number,
  stacks: ReturnType<typeof stack>[],
  source: 'PHB' | 'XPHB' = 'PHB',
  extra: Partial<Character> = {},
) => {
  const c = build('Monk', level, { str: 10, dex: 16 }, stacks)
  c.classes = [{ name: 'Monk', source, level, ...(extra.classes?.[0] ?? {}) }]
  c.selectedBooks = ['PHB', 'XPHB', 'XGE', 'TCE']
  c.classOptions = extra.classOptions ?? {}
  return c
}

const attack = (c: Character, cls: LoadedClass, name: string) =>
  deriveSheet(c, deps([cls])).attacks.find((a) => a.name === name)

describe('monk weapons', () => {
  it('uses Dexterity and the Martial Arts die with a 2014 monk weapon', () => {
    const dagger = attack(monkOf(5, [stack('Dagger')]), monkClass('PHB'), 'Dagger')
    expect(dagger?.damage.dice).toBe('1d6')
    expect(dagger?.toHit.lines[0]).toMatchObject({ label: 'Dexterity', amount: 3 })
    expect(
      dagger?.notes.some((n) => n.includes('the damage die is d6 in place of 1d4')),
    ).toBe(true)
    const shortsword = attack(
      monkOf(5, [stack('Shortsword')]),
      monkClass('PHB'),
      'Shortsword',
    )
    expect(shortsword?.damage.dice).toBe('1d6')
    expect(shortsword?.damage.bonus.lines[0]).toMatchObject({
      label: 'Dexterity',
      amount: 3,
    })
  })

  it('leaves a weapon that is not a monk weapon as it is', () => {
    const sword = attack(monkOf(5, [stack('Longsword')]), monkClass('PHB'), 'Longsword')
    expect(sword?.damage.dice).toBe('1d8')
    expect(sword?.toHit.lines[0]).toMatchObject({ label: 'Strength' })
    expect(sword?.notes.some((n) => n.startsWith('Martial Arts'))).toBe(false)
  })

  it('takes a martial weapon with the Light property under the 2024 rules', () => {
    const shortsword = attack(
      monkOf(5, [stack('Shortsword')], 'XPHB'),
      monkClass('XPHB'),
      'Shortsword',
    )
    expect(shortsword?.toHit.lines[0]).toMatchObject({ label: 'Dexterity' })
    const rapier = attack(
      monkOf(5, [stack('Rapier')], 'XPHB'),
      monkClass('XPHB'),
      'Rapier',
    )
    expect(rapier?.notes.some((n) => n.startsWith('Martial Arts'))).toBe(false)
  })

  it('turns Martial Arts off while the monk wears armor or a shield', () => {
    const dagger = attack(
      monkOf(5, [stack('Dagger'), stack('Shield')]),
      monkClass('PHB'),
      'Dagger',
    )
    expect(dagger?.damage.dice).toBe('1d4')
    expect(dagger?.notes).toContain(
      'Martial Arts: not while you wear armor or wield a shield (Shield).',
    )
  })
})

const KENSEI = 'class:Monk|PHB|pick:Kensei Weapons'

const kenseiClass = () =>
  monkClass('PHB', {
    subclassFeature: [
      {
        name: 'Path of the Kensei',
        source: 'XGE',
        className: 'Monk',
        classSource: 'PHB',
        subclassShortName: 'Kensei',
        subclassSource: 'XGE',
        level: 3,
        entries: [],
      },
    ],
  })

const kenseiOf = (level: number, picks: string[], stacks = [stack('Longsword')]) =>
  monkOf(level, stacks, 'PHB', {
    classes: [
      {
        name: 'Monk',
        source: 'PHB',
        level,
        subclass: { name: 'Way of the Kensei', shortName: 'Kensei', source: 'XGE' },
      },
    ],
    classOptions: { [KENSEI]: picks },
  })

const kenseiCard = (c: Character) => {
  const d = deps([kenseiClass()])
  return featurePickCards(collectSources(c, d), { items: ITEMS }).find((card) =>
    card.tag.endsWith('|pick:Kensei Weapons'),
  )
}

describe('kensei weapons', () => {
  it('makes a kensei weapon a monk weapon, with its own die when that is higher', () => {
    const sword = attack(
      kenseiOf(5, ['longsword', 'longbow']),
      kenseiClass(),
      'Longsword',
    )
    expect(sword?.toHit.lines[0]).toMatchObject({ label: 'Dexterity', amount: 3 })
    expect(sword?.damage.dice).toBe('1d8')
    expect(sword?.notes).toContain('Martial Arts: Kensei Weapons: a monk weapon for you.')
  })

  it('flags a second melee weapon at 3rd level, before a ranged one', () => {
    const card = kenseiCard(kenseiOf(3, ['longsword']))
    expect(card?.tag).toBe(KENSEI)
    const unmet = (name: string) => card?.chips.find((c) => c.label === name)?.unmet
    const why =
      'The kensei weapons of 3rd level are one melee and one ranged weapon - allowed with DM approval'
    expect(unmet('Rapier')).toBe(why)
    expect(unmet('Longbow')).toBeUndefined()
    // With a pick left over at 6th level, either kind is fine.
    const later = kenseiCard(kenseiOf(6, ['longsword']))
    expect(later?.chips.find((c) => c.label === 'Rapier')?.unmet).toBeUndefined()
  })
})

describe('a dedicated weapon', () => {
  const DEDICATED = 'class:Monk|PHB|pick:Dedicated weapon'
  const dedicatedClass = () =>
    monkClass('PHB', {
      classFeature: [
        {
          name: 'Dedicated Weapon',
          source: 'TCE',
          className: 'Monk',
          classSource: 'PHB',
          level: 2,
          entries: [],
          isClassFeatureVariant: true,
        },
      ],
    })
  const dedicatedOf = (picks: string[]) => {
    return monkOf(5, [stack('Longsword'), stack('Greatsword')], 'PHB', {
      classOptions: {
        'class:Monk|PHB|feature:Dedicated Weapon|2': ['Dedicated Weapon|Monk|PHB|2'],
        [DEDICATED]: picks,
      },
    })
  }

  it('offers the weapons without the heavy and special properties', () => {
    const c = dedicatedOf([])
    const d = deps([dedicatedClass()])
    const sources = collectSources(c, d)
    const card = featurePickCards(sources, { items: ITEMS }).find(
      (x) => x.tag === DEDICATED,
    )
    expect(card?.chips.map((x) => x.value)).toEqual(['longsword|phb'])
  })

  it('makes the dedicated weapon a monk weapon only while proficient with it', () => {
    const sword = attack(dedicatedOf(['longsword|phb']), dedicatedClass(), 'Longsword')
    expect(sword?.notes).toContain(
      'Dedicated weapon: you are not proficient with it, so it is not a monk weapon.',
    )
    expect(sword?.toHit.lines[0]).toMatchObject({ label: 'Strength' })
  })
})

describe("a bladesinger's weapon", () => {
  const wizard = loadedClass('Wizard', [], ['dagger'], {
    subclassFeature: [
      {
        name: 'Training in War and Song (Bladesinging)',
        source: 'TCE',
        className: 'Wizard',
        classSource: 'PHB',
        subclassShortName: 'Bladesinging',
        subclassSource: 'TCE',
        level: 2,
        entries: [],
      },
    ],
  })
  const bladesinger = (picks: string[]) => {
    const c = build('Wizard', 2, {}, [stack('Rapier')])
    c.classes = [
      {
        name: 'Wizard',
        source: 'PHB',
        level: 2,
        subclass: { name: 'Bladesinging', shortName: 'Bladesinging', source: 'TCE' },
      },
    ]
    c.selectedBooks = ['PHB', 'TCE']
    c.classOptions = { 'class:Wizard|PHB|pick:Bladesinging weapon': picks }
    return c
  }

  it('offers one-handed melee weapons only', () => {
    const d = deps([wizard])
    const card = featurePickCards(collectSources(bladesinger([]), d), {
      items: ITEMS,
    }).find((x) => x.tag.endsWith('|pick:Bladesinging weapon'))
    expect(card?.count).toBe(1)
    expect(card?.chips.map((x) => x.value)).toEqual([
      'dagger',
      'longsword',
      'rapier',
      'shortsword',
    ])
  })

  it('makes the bladesinger proficient with the weapon picked', () => {
    const rapier = (picks: string[]) =>
      deriveSheet(bladesinger(picks), deps([wizard])).attacks.find(
        (a) => a.name === 'Rapier',
      )
    expect(rapier([])?.toHit.lines.some((l) => l.status === 'flag')).toBe(true)
    expect(
      rapier(['rapier'])?.toHit.lines.find((l) => l.label === 'Proficiency bonus'),
    ).toBeTruthy()
  })
})

describe('kensei weapons picked against the rule', () => {
  it('flags the picks made once no pick is left to mend them', () => {
    const card = kenseiCard(kenseiOf(3, ['longsword', 'rapier']))
    expect(card?.chips.find((c) => c.label === 'Longsword')?.unmet).toMatch(/^The kensei/)
    const open = kenseiCard(kenseiOf(3, ['longsword']))
    expect(open?.chips.find((c) => c.label === 'Longsword')?.unmet).toBeUndefined()
  })
})
