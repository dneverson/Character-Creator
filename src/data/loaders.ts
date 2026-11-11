// Loaders that turn raw 5etools JSON into the shapes the UI consumes.

import { fetchData } from './dataClient'
import { registerBookSources } from './glossary'
import type { Book, BooksFile } from './types'

/** Load the list of sourcebooks, newest core first then by name. */
export async function loadBooks(): Promise<Book[]> {
  const data = await fetchData<BooksFile>('books.json')
  // Warm the glossary so book-source codes (PHB, DMG, …) expand in tooltips
  // app-wide, always mirroring books.json without a separate maintained list.
  registerBookSources(data.book)
  return [...data.book].sort((a, b) => {
    // Core books first, then alphabetical by display name.
    const aCore = a.group === 'core' ? 0 : 1
    const bCore = b.group === 'core' ? 0 : 1
    if (aCore !== bCore) return aCore - bCore
    return a.name.localeCompare(b.name)
  })
}
