// The names a book's table of contents lists, by chapter. `books.json` (and
// `adventures.json`) list the headings of each chapter as the printed book does, among them
// the stat blocks the text sets without a heading of their own (the creatures of an
// appendix, the backgrounds of a chapter). The outline names such a block a heading exactly
// when the contents list it at that place (see `scan`).

import { matchSectionIndex } from '../data/bookPages'
import { fetchData } from '../data/dataClient'
import type { Book } from '../data/types'
import type { Entry } from '../text/Entries'
import { slugOf } from './outline'
import type { DocKind } from './types'

/** The slugs (see `slugOf`) of the names the contents list, by index of the chapter. */
export type Listed = ReadonlyMap<number, ReadonlySet<string>>

/** The names a document's contents list for each of its chapters; none when it has none. */
export function listedIn(book: Book | undefined, sections: Entry[]): Listed {
  const listed = new Map<number, Set<string>>()
  const chapters = book?.contents ?? []
  chapters.forEach((chapter, index) => {
    const at = matchSectionIndex(chapter.name, sections)
    // The contents are in the order of the chapters: the same place when the counts agree.
    const place = at >= 0 ? at : chapters.length === sections.length ? index : -1
    if (place < 0) return
    const names = listed.get(place) ?? new Set<string>()
    for (const header of chapter.headers ?? []) {
      names.add(slugOf(typeof header === 'string' ? header : header.header))
    }
    listed.set(place, names)
  })
  return listed
}

/** The names the catalog's contents list for a document, or none when it cannot be had. */
export async function listedFor(
  kind: DocKind,
  id: string,
  sections: Entry[],
): Promise<Listed> {
  try {
    const books =
      kind === 'book'
        ? (await fetchData<{ book?: Book[] }>('books.json')).book
        : (await fetchData<{ adventure?: Book[] }>('adventures.json')).adventure
    return listedIn(
      books?.find((entry) => entry.id === id),
      sections,
    )
  } catch {
    return new Map()
  }
}
