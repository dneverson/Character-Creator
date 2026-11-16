// The rows of Quick lookup, read from the free rules the site hosts (`public/data`), so
// the test runs the same on a fresh checkout.

import { beforeAll, describe, expect, it, vi } from 'vitest'
import { loadLookupRows, rowText } from './rows'
import { buildIndex } from './search'
import { LOOKUP_KINDS, type LookupRow } from './types'

vi.mock('../data/dataClient', async () => {
  const { readFileSync } = await import('node:fs')
  return {
    fetchData: async (path: string): Promise<unknown> => {
      try {
        return JSON.parse(readFileSync(`public/data/${path}`, 'utf8'))
      } catch {
        throw new Error(`Failed to load data "${path}": HTTP 404`)
      }
    },
  }
})

let rows: LookupRow[] = []
beforeAll(async () => {
  rows = await loadLookupRows()
}, 60_000)

describe('the rows of Quick lookup', () => {
  it('has a unique id for every row', () => {
    expect(rows.length).toBeGreaterThan(1000)
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length)
  })

  it('holds the kinds of the free rules, and only known kinds', () => {
    const kinds = new Set(rows.map((r) => r.kind))
    for (const kind of [
      'spell',
      'item',
      'race',
      'background',
      'feat',
      'class',
      'subclass',
    ])
      expect(kinds, kind).toContain(kind)
    for (const kind of ['classFeature', 'subclassFeature', 'optionalFeature'])
      expect(kinds, kind).toContain(kind)
    for (const kind of [
      'condition',
      'action',
      'sense',
      'skill',
      'language',
      'variantRule',
    ])
      expect(kinds, kind).toContain(kind)
    for (const kind of kinds) expect(LOOKUP_KINDS).toContain(kind)
  })

  it('reads each kind through its own dataset', () => {
    const fireball = rows.find((r) => r.kind === 'spell' && r.name === 'Fireball')
    expect(fireball?.subject.type).toBe('spell')
    const prone = rows.find((r) => r.kind === 'condition' && r.name === 'Prone')
    expect(prone?.subject.type).toBe('text')
    const wildShape = rows.find(
      (r) => r.kind === 'classFeature' && r.name === 'Wild Shape',
    )
    expect(wildShape?.context).toMatch(/^Druid \d+$/)
    const subclass = rows.find((r) => r.kind === 'subclass')
    expect(subclass?.subject.type).toBe('class')
    expect(subclass?.context).toBeDefined()
  })

  it('reads the words of an entry, lists and tables included', () => {
    const prone = rows.find((r) => r.kind === 'condition' && r.name === 'Prone')
    expect(rowText(prone as LookupRow)).toMatch(/crawl/i)
    expect(rowText(prone as LookupRow)).toBe(rowText(prone as LookupRow))
    const table = rows.find((r) => r.kind === 'table')
    if (table) expect(rowText(table).length).toBeGreaterThan(0)
  })

  it('finds druid in names and in text, with the book each is in', async () => {
    const { hits, total } = (await buildIndex(rows)).search({ text: 'druid' })
    expect(total).toBeGreaterThan(20)
    expect(hits[0].row.name).toBe('Druid')
    expect(hits.some((h) => h.snippet?.match.toLowerCase().startsWith('druid'))).toBe(
      true,
    )
    expect(hits.every((h) => h.row.source !== '')).toBe(true)
  })
})
