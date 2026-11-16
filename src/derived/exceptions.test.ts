import { describe, expect, it } from 'vitest'
import { deriveSheet } from '.'
import { makeBeast } from '../test/beastFixtures'
import {
  build,
  deps,
  featOf,
  FIGHTER,
  ITEMS,
  loadedClass,
  stack,
  WIZARD,
} from '../test/derivedFixtures'
import { makeItem } from '../test/itemFixtures'

const withMulticlass = (name: string, req: Record<string, number>) => {
  const base = name === 'Fighter' ? FIGHTER : WIZARD
  return {
    ...base,
    entry: { ...base.entry, multiclassing: { requirements: req } },
  }
}

const exceptionsOf = (c: ReturnType<typeof build>, extra = deps([FIGHTER, WIZARD])) =>
  deriveSheet(c, extra).exceptions

describe('the rules exceptions of a build', () => {
  it('has none for a build that follows the standard rules', () => {
    expect(exceptionsOf(build('Fighter', 5, { str: 15 }, []))).toEqual([])
  })

  it('flags a total level past 20, to be set in Class & Level', () => {
    expect(exceptionsOf(build('Fighter', 21, {}, []))).toMatchObject([
      { id: 'level-cap', rule: 'Level cap', section: 'class' },
    ])
  })

  it('flags each multiclass prerequisite not met, with the shortfall', () => {
    const c = build('Fighter', 1, { str: 10, int: 10 }, [])
    c.classes = [
      { name: 'Fighter', source: 'PHB', level: 1 },
      { name: 'Wizard', source: 'PHB', level: 1 },
    ]
    const found = exceptionsOf(
      c,
      deps([
        withMulticlass('Fighter', { str: 13 }),
        withMulticlass('Wizard', { int: 13 }),
      ]),
    )
    expect(found.map((e) => e.id)).toEqual([
      'multiclass-req:Fighter|PHB',
      'multiclass-req:Wizard|PHB',
    ])
    expect(found[1]).toMatchObject({
      rule: 'Multiclass prerequisite',
      section: 'class',
      detail: expect.stringContaining('Wizard needs Intelligence 13'),
    })
  })

  it('flags a feat taken twice, to be set in Feats', () => {
    const c = build('Fighter', 4, {}, [])
    c.feats = {
      bonusSlots: ['bonus-a', 'bonus-b'],
      choices: {
        'bonus-a': { kind: 'feat', feat: { name: 'Alert', source: 'PHB' } },
        'bonus-b': { kind: 'feat', feat: { name: 'Alert', source: 'PHB' } },
      },
    }
    const found = exceptionsOf(c, { ...deps([FIGHTER]), feats: [featOf('Alert', 'PHB')] })
    expect(found).toMatchObject([
      { id: 'feat:bonus-b:repeat', rule: 'Feat taken twice', section: 'feats' },
    ])
  })

  it('flags a skill no source of the character gives', () => {
    const c = build('Fighter', 1, {}, [])
    c.grantPicks = { skill: { arcana: 'manual' } }
    expect(exceptionsOf(c)).toMatchObject([
      { id: 'stray:skill:arcana', rule: 'Choice off the list', section: 'skills' },
    ])
  })

  it('flags more items attuned than the limit, to be set in Equipment', () => {
    const attuned = ['Longsword', 'Shield', 'Dagger', 'Longbow'].map((name) =>
      stack(name, { attuned: true }),
    )
    const found = exceptionsOf(build('Fighter', 1, {}, attuned))
    expect(found.find((e) => e.id === 'attunement-limit')).toMatchObject({
      rule: 'Attunement limit',
      section: 'equipment',
      detail: 'Attuned to 4 items; the limit is 3.',
    })
    expect(
      exceptionsOf(build('Fighter', 1, {}, attuned.slice(0, 3))).some(
        (e) => e.id === 'attunement-limit',
      ),
    ).toBe(false)
  })

  it('flags a class-bound item attuned to while it is not equipped', () => {
    const staff = makeItem({
      name: 'Wizard Staff',
      magic: true,
      attunement: { required: true, optional: false, classes: ['wizard'] },
    })
    const bag = deps([FIGHTER], [...ITEMS, staff])
    const mine = stack('Wizard Staff', { equipped: false, attuned: true })
    expect(
      exceptionsOf(build('Fighter', 1, {}, [mine]), bag).find(
        (e) => e.id === 'attune-class:Wizard Staff|PHB',
      ),
    ).toMatchObject({ rule: 'Attunement class requirement', section: 'equipment' })
    expect(
      exceptionsOf(build('Fighter', 1, {}, [{ ...mine, attuned: false }]), bag),
    ).toEqual([])
  })

  it('flags carrying more than the character can carry', () => {
    const anvil = makeItem({ name: 'Anvil', weight: 200 })
    const bag = deps([FIGHTER], [...ITEMS, anvil])
    const load = (quantity: number) =>
      build('Fighter', 1, { str: 10 }, [stack('Anvil', { quantity, equipped: false })])
    expect(exceptionsOf(load(1), bag)).toMatchObject([
      {
        id: 'carrying-capacity',
        rule: 'Carrying capacity',
        section: 'equipment',
        detail: 'Carrying 200 lb; the character can carry 150 lb.',
      },
    ])
    expect(exceptionsOf(build('Fighter', 1, { str: 10 }, []), bag)).toEqual([])
  })

  it('flags more cantrips than the class gets, to be set in Spells', () => {
    const caster = loadedClass('Wizard', [], [])
    caster.entry.casterProgression = 'full'
    caster.entry.cantripProgression = [2]
    caster.entry.spellcastingAbility = 'int'
    const spell = (name: string) => ({ name, source: 'PHB', level: 0 })
    const c = build('Wizard', 1, {}, [])
    c.spells = {
      'Wizard|PHB': { cantrips: [spell('A'), spell('B'), spell('C')], spells: [] },
    }
    expect(exceptionsOf(c, deps([caster]))).toMatchObject([
      {
        id: 'spell-count:Wizard|PHB:cantrips',
        rule: 'More spells than allowed',
        section: 'spells',
        detail: 'Wizard: 3 cantrips chosen, 2 allowed.',
      },
    ])
    c.spells['Wizard|PHB'].cantrips.pop()
    expect(exceptionsOf(c, deps([caster]))).toEqual([])
  })

  it('flags a Wild Shape form beyond the druid limits', () => {
    const druid = loadedClass('Druid', [], [])
    const c = build('Druid', 2, {}, [])
    c.wildShapes = [
      { name: 'Wolf', source: 'MM' },
      { name: 'Giant Eagle', source: 'MM' },
    ]
    const beasts = [
      makeBeast({ name: 'Wolf', crValue: 0.25, cr: '1/4' }),
      makeBeast({ name: 'Giant Eagle', crValue: 1, cr: '1' }),
    ]
    expect(exceptionsOf(c, { ...deps([druid]), beasts })).toMatchObject([
      {
        id: 'wild-shape:Giant Eagle|MM',
        rule: 'Wild Shape form',
        section: 'wildshape',
        detail: 'Giant Eagle: CR 1 is above your limit of 1/4.',
      },
    ])
    expect(exceptionsOf(c, deps([druid]))).toEqual([])
  })
})
