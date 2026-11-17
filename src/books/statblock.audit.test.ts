// The audit of the stat blocks of the books: every `statblock` of every book and
// adventure on a machine that has the full content names something the reader draws (an
// entry of the lookup, or a description a book keeps), and the entries are found in the
// full content. The text of the books is not in this repository, so the audit reads
// `.local/data` and is skipped where there is none.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { loadResolver } from '../lookup/references'
import type { StatblockEntry } from '../text/entryContext'
import { loadCrochet } from './crochet'
import { loadFluff, loadTable, targetOf } from './statblock'

vi.mock('../data/dataClient', async () => {
  const { readFileSync: read } = await import('node:fs')
  return {
    fetchData: async (path: string): Promise<unknown> => {
      try {
        return JSON.parse(read(`.local/data/${path}`, 'utf8'))
      } catch {
        throw new Error(`Failed to load data "${path}": HTTP 404`)
      }
    },
  }
})

/**
 * The stat blocks the full content has no entry for: one rule of the DM screen, which the
 * data keeps only as text inside the screen's own pages (the 2024 rules have it as "Death
 * Saving Throw"). It stays a line that says so and links to the lookup; a new one is a new
 * gap, and the audit fails on it.
 */
const KNOWN_MISSING = ['variantrule: Death Saving Throws|XScreen']

function collect(node: unknown, found: StatblockEntry[] = []): StatblockEntry[] {
  if (Array.isArray(node)) for (const child of node) collect(child, found)
  else if (typeof node === 'object' && node !== null) {
    if ((node as { type?: unknown }).type === 'statblock')
      found.push(node as StatblockEntry)
    for (const child of Object.values(node)) collect(child, found)
  }
  return found
}

const folders = ['book', 'adventure'].map((name) => join('.local', 'data', name))
const present = folders.every((folder) => existsSync(folder))

describe('the stat blocks of the books', () => {
  it.skipIf(!present)(
    'all name something that is drawn, and the full content has it',
    async () => {
      const blocks = folders.flatMap((folder) =>
        readdirSync(folder)
          .filter((name) => name.endsWith('.json'))
          .flatMap((name) =>
            collect(JSON.parse(readFileSync(join(folder, name), 'utf8'))),
          ),
      )
      const resolver = await loadResolver()
      const counts = { lookup: 0, fluff: 0, table: 0, crochet: 0 }
      const lost: string[] = []
      for (const block of blocks) {
        const target = targetOf(block)
        if (target.kind === 'lookup') {
          if (resolver.find(target.reference)) counts.lookup++
          else lost.push(`${block.tag ?? block.prop}: ${block.name}|${block.source}`)
        } else if (target.kind === 'fluff') {
          if (await loadFluff(target.prop, target.name, target.source)) counts.fluff++
          else lost.push(`${block.prop}: ${block.name}|${block.source}`)
        } else if (target.kind === 'table') {
          if (await loadTable(target.name, target.source)) counts.table++
          else lost.push(`table: ${block.name}|${block.source}`)
        } else if (target.kind === 'crochet') {
          if (await loadCrochet(target.name, target.source)) counts.crochet++
          else lost.push(`crochet: ${block.name}|${block.source}`)
        } else lost.push(`${block.tag ?? block.prop}: ${block.name}|${block.source}`)
      }
      console.info(`stat blocks ${blocks.length}:`, counts, `lost ${lost.length}`)
      console.info(lost.slice(0, 60).join('\n'))
      expect(
        counts.lookup + counts.fluff + counts.table + counts.crochet + lost.length,
      ).toBe(blocks.length)
      expect(lost.filter((line) => !KNOWN_MISSING.includes(line))).toEqual([])
      expect(lost).toHaveLength(KNOWN_MISSING.length)
    },
    120_000,
  )
})
