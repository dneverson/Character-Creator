// The search across every book and adventure on this device. One in-memory index of the
// words of every block of text (a paragraph, a list item, a table row), built in small
// slices so the page stays responsive. Documents are added one at a time, so a book read
// or downloaded later joins the index without building it again.
//
// A search finds the blocks in which every word of the search starts a word, the last
// word being the one still being typed. It reads the index, never the text, except to
// cut the snippet of each result shown.

import { appConfig } from '../config/app'
import { snippetOf, wordsIn, type Snippet } from '../lookup/search'
import type { Heading, Scan } from './outline'
import type { BookPlace, DocKind } from './types'

/** A document as the index knows it. */
export interface IndexedDoc {
  kind: DocKind
  id: string
  name: string
  headings: Heading[]
  /** Chapter number to chapter name. */
  chapters: string[]
}

export interface BookHit {
  /** The block of text: pass it to `snippet`. */
  block: number
  /** The heading it sits under, and the chapter's name. */
  heading: Heading
  chapter: string
  /** The address of the heading, which opens the book there with the words marked. */
  place: BookPlace
}

export interface BookHitGroup {
  doc: IndexedDoc
  /** The best hits first, as many as the search keeps for one document. */
  hits: BookHit[]
  /** How many blocks of the document matched. */
  total: number
}

export interface BookSearchResult {
  /** The words searched for (what the reader marks in the text). */
  words: string[]
  groups: BookHitGroup[]
  /** Blocks matched across every document. */
  total: number
}

export interface BookIndex {
  /** Add a document, giving the page back every `sliceMs` while its blocks are read. */
  addDoc: (doc: Omit<IndexedDoc, 'headings' | 'chapters'>, scan: Scan) => Promise<void>
  has: (kind: DocKind, id: string) => boolean
  /** How many documents and blocks the index holds. */
  size: () => { docs: number; blocks: number }
  /** The search, over every document, or over the one document `only` names. */
  search: (text: string, only?: { kind: DocKind; id: string }) => BookSearchResult
  snippet: (hit: BookHit, words: string[]) => Snippet | undefined
}

/** The words of a search that count: a one-letter word narrows nothing. */
export function searchWords(text: string): string[] {
  const words = wordsIn(text)
  const long = words.filter((word) => word.length >= 2 || /\d/.test(word))
  return long.length > 0
    ? long
    : words.length === 1 && text.trim().length >= appConfig.books.minSearchChars
      ? words
      : []
}

/** The index of the first word that is not before `prefix` in the sorted words. */
function lowerBound(sorted: string[], prefix: string): number {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid] < prefix) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** Gives the page back for a moment. */
const nextSlice = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

export function createBookIndex(): BookIndex {
  const docs: IndexedDoc[] = []
  const known = new Set<string>()
  const texts: string[] = []
  const blockDoc: number[] = []
  const blockHeading: number[] = []
  const postings = new Map<string, number[]>()
  let sorted: string[] | null = null

  const blocksWith = (prefix: string): Set<number> => {
    sorted ??= [...postings.keys()].sort()
    const found = new Set<number>()
    for (let i = lowerBound(sorted, prefix); i < sorted.length; i++) {
      if (!sorted[i].startsWith(prefix)) break
      for (const block of postings.get(sorted[i]) ?? []) found.add(block)
    }
    return found
  }

  return {
    async addDoc(meta, { headings, blocks }) {
      const chapters: string[] = []
      for (const heading of headings)
        if (heading.depth === 0) chapters[heading.chapter] = heading.name
      const docIndex = docs.length
      docs.push({ ...meta, headings, chapters })
      known.add(`${meta.kind}/${meta.id}`)
      let sliceStart = performance.now()
      for (const block of blocks) {
        const id = texts.length
        texts.push(block.text)
        blockDoc.push(docIndex)
        blockHeading.push(block.heading)
        for (const word of new Set(wordsIn(block.text))) {
          const list = postings.get(word)
          if (!list) postings.set(word, [id])
          else list.push(id)
        }
        if (performance.now() - sliceStart > appConfig.books.sliceMs) {
          sorted = null
          await nextSlice()
          sliceStart = performance.now()
        }
      }
      sorted = null
    },

    has: (kind, id) => known.has(`${kind}/${id}`),

    size: () => ({ docs: docs.length, blocks: texts.length }),

    search(text, only) {
      const words = searchWords(text)
      if (words.length === 0) return { words, groups: [], total: 0 }
      // The smallest set first, so the others only have to be checked against it.
      const sets = words.map(blocksWith).sort((a, b) => a.size - b.size)
      const scope = only
        ? docs.findIndex((doc) => doc.kind === only.kind && doc.id === only.id)
        : undefined
      const matched = [...sets[0]].filter(
        (block) =>
          (scope === undefined || blockDoc[block] === scope) &&
          sets.every((set) => set.has(block)),
      )
      const phrase = words.join(' ')
      const byDoc = new Map<number, { block: number; score: number }[]>()
      for (const block of matched.sort((a, b) => a - b)) {
        // A block holding the words one after the other reads better than one that
        // holds them apart.
        const score =
          words.length > 1 && wordsIn(texts[block]).join(' ').includes(phrase) ? 1 : 0
        const list = byDoc.get(blockDoc[block])
        if (list) list.push({ block, score })
        else byDoc.set(blockDoc[block], [{ block, score }])
      }
      const groups: BookHitGroup[] = [...byDoc].map(([docIndex, list]) => {
        const doc = docs[docIndex]
        const best = [...list].sort((a, b) => b.score - a.score || a.block - b.block)
        return {
          doc,
          total: list.length,
          hits: best.slice(0, appConfig.books.maxHitsPerBook).map(({ block }) => {
            const heading = doc.headings[blockHeading[block]]
            return {
              block,
              heading,
              chapter: doc.chapters[heading.chapter] ?? heading.name,
              place: {
                kind: doc.kind,
                id: doc.id,
                chapter: heading.chapter,
                anchor: heading.depth > 0 ? heading.anchor : null,
                find: text.trim(),
              },
            }
          }),
        }
      })
      // The documents with the most to show first, then by name.
      groups.sort((a, b) => b.total - a.total || a.doc.name.localeCompare(b.doc.name))
      return { words, groups, total: matched.length }
    },

    snippet: (hit, words) =>
      snippetOf(texts[hit.block], words, appConfig.books.snippetChars),
  }
}
