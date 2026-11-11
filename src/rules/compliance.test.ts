import { describe, expect, it } from 'vitest'
import { checkLevelCap, checkMulticlass, meetsRequirements } from './compliance'
import type { AbilityTotals } from './compliance'
import type { ClassRef } from '../character/model'
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
})

describe('checkLevelCap', () => {
  it('flags totals above 20 only', () => {
    expect(checkLevelCap(20)).toEqual([])
    expect(checkLevelCap(21)).toHaveLength(1)
    expect(checkLevelCap(60)[0].message).toContain('60')
  })
})
