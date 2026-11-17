import { describe, expect, it } from 'vitest'
import { fixtureSections } from '../test/bookFixture'
import type { Entry } from '../text/Entries'
import { cellTextOf, scan, slugOf } from './outline'

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
