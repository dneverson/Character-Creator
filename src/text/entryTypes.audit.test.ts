// The audit of the entry types: every book and adventure of the content source is read,
// and a `type` the renderer does not draw fails the test, so a new kind of entry in the
// source is noticed instead of silently left out of a book. The text of the books is not
// in this repository, so the audit reads the copy under `.local/data` when a machine has
// one (`.local/scripts/books/pull.mjs` makes it) and is skipped where there is none.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ENTRY_TYPES, NON_ENTRY_TYPES } from './entryTypes'

/** Count the `type` of every object under a node. */
export function countTypes(node: unknown, counts = new Map<string, number>()) {
  if (Array.isArray(node)) {
    for (const child of node) countTypes(child, counts)
  } else if (typeof node === 'object' && node !== null) {
    const { type } = node as { type?: unknown }
    if (typeof type === 'string') counts.set(type, (counts.get(type) ?? 0) + 1)
    for (const child of Object.values(node)) countTypes(child, counts)
  }
  return counts
}

/** The types found that the renderer does not draw. */
export function unknownTypes(counts: Map<string, number>): string[] {
  const known = new Set([...ENTRY_TYPES, ...NON_ENTRY_TYPES])
  return [...counts.keys()].filter((type) => !known.has(type)).sort()
}

const folders = ['book', 'adventure'].map((name) => join('.local', 'data', name))
const copies = folders.filter((folder) => existsSync(folder))

describe('the entry types', () => {
  it('are counted and compared with the ones that are drawn', () => {
    const counts = countTypes({
      type: 'section',
      entries: ['x', { type: 'table', rows: [[{ type: 'cell' }]] }, { type: 'odd' }],
    })
    expect([...counts]).toEqual([
      ['section', 1],
      ['table', 1],
      ['cell', 1],
      ['odd', 1],
    ])
    expect(unknownTypes(counts)).toEqual(['odd'])
  })

  it.skipIf(copies.length === 0)(
    'in every book and adventure on this machine are all drawn',
    () => {
      const counts = new Map<string, number>()
      for (const folder of copies) {
        for (const file of readdirSync(folder).filter((name) => name.endsWith('.json'))) {
          countTypes(JSON.parse(readFileSync(join(folder, file), 'utf8')), counts)
        }
      }
      expect(unknownTypes(counts)).toEqual([])
    },
  )
})
