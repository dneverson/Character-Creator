// Which rules edition a piece of content is written for. Spells and items share
// the one rule: a book published from the 2024 Player's Handbook on is the 2024
// edition ("one"), anything earlier is the 2014 edition ("classic").

import { fetchData } from './dataClient'
import type { BooksFile } from './types'

export type Edition = 'classic' | 'one'

/** Rules published from the 2024 Player's Handbook on are the 2024 edition. */
export const ONE_RULES_FROM = '2024-09-17'

/** The edition of a book published on this date (ISO), 2014 when the date is unknown. */
export const editionOfPublished = (published: string | undefined): Edition =>
  published !== undefined && published >= ONE_RULES_FROM ? 'one' : 'classic'

/** The edition of each book, by its source code, from the books list. */
export async function loadBookEditions(): Promise<(source: string) => Edition> {
  const books = await fetchData<Partial<BooksFile>>('books.json')
  const published = new Map(
    (books.book ?? []).map((book) => [book.source, book.published]),
  )
  return (source) => editionOfPublished(published.get(source))
}
