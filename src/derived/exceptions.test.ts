import { describe, expect, it } from 'vitest'
import { deriveSheet } from '.'
import { build, deps, featOf, FIGHTER, WIZARD } from '../test/derivedFixtures'
import { stack } from '../test/derivedFixtures'

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
})
