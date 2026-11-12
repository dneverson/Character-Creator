// Sorting an entry's facts into the places of a book entry: a summary line, the
// printing (source, page, free rules), short "Label value" pairs, and running text.
// Which fact goes where comes from the fact's own `role`, and, for the rest, from how
// long its text is; nothing here knows what the entry is. Every fact the plain
// detail shows is placed somewhere, so the book style loses nothing.

import type { ReactNode } from 'react'
import { factValue, groupTitle, type FactGroup } from './facts'

/** Text longer than this is not a pair on a line but a paragraph of its own. */
const PAIR_LIMIT = 80

export interface BookBlock {
  key: string
  /** Run in before the text ("At higher levels."); the entry's own text has none. */
  label?: ReactNode
  value: ReactNode
}

export interface BookLayout {
  /** The short facts that say what the entry is, in order. */
  summary: ReactNode[]
  /** Where it is printed: its source as drawn, and the page ("p. 215"). */
  source: ReactNode
  page: string
  /** The source's plain text (the book code) and the page number alone, for the footer. */
  sourceCode: string
  pageNumber: string
  free: boolean
  pairs: BookBlock[]
  blocks: BookBlock[]
  /** What a group with nothing in it says. */
  empty: string[]
}

export function bookLayout<T>(
  groups: FactGroup<T>[],
  entry: T,
  tags: string[],
): BookLayout {
  const layout: BookLayout = {
    summary: [],
    source: null,
    page: '',
    sourceCode: '',
    pageNumber: '',
    free: false,
    pairs: [],
    blocks: [],
    empty: [],
  }
  for (const group of groups) {
    const heading = groupTitle(group, entry)
    let shown = 0
    for (const fact of group.facts) {
      const value = factValue(fact, entry)
      if (value === null) continue
      shown++
      const text = fact.text(entry)
      const key = `${group.key}-${fact.key}`
      if (fact.role === 'summary') layout.summary.push(value)
      else if (fact.role === 'source') {
        layout.source = value
        layout.sourceCode = text
      } else if (fact.role === 'page') {
        layout.page = text
        layout.pageNumber = text.replace(/^p\.\s*/, '')
      } else if (fact.role === 'free') layout.free = true
      // The edition is already among the entry's tags, which the book style prints.
      else if (fact.role === 'edition' && tags.includes(text)) continue
      else if (fact.role === 'body') layout.blocks.push({ key, value })
      else if (text.length > PAIR_LIMIT)
        layout.blocks.push({ key, label: fact.label, value })
      else layout.pairs.push({ key, label: fact.label, value })
    }
    if (shown === 0 && group.empty)
      layout.empty.push(heading ? `${heading}: ${group.empty}` : group.empty)
  }
  return layout
}
