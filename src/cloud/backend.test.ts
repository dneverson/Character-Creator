import { describe, expect, it } from 'vitest'
import { CloudOfflineError, parseRows, toRecord } from './backend'

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

describe('CloudOfflineError', () => {
  it('is named, so it can be told from a refusal', () => {
    expect(new CloudOfflineError().name).toBe('CloudOfflineError')
  })
})
