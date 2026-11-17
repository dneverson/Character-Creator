// The shapes of the book reader: what a book or adventure is in the catalog, and the
// address of a place in one.

/** The reader holds two kinds of documents, each with its own text file. */
export type DocKind = 'book' | 'adventure'

/** A book or an adventure as the catalog (`books.json`, `adventures.json`) lists it. */
export interface BookDoc {
  kind: DocKind
  /** The id in the catalog, which is also the id in the text file's name. */
  id: string
  name: string
  group?: string
  published?: string
  author?: string
  /** The adventure's storyline, when it belongs to one ("Tyranny of Dragons"). */
  storyline?: string
  /** The path of the cover in the image repository, or null when it has none. */
  cover: string | null
}

/**
 * A place in a book: the one address everything that points into a book uses (a
 * link in a text, a search result, the address bar).
 */
export interface BookPlace {
  kind: DocKind
  id: string
  /** The chapter's position in the book's text, from 0; null leaves it to the reader. */
  chapter: number | null
  /** A heading in the chapter (see `slugOf`); null is the top of the chapter. */
  anchor: string | null
  /** Words to find and mark in the text; null marks nothing. */
  find: string | null
}
