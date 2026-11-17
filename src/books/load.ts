// The text of one book or adventure, read when it is opened and never before. The full
// content library answers from this browser's storage, or downloads the file and stores it.
// The few most recently read texts stay in memory so moving between chapters is instant.

import { appConfig } from '../config/app'
import { contentEpoch } from '../content/epoch'
import { bookSections } from '../data/bookPages'
import { fetchDataUncached } from '../data/dataClient'
import type { Entry } from '../text/Entries'
import { docPath } from './catalog'
import { expandBook } from './expand'
import { withEntityPages } from './entityPages'
import { scan, type Scan } from './outline'
import type { DocKind } from './types'

/** A document's text, with what was read from it. */
export interface BookText {
  /** One entry per chapter, as the text file has them. */
  sections: Entry[]
  scan: Scan
}

/** Read a text file's chapters, or null when the file is not a book's text. */
export function sectionsOf(file: unknown, id: string): Entry[] | null {
  return bookSections(file, id) as Entry[] | null
}

/**
 * Read a document's text without keeping it (the search reads each one this way). The
 * pages of what the text only names are read only for reading: the search has no use for
 * them, and they are the data files of every kind of entry.
 */
export async function readBookText(
  kind: DocKind,
  id: string,
  withPages = false,
): Promise<BookText> {
  const file = await fetchDataUncached<unknown>(docPath(kind, id))
  const read = sectionsOf(file, id)
  if (!read) throw new Error(`"${id}" is not a book text`)
  const expanded = await expandBook(read, id)
  const sections = withPages ? await withEntityPages(expanded, id) : expanded
  return { sections, scan: scan(sections) }
}

const recent = new Map<string, Promise<BookText>>()
let epoch = contentEpoch()

/** A document's text for reading: the last few stay in memory. A failure is not kept. */
export function loadBookText(kind: DocKind, id: string): Promise<BookText> {
  if (epoch !== contentEpoch()) {
    recent.clear()
    epoch = contentEpoch()
  }
  const key = `${kind}/${id}`
  const kept = recent.get(key)
  if (kept) {
    // Most recently read last.
    recent.delete(key)
    recent.set(key, kept)
    return kept
  }
  const text = readBookText(kind, id, true)
  text.catch(() => recent.delete(key))
  recent.set(key, text)
  while (recent.size > appConfig.books.keepLastBooks) {
    recent.delete(recent.keys().next().value as string)
  }
  return text
}

/** Test-only: forget the texts kept in memory. */
export function _clearBookTexts(): void {
  recent.clear()
}
