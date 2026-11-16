// The senses a feature, a gift or an item gives for a time only (a charm expended, a mask
// worn for 5 minutes), against the book data in `.local/data` (skipped without it): each
// is a conditional sense row with its duration and trigger in `when`, which the sheet
// shows and never counts, or it is excused here with the reason.

import { describe, expect, it } from 'vitest'
import { dataDir, recordId, records, textOf } from '../test/dataAudit'
import { holderId } from './holder'
import { SENSE_RULES } from './senseRules'

const TIMED_SENSE =
  /\b(gain|have|grants?)\b[^.]{0,80}\b(darkvision|blindsight|truesight|tremorsense)\b[^.]{0,100}\bfor \d+ (minutes?|hours?)\b/i

const COLLECTIONS = ['race', 'subrace', 'feat', 'reward', 'item', 'optionalfeature']

/** Timed senses the sheet does not show as a sense row, each with the reason. */
export const TIMED_SENSE_EXCUSED: Readonly<Record<string, string>> = {
  'reward|Blessing of Dumathoin|PaBTSO':
    'The text gives the truesight no range, so the sheet has no range to show.',
}

describe.skipIf(!dataDir)('timed senses against the data', () => {
  const all = records(dataDir ?? '').map(({ collection, record }) => ({
    collection,
    id: recordId(collection, record),
    text: textOf(record),
  }))
  const timed = all.filter(
    (r) =>
      COLLECTIONS.includes(r.collection) &&
      r.text.split(/(?<=[.!?])\s+|","/).some((s) => TIMED_SENSE.test(s)),
  )
  const conditional = new Set(
    SENSE_RULES.filter((r) => r.when).map((r) => holderId(r.holder)),
  )

  it('shows every timed sense as a conditional row or excuses it', () => {
    const unknown = timed
      .filter((r) => !conditional.has(r.id) && !(r.id in TIMED_SENSE_EXCUSED))
      .map((r) => r.id)
    expect([...new Set(unknown)]).toEqual([])
  })

  it('excuses only records that still match, and none that has a row', () => {
    const found = new Set(timed.map((r) => r.id))
    expect(Object.keys(TIMED_SENSE_EXCUSED).filter((id) => !found.has(id))).toEqual([])
    expect(Object.keys(TIMED_SENSE_EXCUSED).filter((id) => conditional.has(id))).toEqual(
      [],
    )
  })

  it('has timed senses to check', () => {
    expect(timed.length).toBeGreaterThan(5)
  })
})
