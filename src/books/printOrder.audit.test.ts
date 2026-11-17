// The page order of the books on a machine that has the full content: no separator goes
// back a page in the Monster Manual, and the three books the printed order was checked on
// keep to the few marks that are left (a sidebar printed above the text it sits in). The
// text of the books is not in this repository, so the audit reads `.local/data` and is
// skipped where there is none.

import { existsSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { readBookText } from './load'
import { buildFlow } from './units'

vi.mock('../data/dataClient', async () => {
  const { readFileSync } = await import('node:fs')
  const read = async (path: string): Promise<unknown> => {
    try {
      return JSON.parse(readFileSync(`.local/data/${path}`, 'utf8'))
    } catch {
      throw new Error(`Failed to load data "${path}": HTTP 404`)
    }
  }
  return { fetchData: read, fetchDataUncached: read }
})

const present = existsSync('.local/data/book/book-mm.json')

/** The page the first part of this name says it is printed on, when it does. */
function printedOn(node: unknown, name: string): unknown {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = printedOn(child, name)
      if (found !== undefined) return found
    }
  } else if (typeof node === 'object' && node !== null) {
    const part = node as { name?: unknown; printedOn?: unknown }
    if (part.name === name && part.printedOn !== undefined) return part.printedOn
    return printedOn(Object.values(node), name)
  }
  return undefined
}

/** The separators that name a page lower than the page in force. */
async function backwards(id: string) {
  const text = await readBookText('book', id, true)
  const flow = buildFlow(text.sections, text.scan)
  const marks = flow.units.filter(
    (unit) => unit.page !== undefined && unit.from !== undefined && unit.page < unit.from,
  )
  return { text, flow, marks: marks.length }
}

describe('the page order of the books', () => {
  it.skipIf(!present)('has no separator going back in the Monster Manual', async () => {
    const { text, marks } = await backwards('MM')
    expect(marks).toBe(0)
    // A creature the Monster Manual prints in an appendix is shown with where it is.
    expect(printedOn(text.sections, 'Cave Bear')).toBe(334)
  })

  it.skipIf(!present)('keeps Fireball in front of the spells after it', async () => {
    const { flow, marks } = await backwards('PHB')
    expect(marks).toBeLessThanOrEqual(2)
    const fireball = flow.units.findIndex((u) => u.page === 241 && u.entries.length > 0)
    const fireBolt = flow.units.findIndex((u) => u.page === 242)
    expect(fireball).toBeGreaterThan(0)
    expect(fireball).toBeLessThan(fireBolt)
  })

  it.skipIf(!present)('leaves the 2024 Player Handbook one mark', async () => {
    expect((await backwards('XPHB')).marks).toBeLessThanOrEqual(1)
  })
})
