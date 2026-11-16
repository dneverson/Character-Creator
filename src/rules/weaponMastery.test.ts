import { describe, expect, it } from 'vitest'
import { dataDir, findIds, records, recordId, textOf } from '../test/dataAudit'
import { holderId } from './holder'
import { MASTERY_COLUMN, MASTERY_GRANTS } from './weaponMastery'

/**
 * Text that names mastery properties without giving any: each with why it needs no row.
 */
const NOT_A_GRANT: Record<string, string> = {
  'classFeature|Tactical Master|XPHB|Fighter':
    'swaps the property of a weapon already mastered for Push, Sap or Slow on one attack',
  'subclassFeature|Battering Roots|XPHB|Barbarian|World Tree':
    'adds Push or Topple on a hit with a weapon already mastered',
  'subclassFeature|Spiritual Protectors|WoW|Barbarian|Spiritual Guardian':
    'adds Slow to a weapon already mastered while the guardian is active',
  'subclassFeature|Rot and Violence|RHW|Ranger|Hollow Warden':
    'adds Sap or Slow on a hit with a weapon already mastered',
  'facility|Training Area|XDMG':
    'a bastion facility, not a character option: its trainer grants a mastery for a while',
  'item|Shalamayne|WoW':
    'a magic item that adds a second property to a greatsword already mastered',
}

const NUMBER_WORDS = ['one', 'two', 'three', 'four', 'five', 'six']

describe('the weapon mastery table', () => {
  it('gives every grant a holder of its own and a count of at least one', () => {
    const ids = MASTERY_GRANTS.map((g) => holderId(g.holder))
    expect(new Set(ids).size).toBe(ids.length)
    expect(MASTERY_GRANTS.filter((g) => g.count < 1)).toEqual([])
  })
})

describe.skipIf(!dataDir)('weapon mastery against the data', () => {
  const dir = dataDir ?? ''
  const all = records(dir).filter(({ record }) => record.entries)
  const byId = new Map(
    all.map(({ collection, record }) => [recordId(collection, record), record]),
  )

  it('has a row or an excuse for every record that gives mastery properties', () => {
    const found = findIds(
      dir,
      ['classFeature', 'subclassFeature', 'feat', 'optionalfeature', 'facility', 'item'],
      (text, r) => !!r.entries && /mastery propert/i.test(text),
    )
    const ruled = new Set(MASTERY_GRANTS.map((g) => holderId(g.holder)))
    expect([...found].filter((id) => !ruled.has(id) && !(id in NOT_A_GRANT))).toEqual([])
    // 12 records: 6 by a row, 6 excused. A row or an excuse the data lost is stale.
    expect(found.size).toBe(12)
    expect(
      [...ruled, ...Object.keys(NOT_A_GRANT)].filter((id) => !found.has(id)),
    ).toEqual([])
  })

  it("counts as many kinds as each feature's text names", () => {
    for (const grant of MASTERY_GRANTS) {
      const record = byId.get(holderId(grant.holder))
      const text = record ? textOf(record) : ''
      const named = /mastery propert(?:y|ies) of (\w+)/i.exec(text)?.[1] ?? ''
      // "the mastery property of one Simple or Martial weapon" reads "one".
      expect([holderId(grant.holder), NUMBER_WORDS.indexOf(named) + 1]).toEqual([
        holderId(grant.holder),
        grant.count,
      ])
    }
  })

  it('reads the melee and proficiency limits and the long rest change from the text', () => {
    for (const grant of MASTERY_GRANTS) {
      const record = byId.get(holderId(grant.holder))
      const text = record ? textOf(record) : ''
      const id = holderId(grant.holder)
      expect([id, /Melee weapons/.test(text)]).toEqual([id, !!grant.melee])
      expect([id, /proficiency|proficient/.test(text)]).toEqual([id, !!grant.proficient])
      expect([id, /change one of those weapon choices/i.test(text)]).toEqual([
        id,
        grant.changes === 'one',
      ])
    }
  })

  it('has the Weapon Mastery column in the table of the two classes that grow it', () => {
    const withColumn = records(dir)
      .filter(({ collection, record }) => {
        if (collection !== 'class') return false
        const groups = (record.classTableGroups ?? []) as { colLabels?: string[] }[]
        return groups.some((g) =>
          (g.colLabels ?? []).some((l) => l.includes(MASTERY_COLUMN)),
        )
      })
      .map(({ record }) => `${String(record.name)}|${String(record.source)}`)
    expect(withColumn).toEqual(expect.arrayContaining(['Barbarian|XPHB', 'Fighter|XPHB']))
  })
})
