import { describe, expect, it } from 'vitest'
import { checkLevelCap, checkMulticlass, meetsRequirements } from './compliance'
import type { AbilityTotals } from './compliance'
import type { ClassRef } from '../character/model'
import type { AbilityKey } from '../dice/dice'
import type { MulticlassRequirements } from '../data/class'

const totals = (over: Partial<AbilityTotals> = {}): AbilityTotals => ({
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
  ...over,
})

describe('meetsRequirements', () => {
  it('passes when direct minimums are met', () => {
    expect(meetsRequirements({ str: 13 }, totals({ str: 15 }))).toBe(true)
    expect(meetsRequirements({ str: 13 }, totals({ str: 12 }))).toBe(false)
  })
  it('handles "or" branches', () => {
    const req: MulticlassRequirements = { or: [{ str: 13 }, { dex: 13 }] }
    expect(meetsRequirements(req, totals({ dex: 13 }))).toBe(true)
    expect(meetsRequirements(req, totals())).toBe(false)
  })
  it('treats undefined requirements as met', () => {
    expect(meetsRequirements(undefined, totals())).toBe(true)
  })
})

describe('checkMulticlass', () => {
  const classes: ClassRef[] = [
    { name: 'Barbarian', source: 'PHB', level: 1 },
    { name: 'Wizard', source: 'PHB', level: 1 },
  ]
  const reqs = new Map<string, MulticlassRequirements | undefined>([
    ['Barbarian|PHB', { str: 13 }],
    ['Wizard|PHB', { int: 13 }],
  ])

  it('flags each unmet requirement but never for a single class', () => {
    expect(checkMulticlass([classes[0]], reqs, totals())).toEqual([])
    const devs = checkMulticlass(classes, reqs, totals({ str: 15 }))
    // STR met, INT not.
    expect(devs).toHaveLength(1)
    expect(devs[0].category).toBe('multiclass-req')
    expect(devs[0].message).toContain('Wizard')
  })

  it('no deviations when all requirements met', () => {
    expect(checkMulticlass(classes, reqs, totals({ str: 15, int: 15 }))).toEqual([])
  })

  it('describes an unmet "or"-branched requirement in the message', () => {
    const orReqs = new Map<string, MulticlassRequirements | undefined>([
      ['Fighter|PHB', { or: [{ str: 13 }, { dex: 13 }] }],
      ['Wizard|PHB', { int: 13 }],
    ])
    const orClasses: ClassRef[] = [
      { name: 'Fighter', source: 'PHB', level: 1 },
      { name: 'Wizard', source: 'PHB', level: 1 },
    ]
    const devs = checkMulticlass(orClasses, orReqs, totals({ int: 15 }))
    // Fighter's STR-or-DEX prerequisite is unmet and must be spelled out.
    expect(devs).toHaveLength(1)
    expect(devs[0].message).toContain('Strength 13 or Dexterity 13')
  })

  it('names the class, the ability, the score needed and the score had', () => {
    const devs = checkMulticlass(classes, reqs, totals({ str: 15, int: 12 }))
    expect(devs.map((d) => d.message)).toEqual([
      'Wizard needs Intelligence 13 to multiclass, you have 12 - allowed with DM approval.',
    ])
  })

  it('says an unassigned ability is not set yet rather than short', () => {
    const devs = checkMulticlass(
      classes,
      reqs,
      totals({ int: 1 }),
      new Set(['str', 'int']),
    )
    expect(devs.map((d) => d.message)).toEqual([
      'Barbarian needs Strength 13 to multiclass, Strength is not set yet - allowed with DM approval.',
      'Wizard needs Intelligence 13 to multiclass, Intelligence is not set yet - allowed with DM approval.',
    ])
    // An unassigned ability never counts as met, whatever its bonuses add up to.
    expect(
      checkMulticlass(classes, reqs, totals({ str: 15, int: 15 }), new Set(['int'])),
    ).toHaveLength(1)
    // An unassigned ability a requirement does not name raises nothing.
    expect(
      checkMulticlass(classes, reqs, totals({ str: 15, int: 15 }), new Set(['cha'])),
    ).toEqual([])
  })

  describe('2024 primary abilities', () => {
    // As multiclassRequirements reads the 2024 Fighter, Monk and Bard.
    const reqs2024 = new Map<string, MulticlassRequirements | undefined>([
      ['Fighter|XPHB', { or: [{ str: 13 }, { dex: 13 }] }],
      ['Monk|XPHB', { dex: 13, wis: 13 }],
      ['Bard|XPHB', { cha: 13 }],
      ['Druid|PHB', { wis: 13 }],
    ])
    const ref = (key: string): ClassRef => {
      const [name, source] = key.split('|')
      return { name, source, level: 1 }
    }
    const check = (
      keys: string[],
      over: Partial<AbilityTotals>,
      unset?: Set<AbilityKey>,
    ) =>
      checkMulticlass(keys.map(ref), reqs2024, totals(over), unset).map((d) => d.message)

    it('takes either of the Fighter primary abilities', () => {
      expect(check(['Fighter|XPHB', 'Monk|XPHB'], { str: 13, dex: 13, wis: 13 })).toEqual(
        [],
      )
      expect(check(['Fighter|XPHB', 'Bard|XPHB'], { dex: 14, cha: 13 })).toEqual([])
      expect(check(['Fighter|XPHB', 'Bard|XPHB'], { dex: 12, cha: 13 })).toEqual([
        'Fighter needs Strength 13 or Dexterity 13 to multiclass, you have Strength 10 and Dexterity 12 - allowed with DM approval.',
      ])
    })

    it('needs both Monk primary abilities', () => {
      expect(check(['Monk|XPHB', 'Bard|XPHB'], { dex: 15, wis: 12, cha: 13 })).toEqual([
        'Monk needs Dexterity 13 and Wisdom 13 to multiclass, you have Wisdom 12 - allowed with DM approval.',
      ])
      expect(
        check(
          ['Monk|XPHB', 'Bard|XPHB'],
          { dex: 12, cha: 13 },
          new Set<AbilityKey>(['wis']),
        ),
      ).toEqual([
        'Monk needs Dexterity 13 and Wisdom 13 to multiclass, you have Dexterity 12; Wisdom is not set yet - allowed with DM approval.',
      ])
    })

    it('checks every class of mixed editions, in either order', () => {
      const flagged =
        'Bard needs Charisma 13 to multiclass, you have 12 - allowed with DM approval.'
      for (const keys of [
        ['Druid|PHB', 'Bard|XPHB'],
        ['Bard|XPHB', 'Druid|PHB'],
      ]) {
        expect(check(keys, { wis: 13, cha: 12 })).toEqual([flagged])
        expect(check(keys, { wis: 13, cha: 13 })).toEqual([])
        expect(check(keys, { wis: 12, cha: 13 })).toEqual([
          'Druid needs Wisdom 13 to multiclass, you have 12 - allowed with DM approval.',
        ])
      }
    })
  })
})

describe('checkLevelCap', () => {
  it('flags totals above 20 only', () => {
    expect(checkLevelCap(20)).toEqual([])
    expect(checkLevelCap(21)).toHaveLength(1)
    expect(checkLevelCap(60)[0].message).toContain('60')
  })
})
