import { describe, expect, it, vi } from 'vitest'
import { fixtureSections } from '../test/bookFixture'
import { scan, type Scan } from './outline'
import { createBookIndex, searchWords } from './searchIndex'

const fixture = scan(fixtureSections)

async function indexed() {
  const index = createBookIndex()
  await index.addDoc({ kind: 'book', id: 'TST', name: 'Test Handbook' }, fixture)
  return index
}

describe('the words of a search', () => {
  it('drops one-letter words and keeps the rest', () => {
    expect(searchWords('a red dragon')).toEqual(['red', 'dragon'])
    expect(searchWords('x 5')).toEqual(['5'])
  })

  it('is nothing for a single letter, and the word itself when it is all there is', () => {
    expect(searchWords('a')).toEqual([])
    expect(searchWords('')).toEqual([])
    expect(searchWords('dr')).toEqual(['dr'])
  })
})

describe('the book index', () => {
  it('knows the documents it holds and how many blocks', async () => {
    const index = await indexed()
    expect(index.has('book', 'TST')).toBe(true)
    expect(index.has('adventure', 'TST')).toBe(false)
    expect(index.size()).toEqual({ docs: 1, blocks: fixture.blocks.length })
  })

  it('finds the blocks where every word starts a word, the last as it is typed', async () => {
    const index = await indexed()
    const result = index.search('lant bur')
    expect(result.total).toBe(1)
    expect(result.words).toEqual(['lant', 'bur'])
    const [group] = result.groups
    expect(group.doc.name).toBe('Test Handbook')
    expect(group.total).toBe(1)
    expect(group.hits[0].heading.anchor).toBe('packing')
    expect(group.hits[0].chapter).toBe('Chapter 1: Wanderers')
  })

  it('gives each hit the address of its heading, with the search to mark', async () => {
    const index = await indexed()
    const { hits } = index.search('  dragon ').groups[0]
    expect(hits[0].place).toEqual({
      kind: 'book',
      id: 'TST',
      chapter: 0,
      anchor: 'read-aloud',
      find: 'dragon',
    })
  })

  it('leaves the anchor out for a hit under a chapter heading', async () => {
    const index = await indexed()
    expect(index.search('goblin country').groups[0].hits[0].place.anchor).toBeNull()
  })

  it('finds nothing for words no block holds together', async () => {
    const index = await indexed()
    expect(index.search('dragon lantern')).toEqual({
      words: ['dragon', 'lantern'],
      groups: [],
      total: 0,
    })
    expect(index.search('zzzz').total).toBe(0)
  })

  it('finds nothing for a search with no usable word', async () => {
    const index = await indexed()
    expect(index.search('a').groups).toEqual([])
  })

  it('puts the blocks that hold the words together first', async () => {
    const index = createBookIndex()
    const text: Scan = {
      headings: [{ chapter: 0, anchor: 'c', name: 'C', depth: 0, box: false }],
      blocks: [
        { text: 'The dragon sleeps; a red cloak lies near.', heading: 0 },
        { text: 'A red dragon wakes.', heading: 0 },
      ],
      anchors: new Map(),
      ids: new Map(),
      maps: new Map(),
    }
    await index.addDoc({ kind: 'book', id: 'X', name: 'X' }, text)
    const hits = index.search('red dragon').groups[0].hits
    expect(hits.map((h) => h.block)).toEqual([1, 0])
  })

  it('groups the hits by document, the document with the most first', async () => {
    const index = await indexed()
    await index.addDoc(
      { kind: 'adventure', id: 'ADV', name: 'An Adventure' },
      {
        headings: [{ chapter: 0, anchor: 'one', name: 'One', depth: 0, box: false }],
        blocks: [
          { text: 'rope here', heading: 0 },
          { text: 'more rope there', heading: 0 },
        ],
        anchors: new Map(),
        ids: new Map(),
        maps: new Map(),
      },
    )
    const result = index.search('rope')
    expect(result.groups.map((g) => [g.doc.id, g.total])).toEqual([
      ['TST', 3],
      ['ADV', 2],
    ])
    expect(result.total).toBe(5)
  })

  it('cuts a snippet around the words', async () => {
    const index = await indexed()
    const result = index.search('lantern')
    const snippet = index.snippet(result.groups[0].hits[0], result.words)
    expect(snippet).toBeTruthy()
  })

  it('gives the page back while a large document is read', async () => {
    const index = createBookIndex()
    const blocks = Array.from({ length: 50 }, (_, i) => ({
      text: `block number ${i} holds many words`,
      heading: 0,
    }))
    // Every look at the clock finds the slice used up.
    let time = 0
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => (time += 100))
    try {
      await index.addDoc(
        { kind: 'book', id: 'BIG', name: 'Big' },
        {
          headings: [{ chapter: 0, anchor: 'a', name: 'A', depth: 0, box: false }],
          blocks,
          anchors: new Map(),
          ids: new Map(),
          maps: new Map(),
        },
      )
    } finally {
      clock.mockRestore()
    }
    expect(index.size().blocks).toBe(50)
    expect(index.search('number 49').total).toBe(1)
  })
})
