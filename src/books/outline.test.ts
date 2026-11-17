import { describe, expect, it } from 'vitest'
import { fixtureSections } from '../test/bookFixture'
import type { Entry } from '../text/Entries'
import { cellTextOf, scan, slugOf, startPageOf } from './outline'

describe('slugOf', () => {
  it('joins the words of a name with hyphens, in lower case', () => {
    expect(slugOf("Chapter 1: The Player's {@b Road}!")).toBe(
      'chapter-1-the-player-s-road',
    )
  })
})

describe('cellTextOf', () => {
  it('reads plain cells and rolls, and nothing else', () => {
    expect(cellTextOf('a {@b b}')).toBe('a b')
    expect(cellTextOf(7)).toBe('7')
    expect(cellTextOf({ type: 'cell', roll: { exact: 4 } })).toBe('4')
    expect(cellTextOf({ type: 'cell', roll: { min: 1, max: 3 } })).toBe('1-3')
    expect(cellTextOf({ entry: 'text' })).toBe('text')
    expect(cellTextOf({ type: 'cell' })).toBe('')
    expect(cellTextOf(null)).toBe('')
  })
})

describe('startPageOf', () => {
  it('is the page of a part, or of the part its first entry is', () => {
    const block = { type: 'statblock', tag: 'creature', name: 'Aboleth', page: 13 }
    expect(startPageOf({ type: 'section', name: 'A', page: 4, entries: [block] })).toBe(4)
    expect(startPageOf({ type: 'section', name: 'Aboleth', entries: [block] })).toBe(13)
    expect(
      startPageOf({ type: 'section', entries: [{ type: 'entries', entries: [block] }] }),
    ).toBe(13)
  })

  it('is nothing when the part starts with plain text', () => {
    const block = { type: 'statblock', page: 13 }
    expect(startPageOf({ type: 'section', entries: ['text', block] })).toBeUndefined()
    expect(startPageOf({ type: 'section', entries: [] })).toBeUndefined()
    expect(startPageOf('text')).toBeUndefined()
  })
})

describe('scan', () => {
  const result = scan(fixtureSections)

  it('lists the headings with their chapter, depth, box and page', () => {
    expect(
      result.headings.map((h) => [h.chapter, h.anchor, h.depth, h.box, h.page]),
    ).toEqual([
      [0, 'chapter-1-wanderers', 0, false, 3],
      [0, 'packing', 1, false, 4],
      [0, 'read-aloud', 2, true, undefined],
      [1, 'chapter-2-arrival', 0, false, 9],
      [1, 'packing', 1, false, 10],
    ])
  })

  it('gives a heading the page its first stat block is printed on', () => {
    const paged: Entry[] = [
      {
        type: 'section',
        name: 'Beasts',
        entries: [
          {
            type: 'section',
            name: 'Aboleth',
            entries: [{ type: 'statblock', tag: 'creature', name: 'Aboleth', page: 13 }],
          },
        ],
      },
    ]
    expect(scan(paged).headings.map((h) => [h.name, h.page])).toEqual([
      ['Beasts', 13],
      ['Aboleth', 13],
    ])
  })

  it('keeps an anchor of the same name apart within one chapter', () => {
    const twice: Entry[] = [
      {
        type: 'section',
        name: 'One',
        entries: [
          { type: 'entries', name: 'Same', entries: ['a'] },
          { type: 'entries', name: 'Same', entries: ['b'] },
        ],
      },
    ]
    expect(scan(twice).headings.map((h) => h.anchor)).toEqual(['one', 'same', 'same-2'])
  })

  it('reads the running text under the heading it sits in', () => {
    const texts = result.blocks.map((b) => [b.text, result.headings[b.heading].anchor])
    expect(texts).toContainEqual([
      'The road runs north through the goblin country.',
      'chapter-1-wanderers',
    ])
    expect(texts).toContainEqual(['Lantern Burns for six hours.', 'packing'])
    expect(texts).toContainEqual(['The dragon wakes slowly.', 'read-aloud'])
  })

  it('reads a table as its caption, labels and rows, and skips pictures and stat blocks', () => {
    const texts = result.blocks.map((b) => b.text)
    expect(texts).toContain('Supplies')
    expect(texts).toContain('Item | Cost')
    expect(texts).toContain('Lantern | 5 gp')
    expect(texts.join(' ')).not.toContain('old road')
    expect(texts).not.toContain('Goblin')
  })

  it('hands the renderer the anchor of each named node', () => {
    expect(result.anchors.get(fixtureSections[0] as object)).toBe('chapter-1-wanderers')
  })

  it('gives a chapter without a name a place of its own', () => {
    const unnamed = scan(['plain text', { type: 'entries', entries: ['b'] }])
    expect(unnamed.headings.map((h) => h.name)).toEqual(['Part 1', 'Part 2'])
    expect(unnamed.blocks).toHaveLength(2)
  })

  it('reads a quote with its author, numbers, and a named item', () => {
    const odd: Entry[] = [
      {
        type: 'section',
        name: 'Odd',
        entries: [
          { type: 'quote', entries: ['Words'], by: 'Someone' },
          { type: 'item', name: 'Alone', entries: ['inner'] },
          { type: 'table', rows: [{ type: 'row', row: ['x', 'y'] }, ['z']] },
          3,
        ],
      },
    ]
    const texts = scan(odd).blocks.map((b) => b.text)
    expect(texts).toEqual([
      'Odd',
      'Words',
      'Someone',
      'Alone',
      'inner',
      'x | y',
      'z',
      '3',
    ])
  })
})

describe('scan ids and maps', () => {
  const sections: Entry[] = [
    {
      type: 'section',
      name: 'Part',
      id: 'p0',
      entries: [
        { type: 'entries', name: 'Keep', id: 'k1', entries: ['a'] },
        { type: 'image', id: 'm1', title: 'Map 1', mapRegions: [{ area: 'k1' }] },
        {
          type: 'gallery',
          images: [{ type: 'image', id: 'm2', mapRegions: [{ area: 'k1' }] }],
        },
      ],
    },
  ]
  const result = scan(sections)

  it('finds a heading by its id, and a depth-0 one without an anchor', () => {
    expect(result.ids.get('k1')).toMatchObject({ chapter: 0, anchor: 'keep' })
    expect(result.ids.get('p0')).toMatchObject({ chapter: 0, anchor: null })
  })

  it('lists the pictures of each area, in a gallery too', () => {
    expect(result.maps.get('k1')?.map((t) => t.anchor)).toEqual(['image-m1', 'image-m2'])
  })
})
