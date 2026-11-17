// The address of a place in a book, as the address bar spells it, and how something that
// is not an address yet (an entry printed on a page, a heading's name) becomes one.
//
//   #/books                              the shelf of books
//   #/book/<id>                          a book, at the place the reader last left it
//   #/book/<id>/<chapter>                a chapter (its position in the text, from 0)
//   #/book/<id>/<chapter>/<heading>      a heading in the chapter
//   #/book/<id>/<chapter>/<heading>?find=<words>   the same, with the words marked
//   #/adventure/<id>...                  the same, for an adventure
//
// The heading is the slug of its name (see `slugOf`), which is what the text's own
// `{@book text|id|chapter|heading}` links name, so those links need no translation.

import type { BookDoc, BookPlace, DocKind } from './types'
import { slugOf, type Heading } from './outline'

const KINDS: readonly string[] = ['book', 'adventure']

/** The hash of the shelf, or of a place in a book. */
export function formatBookHash(place: BookPlace | null): string {
  if (!place) return '#/books'
  const head = `#/${place.kind}/${encodeURIComponent(place.id)}`
  const where =
    place.chapter === null
      ? ''
      : `/${place.chapter}${place.anchor ? `/${encodeURIComponent(place.anchor)}` : ''}`
  return `${head}${where}${place.find ? `?find=${encodeURIComponent(place.find)}` : ''}`
}

/**
 * The place a hash names: `null` for the shelf, `undefined` when the hash is not about
 * the books at all (or names a place that cannot exist).
 */
export function parseBookHash(hash: string): BookPlace | null | undefined {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?')
  const parts = path.split('/').filter(Boolean)
  const [head, id, chapter, anchor] = parts
  if (head === 'books') return parts.length === 1 ? null : undefined
  if (!KINDS.includes(head) || !id || parts.length > 4) return undefined
  try {
    const number = chapter === undefined ? null : Number(chapter)
    if (number !== null && !(Number.isInteger(number) && number >= 0)) return undefined
    const find = new URLSearchParams(query).get('find')
    return {
      kind: head as DocKind,
      id: decodeURIComponent(id),
      chapter: number,
      anchor: anchor ? decodeURIComponent(anchor) : null,
      find: find || null,
    }
  } catch {
    return undefined
  }
}

/** The book or adventure a source code names. A book's id is its source. */
export function docOfSource(
  docs: readonly BookDoc[],
  source: string,
  kind?: DocKind,
): BookDoc | undefined {
  const wanted = source.toLowerCase()
  return docs.find(
    (doc) => doc.id.toLowerCase() === wanted && (!kind || doc.kind === kind),
  )
}

/** What a place is asked for by: a page of the book, or the name of a heading. */
export interface PlaceQuery {
  page?: number
  name?: string
}

/**
 * The place in a book that an entry printed there lives at: the heading of that name
 * when the book has one, else the last heading that starts on or before the page.
 * With neither it is the start of the book.
 */
export function placeInBook(
  doc: Pick<BookDoc, 'kind' | 'id'>,
  headings: readonly Heading[],
  { page, name }: PlaceQuery,
): BookPlace {
  const place = (heading: Heading | undefined): BookPlace => ({
    kind: doc.kind,
    id: doc.id,
    chapter: heading?.chapter ?? 0,
    anchor: heading && heading.depth > 0 ? heading.anchor : null,
    find: null,
  })
  if (name) {
    const slug = slugOf(name)
    const named =
      headings.find((h) => h.anchor === slug && !h.box) ??
      headings.find((h) => h.anchor === slug)
    if (named) return place(named)
  }
  if (page !== undefined) {
    let found: Heading | undefined
    for (const heading of headings) {
      if (heading.page !== undefined && heading.page <= page) found = heading
    }
    if (found) return place(found)
  }
  return place(headings[0])
}

/**
 * The place a `{@book text|id|chapter|heading}` or `{@adventure ...}` tag names, with
 * the text it shows. The chapter and the heading are optional; the heading is a
 * heading's name, which is turned into its anchor.
 */
export function placeOfTag(
  tag: string,
  content: string,
): { place: BookPlace; text: string } | null {
  if (tag !== 'book' && tag !== 'adventure') return null
  const [text, id, chapter, heading] = content.split('|').map((part) => part.trim())
  if (!id) return null
  const number = chapter === undefined || chapter === '' ? null : Number(chapter)
  const valid = number !== null && Number.isInteger(number) && number >= 0
  return {
    text: text || id,
    place: {
      kind: tag,
      id,
      chapter: valid ? number : null,
      anchor: valid && heading ? slugOf(heading) || null : null,
      find: null,
    },
  }
}
