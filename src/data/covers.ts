// Which image is a book's cover. Loading and showing it is the cover library's
// job (src/content/covers.ts).

import type { BookCover } from './types'

/**
 * The path of a book's cover inside the image repository, or null when the book
 * has no cover of the kind the content source hosts.
 */
export function coverPath(cover: BookCover | undefined): string | null {
  if (!cover || cover.type !== 'internal' || !cover.path) return null
  return cover.path
}
