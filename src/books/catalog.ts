// The books and adventures the reader can open, from the catalog files the content
// source (or the free rules) provides. Only the catalog: the text of a book is read
// when the book is opened (see ./load.ts).

import { memoizeContent } from '../content/epoch'
import { coverPath } from '../data/covers'
import { fetchData } from '../data/dataClient'
import { registerBookSources } from '../data/glossary'
import type { Book } from '../data/types'
import type { BookDoc, DocKind } from './types'

interface Adventure extends Book {
  storyline?: string
}

/** The data path of a document's text file. */
export const docPath = (kind: DocKind, id: string): string =>
  `${kind}/${kind}-${id.toLowerCase()}.json`

function docOf(kind: DocKind, entry: Adventure): BookDoc {
  return {
    kind,
    id: entry.id,
    name: entry.name,
    group: entry.group,
    published: entry.published,
    author: entry.author,
    storyline: entry.storyline,
    cover: coverPath(entry.cover),
  }
}

/** Every book, then every adventure, as the catalog lists them. */
export const loadBookDocs = memoizeContent(async (): Promise<BookDoc[]> => {
  const [books, adventures] = await Promise.all([
    fetchData<{ book?: Book[] }>('books.json'),
    // The free rules have no adventures; a catalog that cannot be had is no adventures.
    fetchData<{ adventure?: Adventure[] }>('adventures.json').catch(() => ({
      adventure: [] as Adventure[],
    })),
  ])
  // An adventure's code is named by the same lookup as a book's (footers, tooltips).
  registerBookSources(adventures.adventure ?? [])
  return [
    ...(books.book ?? []).map((entry) => docOf('book', entry)),
    ...(adventures.adventure ?? []).map((entry) => docOf('adventure', entry)),
  ]
})
