import { describe, expect, it } from 'vitest'
import { fixtureDoc, fixtureSections } from '../test/bookFixture'
import {
  docOfSource,
  formatBookHash,
  parseBookHash,
  placeInBook,
  placeOfArea,
  placeOfTag,
} from './address'
import { scan } from './outline'
import type { BookPlace } from './types'

const place = (over: Partial<BookPlace> = {}): BookPlace => ({
  kind: 'book',
  id: 'PHB',
  chapter: null,
  anchor: null,
  find: null,
  ...over,
})

describe('the address of a place in a book', () => {
  it.each([
    [null, '#/books'],
    [place(), '#/book/PHB'],
    [place({ chapter: 3 }), '#/book/PHB/3'],
    [place({ chapter: 3, anchor: 'the-road' }), '#/book/PHB/3/the-road'],
    [
      place({
        kind: 'adventure',
        id: 'CoS',
        chapter: 0,
        anchor: 'a',
        find: 'red dragon',
      }),
      '#/adventure/CoS/0/a?find=red%20dragon',
    ],
  ])('is written and read back: %j', (value, hash) => {
    expect(formatBookHash(value)).toBe(hash)
    expect(parseBookHash(hash)).toEqual(value)
  })

  it('leaves out an anchor when the chapter is not named', () => {
    expect(formatBookHash(place({ anchor: 'x' }))).toBe('#/book/PHB')
  })

  it('is not read from an address about anything else', () => {
    for (const hash of [
      '#/',
      '#/lookup',
      '#/c/1/sheet',
      '#/books/x',
      '#/book',
      '#/book/a/1/b/c',
    ])
      expect(parseBookHash(hash)).toBeUndefined()
  })

  it('is not read when the chapter is not a position or the text is not decodable', () => {
    expect(parseBookHash('#/book/PHB/two')).toBeUndefined()
    expect(parseBookHash('#/book/PHB/-1')).toBeUndefined()
    expect(parseBookHash('#/book/PHB/1.5')).toBeUndefined()
    expect(parseBookHash('#/book/%E0%A4%A')).toBeUndefined()
  })
})

describe('finding the book an entry names', () => {
  const docs = [fixtureDoc, { ...fixtureDoc, kind: 'adventure' as const, id: 'CoS' }]

  it('matches the source without regard to case', () => {
    expect(docOfSource(docs, 'tst')?.id).toBe('TST')
  })

  it('can be limited to books or adventures', () => {
    expect(docOfSource(docs, 'cos', 'book')).toBeUndefined()
    expect(docOfSource(docs, 'cos', 'adventure')?.id).toBe('CoS')
  })
})

describe('where an entry lives in its book', () => {
  const { headings } = scan(fixtureSections)
  const at = (over: Partial<BookPlace>) => place({ id: 'TST', ...over })

  it('is the heading of its name when the book has one', () => {
    expect(placeInBook(fixtureDoc, headings, { name: 'Packing' })).toEqual(
      at({ chapter: 0, anchor: 'packing' }),
    )
  })

  it('is the last heading that starts on or before the page', () => {
    expect(placeInBook(fixtureDoc, headings, { page: 10 })).toEqual(
      at({ chapter: 1, anchor: 'packing' }),
    )
    expect(placeInBook(fixtureDoc, headings, { page: 9 })).toEqual(at({ chapter: 1 }))
  })

  it('prefers the name to the page', () => {
    expect(placeInBook(fixtureDoc, headings, { name: 'Packing', page: 9 }).chapter).toBe(
      0,
    )
  })

  it('takes the heading of that name that is on the page when several have it', () => {
    const twice = [
      ...headings,
      { chapter: 2, anchor: 'packing', name: 'Packing', depth: 1, box: false, page: 20 },
    ]
    expect(placeInBook(fixtureDoc, twice, { name: 'Packing', page: 21 }).chapter).toBe(2)
    expect(placeInBook(fixtureDoc, twice, { name: 'Packing', page: 11 }).chapter).toBe(1)
    expect(placeInBook(fixtureDoc, twice, { name: 'Packing', page: 1 }).chapter).toBe(0)
    expect(placeInBook(fixtureDoc, twice, { name: 'Packing' }).chapter).toBe(0)
  })

  it('takes a sidebar of that name when no heading has it', () => {
    expect(placeInBook(fixtureDoc, headings, { name: 'Read aloud' }).anchor).toBe(
      'read-aloud',
    )
  })

  it('is the start of the book when nothing matches', () => {
    expect(placeInBook(fixtureDoc, headings, { name: 'Nowhere', page: 1 })).toEqual(
      at({ chapter: 0 }),
    )
    expect(placeInBook(fixtureDoc, [], {})).toEqual(at({ chapter: 0 }))
  })
})

describe('the place a book tag names', () => {
  it('reads the text, the book, the chapter and the heading', () => {
    expect(placeOfTag('book', "Player's Handbook|PHB|5|Spell Slots")).toEqual({
      text: "Player's Handbook",
      place: place({ chapter: 5, anchor: 'spell-slots' }),
    })
  })

  it('names an adventure', () => {
    expect(placeOfTag('adventure', 'Curse|CoS|1')?.place).toEqual(
      place({ kind: 'adventure', id: 'CoS', chapter: 1 }),
    )
  })

  it('leaves the place to the reader when no chapter is given', () => {
    expect(placeOfTag('book', 'PHB|PHB')?.place.chapter).toBeNull()
    expect(placeOfTag('book', 'x|PHB|nope|Heading')?.place).toEqual(place())
  })

  it('shows the id when the tag has no text', () => {
    expect(placeOfTag('book', '|PHB')?.text).toBe('PHB')
  })

  it('is nothing for other tags or a tag without a book', () => {
    expect(placeOfTag('spell', 'a|PHB')).toBeNull()
    expect(placeOfTag('book', 'only text')).toBeNull()
  })
})

describe('areas', () => {
  const ids = new Map([['k1', { chapter: 3, anchor: 'keep', name: 'The Keep' }]])
  const doc = { kind: 'adventure' as const, id: 'TST' }

  it('names the place of an area key, with its own text or the heading name', () => {
    expect(placeOfArea('area', '12|k1|x', doc, ids)).toEqual({
      text: '12',
      place: { kind: 'adventure', id: 'TST', chapter: 3, anchor: 'keep', find: null },
    })
    expect(placeOfArea('area', '|k1', doc, ids)?.text).toBe('The Keep')
  })

  it('is nothing for another tag or an unknown key', () => {
    expect(placeOfArea('b', '1|k1', doc, ids)).toBeNull()
    expect(placeOfArea('area', '1|zz', doc, ids)).toBeNull()
    expect(placeOfArea('area', '1', doc, ids)).toBeNull()
  })
})
