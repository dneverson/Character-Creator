import { describe, expect, it } from 'vitest'
import { dataDir, records, recordId } from '../test/dataAudit'
import { holderId } from './holder'
import { SENSE_RULES } from './senseRules'
import { SPEED_RULES } from './speedRules'

describe('speed and sense rules', () => {
  it('name each holder once, with a rule in words', () => {
    for (const rules of [SPEED_RULES, SENSE_RULES]) {
      const ids = rules.map((r) => holderId(r.holder))
      expect(new Set(ids).size).toBe(ids.length)
      for (const rule of rules) expect(rule.text.startsWith(rule.label)).toBe(true)
    }
  })
})

describe.skipIf(!dataDir)('speed and sense rules against the data', () => {
  it('have every holder present in the data', () => {
    const all = new Set(
      records(dataDir ?? '').map(({ collection, record }) =>
        recordId(collection, record),
      ),
    )
    const missing = [...SPEED_RULES, ...SENSE_RULES]
      .map((r) => holderId(r.holder))
      .filter((id) => !all.has(id))
    expect(missing).toEqual([])
  })
})
