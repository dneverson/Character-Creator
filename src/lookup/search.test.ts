import { describe, expect, it } from 'vitest'
import { buildIndex, snippetOf, wordsIn } from './search'
import type { LookupKind, LookupRow } from './types'

const make = (
  kind: LookupKind,
  name: string,
  text: string,
  source = 'PHB',
  context?: string,
): LookupRow => ({
  id: `${kind}:${name}|${source}`.toLowerCase(),
  kind,
  name,
  ...(context && { context }),
  source,
  edition: 'classic',
  subject: {
    type: 'text',
    value: { name, source, facts: [], entries: [text, { type: 'list', items: [text] }] },
  },
})

const rows = [
  make('spell', 'Druidcraft', 'Whispering to nature, you create a tiny effect.'),
  make('class', 'Druid', 'Priests of the natural world.'),
  make(
    'feat',
    'Magic Initiate (Druid)',
    'Learn two cantrips from the druid list.',
    'XPHB',
  ),
  make('spell', 'Moonbeam', 'A silvery beam. Druid circles favor it.', 'PHB'),
  make('condition', 'Prone', 'A prone creature crawls.', 'PHB'),
  make(
    'classFeature',
    'Wild Shape',
    'You can use your action to assume a beast shape.',
    'PHB',
    'Druid 2',
  ),
]

describe('wordsIn', () => {
  it('splits on anything that is not a letter or digit', () => {
    expect(wordsIn("Fire-ball's 2d6")).toEqual(['fire', 'ball', 's', '2d6'])
    expect(wordsIn('')).toEqual([])
  })
})

describe('searching the index', () => {
  it('ranks a name that is the search, then one that starts with it, then the rest', async () => {
    const index = await buildIndex(rows, 1000)
    const { hits, total } = index.search({ text: 'druid' })
    expect(total).toBe(5)
    expect(hits.map((h) => h.row.name)).toEqual([
      'Druid',
      'Druidcraft',
      'Magic Initiate (Druid)',
      'Wild Shape',
      'Moonbeam',
    ])
  })

  it('gives a snippet only for a hit found in the text, with the match marked', async () => {
    const { hits } = (await buildIndex(rows, 1000)).search({ text: 'druid' })
    expect(hits[0].snippet).toBeUndefined()
    const moon = hits.find((h) => h.row.name === 'Moonbeam')
    expect(moon?.snippet).toEqual({
      before: 'A silvery beam. ',
      match: 'Druid',
      after: ' circles favor it. A silvery beam. Druid circles favor it.',
    })
  })

  it('needs every word, each starting a word of the name or the text', async () => {
    const index = await buildIndex(rows, 1000)
    expect(index.search({ text: 'prone crawl' }).hits.map((h) => h.row.name)).toEqual([
      'Prone',
    ])
    expect(index.search({ text: 'prone zebra' }).total).toBe(0)
    expect(index.search({ text: 'ruid' }).total).toBe(0)
  })

  it('finds a feature by the class it comes from', async () => {
    const index = await buildIndex(rows, 1000)
    expect(index.search({ text: 'wild druid' }).hits.map((h) => h.row.name)).toEqual([
      'Wild Shape',
    ])
  })

  it('keeps one kind, and lists the whole kind when no words are given', async () => {
    const index = await buildIndex(rows, 1000)
    expect(
      index.search({ text: 'druid', kind: 'spell' }).hits.map((h) => h.row.name),
    ).toEqual(['Druidcraft', 'Moonbeam'])
    expect(index.search({ text: '', kind: 'spell' }).total).toBe(2)
    expect(index.search({ text: '  ' })).toEqual({ hits: [], total: 0 })
  })

  it('builds in slices without losing a row', async () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      make('item', `Thing ${i}`, 'A common thing.'),
    )
    const index = await buildIndex(many, 0)
    expect(index.search({ text: 'common' }).total).toBe(20)
  })
})

describe('snippetOf', () => {
  it('cuts the words around the first match and marks that it was cut', () => {
    const text = `${'word '.repeat(40)}target ${'tail '.repeat(40)}`
    const snippet = snippetOf(text, ['target'], 60)
    expect(snippet?.match).toBe('target')
    expect(snippet?.before.startsWith('...')).toBe(true)
    expect(snippet?.after.endsWith('...')).toBe(true)
  })

  it('is nothing where the text does not hold the word, and matches only word starts', () => {
    expect(snippetOf('Nothing here.', ['druid'])).toBeUndefined()
    expect(snippetOf('The shrouded sun.', ['rou'])).toBeUndefined()
    expect(snippetOf('A (strange) c++ thing', ['c++', 'strange'])?.match).toBe('strange')
  })
})
