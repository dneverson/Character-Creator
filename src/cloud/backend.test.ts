import { describe, expect, it } from 'vitest'
import { historyEntry } from '../character/model'
import {
  CloudOfflineError,
  parseEvents,
  parseRows,
  toEventRecord,
  toRecord,
} from './backend'

const when = '2026-11-20T10:00:00.000Z'

describe('parseRows', () => {
  it('reads live and deleted rows with their times', () => {
    const rows = parseRows([
      { id: 'a', data: { name: 'Tordek' }, updated_at: when, deleted_at: null },
      { id: 'b', data: {}, updated_at: when, deleted_at: '2026-11-21T10:00:00.000Z' },
    ])
    expect(rows).toEqual([
      { id: 'a', data: { name: 'Tordek' }, updatedAt: Date.parse(when), deletedAt: null },
      {
        id: 'b',
        data: {},
        updatedAt: Date.parse(when),
        deletedAt: Date.parse('2026-11-21T10:00:00.000Z'),
      },
    ])
  })

  it('leaves out a row that is not shaped as the app writes it', () => {
    const rows = parseRows([
      null,
      { id: 1, data: {}, updated_at: when, deleted_at: null },
      { id: 'no-data', data: 'text', updated_at: when, deleted_at: null },
      { id: 'no-time', data: {}, updated_at: 'never', deleted_at: null },
      { id: 'bad-deleted', data: {}, updated_at: when, deleted_at: 'never' },
      { id: 'ok', data: {}, updated_at: when, deleted_at: null },
    ])
    expect(rows.map((row) => row.id)).toEqual(['ok'])
  })

  it('reads nothing from an answer that is not a list', () => {
    expect(parseRows(null)).toEqual([])
    expect(parseRows({ id: 'a' })).toEqual([])
  })
})

describe('toRecord', () => {
  it('writes the times the way the database takes them', () => {
    expect(
      toRecord({ id: 'a', data: {}, updatedAt: Date.parse(when), deletedAt: null }),
    ).toEqual({ id: 'a', data: {}, updated_at: when, deleted_at: null })
    expect(
      toRecord({ id: 'a', data: {}, updatedAt: 0, deletedAt: Date.parse(when) })
        .deleted_at,
    ).toBe(when)
  })
})

describe('parseEvents', () => {
  const entry = historyEntry(5, { type: 'created' })

  it('reads the entry and the time the server recorded it', () => {
    expect(parseEvents([{ event_id: entry.id, recorded_at: when, entry }])).toEqual([
      { eventId: entry.id, recordedAt: Date.parse(when), entry },
    ])
  })

  it('leaves out what is not shaped as the app writes it', () => {
    expect(
      parseEvents([
        null,
        { event_id: 1, recorded_at: when, entry },
        { event_id: 'a', recorded_at: 'never', entry },
        { event_id: 'b', recorded_at: when, entry: { id: 'b' } },
      ]),
    ).toEqual([])
    expect(parseEvents('nothing')).toEqual([])
  })
})

describe('toEventRecord', () => {
  it('names only what the ledger lets a device set: never the time or the user', () => {
    const entry = historyEntry(5)
    expect(toEventRecord('c1', entry)).toEqual({
      character_id: 'c1',
      event_id: entry.id,
      entry,
    })
  })
})

describe('CloudOfflineError', () => {
  it('is named, so it can be told from a refusal', () => {
    expect(new CloudOfflineError().name).toBe('CloudOfflineError')
  })
})
