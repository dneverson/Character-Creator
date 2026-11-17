// Finding words inside one book: which chapters hold them, so the reader can step from
// match to match across chapters. It reads the book's own blocks, the same ones the
// search indexes, with the same rule: every word starts a word of the block.

import { wordsIn } from '../lookup/search'
import type { Scan } from './outline'

/** The chapters of a book whose text holds all of `words`, in reading order. */
export function chaptersWith(scan: Scan, words: readonly string[]): number[] {
  if (words.length === 0) return []
  const found = new Set<number>()
  for (const block of scan.blocks) {
    const chapter = scan.headings[block.heading].chapter
    if (found.has(chapter)) continue
    const own = wordsIn(block.text)
    if (words.every((word) => own.some((w) => w.startsWith(word)))) found.add(chapter)
  }
  return [...found].sort((a, b) => a - b)
}
