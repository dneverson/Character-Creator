import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { dataDir, records, textOf } from '../test/dataAudit'
import { REST_RULES, type RestEffect } from './restRules'

const kinds = (effects: readonly RestEffect[]) => effects.map((e) => e.kind)

const find = <K extends RestEffect['kind']>(effects: readonly RestEffect[], kind: K) =>
  effects.find((e): e is Extract<RestEffect, { kind: K }> => e.kind === kind)

describe('rest rules', () => {
  it('has each effect once per rest, with its words and where the rule is written', () => {
    for (const rules of Object.values(REST_RULES)) {
      for (const effects of [rules.short, rules.long]) {
        expect(new Set(kinds(effects)).size).toBe(effects.length)
        for (const e of effects) {
          expect(e.text).not.toBe('')
          expect(e.ruleRef).not.toBe('')
        }
      }
    }
  })

  it('keeps the differences between the editions in the table', () => {
    expect(find(REST_RULES.classic.short, 'spendHitDice')?.minimumPerDie).toBe(0)
    expect(find(REST_RULES.one.short, 'spendHitDice')?.minimumPerDie).toBe(1)
    expect(find(REST_RULES.classic.long, 'regainHitDice')).toMatchObject({
      portion: 'half',
      minimum: 1,
    })
    expect(find(REST_RULES.one.long, 'regainHitDice')?.portion).toBe('all')
    expect(find(REST_RULES.classic.short, 'requiresHp')).toBeUndefined()
    expect(find(REST_RULES.one.short, 'requiresHp')).toBeDefined()
    for (const rules of Object.values(REST_RULES)) {
      expect(find(rules.short, 'restoreSlots')?.which).toEqual(['pact'])
      expect(find(rules.long, 'restoreSlots')?.which).toEqual(['standard', 'pact'])
      expect(find(rules.long, 'endTempHp')).toBeDefined()
      expect(find(rules.long, 'reduceExhaustion')).toBeDefined()
    }
  })
})

describe.skipIf(!dataDir)('rest rules against the book data', () => {
  const text = (collection: string, name: string, source: string) =>
    records(dataDir ?? '')
      .filter(
        (r) =>
          r.collection === collection &&
          r.record.name === name &&
          r.record.source === source,
      )
      .map((r) => textOf(r.record))
      .join(' ')

  it('matches the 2024 Short Rest and Long Rest text', () => {
    const short = text('variantrule', 'Short Rest', 'XPHB')
    expect(short).toContain('you must have at least 1')
    expect(short).toContain('minimum of 1 Hit Point')
    const long = text('variantrule', 'Long Rest', 'XPHB')
    expect(long).toContain('must have at least 1')
    expect(long).toContain('all spent')
    expect(long).toContain('decreases by 1')
  })

  it('matches the 2014 Short Rest, Long Rest and Temporary Hit Points text', () => {
    const quick = readFileSync(`${dataDir}/generated/bookref-quick.json`, 'utf8')
    expect(quick).toContain('(minimum of 0)')
    expect(quick).toContain("half of the character's total number of them")
    expect(quick).toContain('at least 1 Hit Die when you finish a long rest')
    expect(quick).toContain('at least 1 hit point at the start of the rest')
    expect(quick).toContain("until they're depleted or you finish a long rest")
  })

  it('matches the exhaustion removed by a rest in both printings', () => {
    const classic = text('condition', 'Exhaustion', 'PHB')
    expect(classic).toContain("Finishing a long rest reduces a creature's exhaustion")
    expect(classic).toContain('food and drink')
    expect(text('condition', 'Exhaustion', 'XPHB')).toContain(
      'removes 1 of your Exhaustion levels',
    )
  })
})
