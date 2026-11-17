// What the contents of `books.json` list, against the headings of the outline, on a machine
// that has the full content (`.local/data`); skipped where there is none. Every name the
// contents of the Monster Manual, the Player's Handbook and the 2024 Player's Handbook list
// is a heading of its chapter, among them the creatures of an appendix and the backgrounds.

import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import type { Book } from '../data/types'
import { listedIn } from './listed'
import { readBookText } from './load'
import { slugOf } from './outline'

vi.mock('../data/dataClient', async () => {
  const { readFileSync: read } = await import('node:fs')
  const get = async (path: string): Promise<unknown> => {
    try {
      return JSON.parse(read(`.local/data/${path}`, 'utf8'))
    } catch {
      throw new Error(`Failed to load data "${path}": HTTP 404`)
    }
  }
  return { fetchData: get, fetchDataUncached: get }
})

const present = existsSync('.local/data/book/book-mm.json')

describe.skipIf(!present)('the contents of the books on this machine', () => {
  it.each(['MM', 'PHB', 'XPHB'])('are all headings of %s', async (id) => {
    const books = JSON.parse(readFileSync('.local/data/books.json', 'utf8')) as {
      book: Book[]
    }
    const { sections, scan } = await readBookText('book', id, true)
    const listed = listedIn(
      books.book.find((entry) => entry.id === id),
      sections,
    )
    expect(listed.size).toBeGreaterThan(0)
    const missing: string[] = []
    for (const [chapter, names] of listed) {
      const have = new Set(
        scan.headings.filter((h) => h.chapter === chapter).map((h) => slugOf(h.name)),
      )
      for (const name of names) if (!have.has(name)) missing.push(`${chapter}:${name}`)
    }
    expect(missing).toEqual([])
  })

  it('leave the Monster Manual A to Z the headings it had', async () => {
    const { scan } = await readBookText('book', 'MM', true)
    expect(scan.headings.filter((h) => h.chapter === 0)).toHaveLength(241)
    expect(scan.headings.some((h) => h.chapter === 1 && h.name === 'Ape')).toBe(true)
  })
})
