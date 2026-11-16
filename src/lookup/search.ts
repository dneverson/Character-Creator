// The search of Quick lookup. Names are matched by their words; the text of every entry
// goes through one in-memory index of words, built once from the loaded rows in small
// slices so the page stays responsive while it is built. A search reads the index, never
// the rows' text, except to cut the snippet of each hit.

import { appConfig } from '../config/app'
import { rowText } from './rows'
import type { LookupKind, LookupRow } from './types'

/** A search: the words to look for, and the kind to keep (all kinds when absent). */
export interface LookupQuery {
  text: string
  kind?: LookupKind
}

export interface LookupHit {
  row: LookupRow
  /** The words of the text around the first match, when the match is in the text. */
  snippet?: Snippet
}

/** A piece of text with the matched part marked. */
export interface Snippet {
  before: string
  match: string
  after: string
}

export interface LookupSearchResult {
  hits: LookupHit[]
  /** How many rows matched, before the table's cap. */
  total: number
}

export interface LookupIndex {
  rows: LookupRow[]
  search: (query: LookupQuery) => LookupSearchResult
}

/** The lower-case words of a text: letters and digits, so "Fire-ball's" is fire, ball, s. */
export const wordsIn = (text: string): string[] =>
  text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []

const nextSlice = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/** Builds the index, giving the page back every `sliceMs`. */
export async function buildIndex(
  rows: LookupRow[],
  sliceMs: number = appConfig.lookup.sliceMs,
): Promise<LookupIndex> {
  const postings = new Map<string, number[]>()
  const nameWords: string[][] = []
  let sliceStart = performance.now()
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const words = new Set(wordsIn(rowText(row)))
    const names = wordsIn(`${row.name} ${row.context ?? ''}`)
    nameWords.push(names)
    for (const word of [...words, ...names]) {
      const list = postings.get(word)
      if (!list) postings.set(word, [i])
      else if (list[list.length - 1] !== i) list.push(i)
    }
    if (performance.now() - sliceStart > sliceMs) {
      await nextSlice()
      sliceStart = performance.now()
    }
  }
  const sorted = [...postings.keys()].sort()
  return {
    rows,
    search: (query) => searchIndex(rows, postings, sorted, nameWords, query),
  }
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

/** The rows that have a word starting with this one. */
function rowsWithPrefix(
  postings: Map<string, number[]>,
  sorted: string[],
  prefix: string,
): Set<number> {
  const found = new Set<number>()
  for (let i = lowerBound(sorted, prefix); i < sorted.length; i++) {
    if (!sorted[i].startsWith(prefix)) break
    for (const row of postings.get(sorted[i]) ?? []) found.add(row)
  }
  return found
}

/** Higher is better: a name that is the search, then one that starts with it. */
function nameScore(name: string, wordsOfName: string[], text: string, words: string[]) {
  const lower = name.toLowerCase()
  if (lower === text) return 4
  if (lower.startsWith(text)) return 3
  if (words.every((w) => wordsOfName.some((n) => n.startsWith(w)))) return 2
  return lower.includes(text) ? 1 : 0
}

function searchIndex(
  rows: LookupRow[],
  postings: Map<string, number[]>,
  sorted: string[],
  nameWords: string[][],
  { text, kind }: LookupQuery,
): LookupSearchResult {
  const query = text.trim().toLowerCase()
  const words = wordsIn(query)
  const inKind = (row: LookupRow) => kind === undefined || row.kind === kind
  if (words.length === 0) {
    // No words: the whole kind, if one is picked, else nothing.
    const all = kind === undefined ? [] : rows.filter(inKind)
    return {
      hits: all.slice(0, appConfig.lookup.maxRows).map((row) => ({ row })),
      total: all.length,
    }
  }
  // Every word must start a word of the entry's text (or of its name).
  let matched: Set<number> | undefined
  for (const word of words) {
    const these = rowsWithPrefix(postings, sorted, word)
    matched = matched ? new Set([...matched].filter((i) => these.has(i))) : these
  }
  const scored: { index: number; score: number }[] = []
  for (const index of matched ?? []) {
    if (!inKind(rows[index])) continue
    scored.push({
      index,
      score: nameScore(rows[index].name, nameWords[index], query, words),
    })
  }
  scored.sort((a, b) => b.score - a.score || a.index - b.index)
  return {
    total: scored.length,
    hits: scored.slice(0, appConfig.lookup.maxRows).map(({ index, score }) => ({
      row: rows[index],
      ...(score === 0 && { snippet: snippetOf(rowText(rows[index]), words) }),
    })),
  }
}

/** The text around the first place a search word starts a word, or none. */
export function snippetOf(
  text: string,
  words: string[],
  width: number = appConfig.lookup.snippetChars,
): Snippet | undefined {
  const lower = text.toLowerCase()
  let at = -1
  let length = 0
  for (const word of words) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(word)}[\\p{L}\\p{N}]*`, 'u')
    const hit = re.exec(lower)
    if (hit && (at === -1 || hit.index < at)) {
      at = hit.index
      length = hit[0].length
    }
  }
  if (at === -1) return undefined
  const start = Math.max(0, at - Math.floor(width / 6))
  const end = Math.min(text.length, at + length + width)
  return {
    before: `${start > 0 ? '...' : ''}${text.slice(start, at)}`,
    match: text.slice(at, at + length),
    after: `${text.slice(at + length, end)}${end < text.length ? '...' : ''}`,
  }
}

const escapeRegExp = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
