// The search across every book and adventure on this device. One in-memory index of the
// words of every block of text (a paragraph, a list item, a table row), built in small
// slices so the page stays responsive. Documents are added one at a time, so a book read
// or downloaded later joins the index without building it again.
// The words of a document are found off the page's thread (`docReader`); the index only
// keeps them.
//
// A search finds the blocks in which every word of the search starts a word, the last
// word being the one still being typed. It reads the index, never the text, except to
// cut the snippet of each result shown.

import { appConfig } from '../config/app'
import { snippetOf, wordsIn, type Snippet } from '../lookup/search'
import type { Heading, Scan } from './outline'
import { tokenize, type DocTokens } from './tokenize'
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
  /** Add a document, giving the page back every `sliceMs` while its words are merged in. */
  addTokens: (
    doc: Omit<IndexedDoc, 'headings' | 'chapters'>,
    tokens: DocTokens,
  ) => Promise<void>
  /** Add a document from its text (the words are found here, on this thread). */
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

/** What the index knows of the words of one document: see `DocTokens`. */
interface Postings {
  /** The number the document's first block has among the blocks of every document. */
  base: number
  words: string[]
  offsets: Uint32Array
  ids: Uint32Array
}

export function createBookIndex(): BookIndex {
  const docs: IndexedDoc[] = []
  const known = new Set<string>()
  const texts: string[] = []
  const blockDoc: number[] = []
  const blockHeading: number[] = []
  /** The words of each document, by document: a word is looked up in each in turn. */
  const postings: Postings[] = []

  /**
   * Marks (1) the blocks with a word starting `prefix`, among those of document `from`
   * (every document when none).
   */
  const blocksWith = (prefix: string, from?: number): Uint8Array => {
    const marked = new Uint8Array(texts.length)
    for (const { base, words, offsets, ids } of from === undefined
      ? postings
      : postings.slice(from, from + 1)) {
      for (let i = lowerBound(words, prefix); i < words.length; i++) {
        if (!words[i].startsWith(prefix)) break
        for (let at = offsets[i]; at < offsets[i + 1]; at++) marked[base + ids[at]] = 1
      }
    }
    return marked
  }

  const addTokens: BookIndex['addTokens'] = async (meta, tokens) => {
    const { headings, words, offsets, ids } = tokens
    const chapters: string[] = []
    for (const heading of headings)
      if (heading.depth === 0) chapters[heading.chapter] = heading.name
    const base = texts.length
    let sliceStart = performance.now()
    for (const [i, text] of tokens.texts.entries()) {
      texts.push(text)
      blockDoc.push(docs.length)
      blockHeading.push(tokens.blockHeading[i])
      if (performance.now() - sliceStart > appConfig.books.sliceMs) {
        await nextSlice()
        sliceStart = performance.now()
      }
    }
    // The document is found by a search only once all of it is here.
    docs.push({ ...meta, headings, chapters })
    postings.push({ base, words, offsets, ids })
    known.add(`${meta.kind}/${meta.id}`)
  }

  return {
    addTokens,
    addDoc: (meta, scan) => addTokens(meta, tokenize(scan)),

    has: (kind, id) => known.has(`${kind}/${id}`),

    size: () => ({ docs: docs.length, blocks: texts.length }),

    search(text, only) {
      const words = searchWords(text)
      if (words.length === 0) return { words, groups: [], total: 0 }
      const scope = only
        ? docs.findIndex((doc) => doc.kind === only.kind && doc.id === only.id)
        : undefined
      // A block matches when every word marks it; the blocks come out in the order of the text.
      const [first, ...others] = words.map((word) => blocksWith(word, scope))
      for (const other of others)
        for (let i = 0; i < first.length; i++) first[i] &= other[i]
      const matched: number[] = []
      for (let block = 0; block < first.length; block++)
        if (first[block]) matched.push(block)
      const phrase = words.join(' ')
      /** Per document: the blocks that hold the words one after the other, and the rest. */
      const byDoc = new Map<number, { together: number[]; apart: number[] }>()
      for (const block of matched) {
        // A block holding the words one after the other reads better than one that
        // holds them apart.
        const together =
          words.length > 1 && wordsIn(texts[block]).join(' ').includes(phrase)
        let lists = byDoc.get(blockDoc[block])
        if (!lists) byDoc.set(blockDoc[block], (lists = { together: [], apart: [] }))
        ;(together ? lists.together : lists.apart).push(block)
      }
      const groups: BookHitGroup[] = [...byDoc].map(([docIndex, { together, apart }]) => {
        const doc = docs[docIndex]
        const keep = appConfig.books.maxHitsPerBook
        const best = [...together.slice(0, keep), ...apart.slice(0, keep)].slice(0, keep)
        return {
          doc,
          total: together.length + apart.length,
          hits: best.map((block) => {
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
