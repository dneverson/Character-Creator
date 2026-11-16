import { describe, expect, it } from 'vitest'
import { SKILLS } from '../data/skills'
import { holderId } from './holder'
import { STANDING_RULES } from './standingRules'
import { dataDir, recordId, records, textOf } from '../test/dataAudit'
import {
  STANDING_COLLECTIONS_EXCUSED,
  STANDING_TEXT_EXCUSED,
} from '../test/standingExcuses'

describe('standing rules', () => {
  it('name each holder, scope and case once', () => {
    const ids = STANDING_RULES.map(
      (r) => `${holderId(r.holder)}|${r.edge}|${JSON.stringify(r.scope)}|${r.when ?? ''}`,
    )
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('are on saves of some abilities or on skills the sheet has', () => {
    const skills = new Set(SKILLS.map((s) => s.key))
    for (const { scope } of STANDING_RULES) {
      if ('save' in scope) expect(scope.save.length).toBeGreaterThan(0)
      else {
        expect(scope.check.length).toBeGreaterThan(0)
        for (const key of scope.check) expect(skills.has(key)).toBe(true)
      }
    }
  })
})

// A record's own sentence that gives the character advantage or disadvantage on a saving
// throw or a check; a roll of another creature is not the character's and is left out.
const SELF =
  /\b(you|your companion|you and [a-z ]+)\b[^.]{0,40}?\b(have|gain|get|always have|has)\b[^.]{0,30}?(dis)?advantage (on|to)[^.]{0,140}?\b(saving throws?|saves?|ability checks?|checks?)\b/i

const COLLECTIONS = [
  'race',
  'subrace',
  'feat',
  'background',
  'classFeature',
  'subclassFeature',
  'optionalfeature',
  'reward',
  'item',
  'magicvariant',
  'itemGroup',
]

describe.skipIf(!dataDir)('standing notes against the data', () => {
  const all = records(dataDir ?? '').map(({ collection, record }) => ({
    collection,
    record,
    id: recordId(collection, record),
  }))
  const ids = new Set(all.map((r) => r.id))
  const rows = new Set(STANDING_RULES.map((r) => holderId(r.holder)))
  const matching = all.filter(
    ({ collection, record }) =>
      COLLECTIONS.includes(collection) &&
      textOf(record)
        .split(/(?<=[.!?])\s+|","/)
        .some((s) => SELF.test(s)),
  )

  it('rule or excuse every record that gives the character an edge', () => {
    const unknown = matching
      .filter(
        ({ id, collection }) =>
          !rows.has(id) &&
          !(id in STANDING_TEXT_EXCUSED) &&
          !(collection in STANDING_COLLECTIONS_EXCUSED),
      )
      .map((r) => r.id)
    expect([...new Set(unknown)]).toEqual([])
  })

  it('name only records that exist, in the rows and in the excuses', () => {
    expect([...rows].filter((id) => !ids.has(id))).toEqual([])
    expect(Object.keys(STANDING_TEXT_EXCUSED).filter((id) => !ids.has(id))).toEqual([])
  })

  it('excuse only records that still match, and none that has a row', () => {
    const found = new Set(matching.map((r) => r.id))
    expect(Object.keys(STANDING_TEXT_EXCUSED).filter((id) => !found.has(id))).toEqual([])
    expect(Object.keys(STANDING_TEXT_EXCUSED).filter((id) => rows.has(id))).toEqual([])
    const collections = new Set(matching.map((r) => r.collection))
    expect(
      Object.keys(STANDING_COLLECTIONS_EXCUSED).filter((c) => !collections.has(c)),
    ).toEqual([])
  })

  it('count what it ruled and excused', () => {
    const unique = new Set(matching.map((r) => r.id))
    const ruled = [...unique].filter((id) => rows.has(id)).length
    expect(unique.size).toBeGreaterThan(300)
    expect(ruled).toBeGreaterThan(100)
  })
})
