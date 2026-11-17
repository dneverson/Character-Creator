// Which printing a document looks like. The catalog gives no edition, only the date a
// document was published, so everything published from the date of the 2024 core rules
// on is set in the look of the 2024 books, and the rest in the look of the 2014 ones.

import { appConfig } from '../config/app'
import type { BookDoc } from './types'

export type Edition = '2014' | '2024'

export function editionOf(doc: Pick<BookDoc, 'published'>): Edition {
  return doc.published !== undefined && doc.published >= appConfig.books.newEditionFrom
    ? '2024'
    : '2014'
}
