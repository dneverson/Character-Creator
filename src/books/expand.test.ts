// The class and subclass stat blocks written out as text, against the full content on a
// machine that has it (`.local/data`); skipped where there is none.

import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import type { Entry } from '../text/Entries'
import { expandBook } from './expand'
import { scan } from './outline'

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

const present = existsSync('.local/data/book/book-phb.json')
const sectionsOf = (id: string): Entry[] =>
  (
    JSON.parse(readFileSync(`.local/data/book/book-${id}.json`, 'utf8')) as {
      bookData: { data: Entry[] }[]
    }
  ).bookData[0].data

describe('expandBook', () => {
  it('returns a text with no class stat block as it is', async () => {
    const sections: Entry[] = [{ type: 'section', name: 'One', entries: ['text'] }]
    expect(await expandBook(sections, 'X')).toBe(sections)
  })

  it('leaves a class the data does not hold as the stat block it is', async () => {
    const block = { type: 'statblock', tag: 'class', name: 'Nothing Class' }
    const sections: Entry[] = [{ type: 'section', name: 'One', entries: [block] }]
    expect(await expandBook(sections, 'X')).toEqual(sections)
  })

  it.skipIf(!present)(
    'writes the Barbarian of the PHB with its features and paths',
    async () => {
      const found = scan(await expandBook(sectionsOf('phb'), 'PHB'))
      const names = found.headings.map((h) => h.name)
      for (const name of [
        'Barbarian',
        'Class Features',
        'Rage',
        'Path of the Berserker',
        'Frenzy',
        'Path of the Totem Warrior',
        'Wizard',
        'Arcane Recovery',
        'School of Evocation',
      ]) {
        expect(names).toContain(name)
      }
      const barbarian = found.headings.find((h) => h.name === 'Barbarian')
      expect(barbarian?.page).toBe(46)
      // No class stat block is left as a placeholder, and the chapter's text holds the class.
      expect(JSON.stringify(sectionsOf('phb'))).toContain('"tag":"class"')
      expect(found.blocks.some((b) => b.text.includes('primal ferocity'))).toBe(true)
    },
  )

  it.skipIf(!present)('writes the options of a feature in place', async () => {
    const found = scan(await expandBook(sectionsOf('phb'), 'PHB'))
    expect(found.headings.map((h) => h.name)).toEqual(
      expect.arrayContaining(['Fighting Style', 'Archery', 'Dueling']),
    )
  })
})
