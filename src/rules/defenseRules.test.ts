import { describe, expect, it } from 'vitest'
import {
  DAMAGE_TYPES,
  DEFENSE_RULES,
  ITEM_DEFENSE_NOT_STANDING,
  ITEM_DEFENSE_WHEN,
  VARIANT_DEFENSES,
  VARIANT_DEFENSE_WHEN,
} from './defenseRules'
import { holderId } from './holder'
import { dataDir, recordId, records, textOf, type Rec } from '../test/dataAudit'
import { DEFENSE_COLLECTIONS_EXCUSED, DEFENSE_TEXT_EXCUSED } from '../test/defenseExcuses'

describe('defense rules', () => {
  it('name each holder once per kind', () => {
    const ids = DEFENSE_RULES.map(
      (r) => `${holderId(r.holder)}|${r.kind}|${r.when ?? ''}`,
    )
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('give each row something it covers, or a type to choose', () => {
    for (const rule of DEFENSE_RULES) {
      expect(rule.types.length > 0 || !!rule.choose).toBe(true)
    }
  })

  it('offer a choice only of damage types or conditions the row names', () => {
    for (const rule of DEFENSE_RULES.filter((r) => r.choose)) {
      expect(rule.choose?.count).toBeGreaterThan(0)
      if (rule.kind !== 'condition') {
        for (const type of rule.choose?.from ?? []) {
          expect(DAMAGE_TYPES as readonly string[]).toContain(type)
        }
      }
    }
  })
})

const FIELDS = ['resist', 'immune', 'vulnerable', 'conditionImmune'] as const
const TEXT = /resistance to|immune to|immunity to|vulnerab/i

/** Whether a record states a defense list as data, a variant inside what it inherits. */
const hasFields = (record: Rec): boolean =>
  FIELDS.some(
    (f) =>
      record[f] ||
      (typeof record.inherits === 'object' && record.inherits && f in record.inherits) ||
      JSON.stringify(record._copy ?? '').includes(`"inherits.${f}"`),
  )

/** Collections whose records carry the defense lists the sheet reads from the data. */
const READ_FROM_FIELDS = ['race', 'subrace', 'feat', 'item', 'magicvariant']

describe.skipIf(!dataDir)('defenses against the data', () => {
  const all = records(dataDir ?? '').map(({ collection, record }) => ({
    collection,
    record,
    id: recordId(collection, record),
  }))
  const ids = new Set(all.map((r) => r.id))
  const rows = new Set(DEFENSE_RULES.map((r) => holderId(r.holder)))
  const matching = all.filter(
    ({ record }) => hasFields(record) || TEXT.test(textOf(record)),
  )
  /** Whether an item or a variant of that name has its defense as data or as a row. */
  const memberCovered = (member: string): boolean => {
    const [name, source] = member.split('|')
    return all.some(
      (r) =>
        (r.collection === 'item' || r.collection === 'magicvariant') &&
        r.record.name === name &&
        (source === undefined ||
          r.collection === 'magicvariant' ||
          r.record.source === source) &&
        (hasFields(r.record) || rows.has(r.id) || name in VARIANT_DEFENSES),
    )
  }
  /** A group is an index of items: covered when the items it lists are. */
  const groupCovered = (record: Rec): boolean =>
    Array.isArray(record.items) &&
    record.items.some((m) => typeof m === 'string' && memberCovered(m))

  it('rule, derive from the data, or excuse every record that names a defense', () => {
    const unknown = matching
      .filter(({ id, collection, record }) => {
        if (rows.has(id) || id in DEFENSE_TEXT_EXCUSED) return false
        if (collection in DEFENSE_COLLECTIONS_EXCUSED) return false
        if (collection === 'itemGroup' && groupCovered(record)) return false
        if (collection === 'magicvariant' && String(record.name) in VARIANT_DEFENSES)
          return false
        return !(READ_FROM_FIELDS.includes(collection) && hasFields(record))
      })
      .map((r) => r.id)
    expect([...new Set(unknown)]).toEqual([])
  })

  it('name only records that exist, in the rows and in the excuses', () => {
    expect([...rows].filter((id) => !ids.has(id))).toEqual([])
    expect(Object.keys(DEFENSE_TEXT_EXCUSED).filter((id) => !ids.has(id))).toEqual([])
    const names = new Set(
      all
        .filter((r) => r.collection === 'magicvariant')
        .map((r) => String(r.record.name)),
    )
    expect(Object.keys(VARIANT_DEFENSES).filter((n) => !names.has(n))).toEqual([])
    const named = [
      ...Object.keys(ITEM_DEFENSE_NOT_STANDING),
      ...Object.keys(ITEM_DEFENSE_WHEN),
    ]
    expect(Object.keys(VARIANT_DEFENSE_WHEN).filter((n) => !names.has(n))).toEqual([])
    expect(named.filter((key) => !ids.has(`item|${key}`))).toEqual([])
  })

  it('excuse only records that still match, and none that has a row', () => {
    const found = new Set(matching.map((r) => r.id))
    expect(Object.keys(DEFENSE_TEXT_EXCUSED).filter((id) => !found.has(id))).toEqual([])
    expect(Object.keys(DEFENSE_TEXT_EXCUSED).filter((id) => rows.has(id))).toEqual([])
    const collections = new Set(matching.map((r) => r.collection))
    expect(
      Object.keys(DEFENSE_COLLECTIONS_EXCUSED).filter((c) => !collections.has(c)),
    ).toEqual([])
  })

  it('count what it ruled, derived and excused', () => {
    const unique = new Set(matching.map((r) => r.id))
    const ruled = [...unique].filter((id) => rows.has(id)).length
    const excused = [...unique].filter((id) => id in DEFENSE_TEXT_EXCUSED).length
    expect(unique.size).toBeGreaterThan(600)
    expect(ruled).toBeGreaterThan(150)
    expect(excused).toBeGreaterThan(180)
  })
})
