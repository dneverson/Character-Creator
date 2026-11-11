// TypeScript shapes for the subset of 5etools data the app consumes.
// Grown incrementally as each creator section is built.

/** A book cover reference. Only `type: "internal"` (a path in the image repo) is used. */
export interface BookCover {
  type: string
  path: string
}

/**
 * One heading in a chapter's table of contents; a sub-heading carries a
 * depth/statblock flag. `page` is not in `books.json`: it is worked out from the
 * book's text when its details are opened (src/data/bookPages.ts), and is absent
 * for headings neither the text nor the entity they point at gives a page for.
 */
export type BookHeader =
  string | { header: string; depth?: number; statblock?: boolean; page?: number }

/** A chapter or appendix in a book's table of contents. */
export interface BookContentEntry {
  name: string
  /** Present for numbered chapters/appendices; front matter has none. */
  ordinal?: { type: 'chapter' | 'appendix'; identifier?: number | string }
  headers?: BookHeader[]
  /** Page the chapter/appendix opens on (src/data/bookPages.ts); absent if unknown. */
  page?: number
}

/** A sourcebook entry from `books.json`. */
export interface Book {
  name: string
  id: string
  source: string
  group?: string
  published?: string
  author?: string
  cover?: BookCover
  coverCredit?: string
  contents?: BookContentEntry[]
}

export interface BooksFile {
  book: Book[]
}

/** Anything that carries a source code (used for book filtering). */
export interface Sourced {
  source: string
  page?: number
}
