import { describe, expect, it, vi } from 'vitest'
import type { Entry } from '../text/Entries'
import { withEntityPages } from './entityPages'

const files: Record<string, unknown> = {
  'bestiary/index.json': { MM: 'bestiary-mm.json' },
  'bestiary/bestiary-mm.json': {
    monster: [
      { name: 'Aboleth', source: 'MM', page: 13 },
      { name: 'Kobold', source: 'MM' },
    ],
  },
  'spells/index.json': { PHB: 'spells-phb.json' },
  'spells/spells-phb.json': { spell: [{ name: 'Fireball', source: 'PHB', page: 241 }] },
}

vi.mock('../data/dataClient', () => ({
  fetchData: async (path: string): Promise<unknown> => {
    if (path in files) return files[path]
    throw new Error(`Failed to load data "${path}": HTTP 404`)
  },
}))

const section = (...entries: Entry[]): Entry[] => [
  { type: 'section', name: 'S', entries },
]
const creature = (name: string, extra: object = {}): Entry => ({
  type: 'statblock',
  tag: 'creature',
  name,
  ...extra,
})
const pageOf = (sections: Entry[], at: number) =>
  ((sections[0] as { entries: { page?: number }[] }).entries[at] ?? {}).page

describe('withEntityPages', () => {
  it('gives a stat block the page of the entry of the book it names', async () => {
    const sections = section(creature('Aboleth', { source: 'MM' }))
    expect(pageOf(await withEntityPages(sections, 'MM'), 0)).toBe(13)
    // The text is not changed in place.
    expect(pageOf(sections, 0)).toBeUndefined()
  })

  it('reads a block with no source as its tag does, in any case of the book id', async () => {
    const spell: Entry = { type: 'statblock', tag: 'spell', name: 'Fireball' }
    const found = await withEntityPages(section(creature('Aboleth'), spell), 'mm')
    expect(pageOf(found, 0)).toBe(13)
    expect(pageOf(found, 1)).toBeUndefined()
    expect(pageOf(await withEntityPages(section(spell), 'PHB'), 0)).toBe(241)
  })

  it('reads the entry a description names', async () => {
    const block: Entry = {
      type: 'statblock',
      prop: 'monsterFluff',
      name: 'Aboleth',
      source: 'MM',
    }
    expect(pageOf(await withEntityPages(section(block), 'MM'), 0)).toBe(13)
  })

  it('leaves alone other books, blocks with a page and entries with no page', async () => {
    const sections = section(
      creature('Aboleth', { source: 'XMM' }),
      creature('Aboleth', { source: 'MM', page: 99 }),
      creature('Kobold', { source: 'MM' }),
      creature('Nobody', { source: 'MM' }),
    )
    expect(await withEntityPages(sections, 'MM')).toBe(sections)
  })

  it('returns the text as it is when nothing is named or the data cannot be had', async () => {
    const plain = section('text')
    expect(await withEntityPages(plain, 'MM')).toBe(plain)
    const missing = section(creature('Aboleth', { source: 'ZZ' }))
    expect(await withEntityPages(missing, 'ZZ')).toBe(missing)
  })
})
