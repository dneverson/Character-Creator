import { describe, expect, it } from 'vitest'
import { fixtureSections } from '../test/bookFixture'
import { scan, type Scan } from './outline'
import { tokenize } from './tokenize'

const small: Scan = {
  headings: [{ chapter: 0, anchor: 'c', name: 'C', depth: 0, box: false }],
  blocks: [
    { text: 'A red dragon.', heading: 0 },
    { text: 'The dragon, the DRAGON!', heading: 0 },
  ],
  anchors: new Map(),
  ids: new Map(),
  maps: new Map(),
}

/** The block numbers of one word, read the way the index reads them. */
function blocksOf(word: string, tokens: ReturnType<typeof tokenize>): number[] {
  const i = tokens.words.indexOf(word)
  return [...tokens.ids.slice(tokens.offsets[i], tokens.offsets[i + 1])]
}

describe('the words of a document', () => {
  it('lists each word once with the blocks it is in, in order', () => {
    const tokens = tokenize(small)
    expect(tokens.words).toEqual(['a', 'dragon', 'red', 'the'])
    expect(blocksOf('dragon', tokens)).toEqual([0, 1])
    expect(blocksOf('the', tokens)).toEqual([1])
    expect(tokens.offsets).toHaveLength(tokens.words.length + 1)
  })

  it('carries the text and heading of every block', () => {
    const tokens = tokenize(small)
    expect(tokens.texts).toEqual(['A red dragon.', 'The dragon, the DRAGON!'])
    expect(tokens.blockHeading).toEqual([0, 0])
    expect(tokens.headings).toBe(small.headings)
  })

  it('reads a whole book', () => {
    const book = scan(fixtureSections)
    const tokens = tokenize(book)
    expect(tokens.texts).toHaveLength(book.blocks.length)
    expect(tokens.words).toContain('lantern')
  })
})
