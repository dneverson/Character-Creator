// A book cut into pieces for the reader. The whole book is one scrolling page, but only the
// pieces near the reader are drawn: a piece far away is an empty box of its estimated or
// measured height. A chapter is cut at its headings (a named part is a heading piece and
// the pieces under it), and the entries between two headings are grouped into pieces of
// about a screen or two. Nothing is left out: the pieces together are the whole text.

import { appConfig } from '../config/app'
import type { Entry } from '../text/Entries'
import { wordPattern } from '../text/highlight'
import { stripTags } from '../text/tags'
import { headingKey, startPageOf, type Scan } from './outline'

/** One piece of the book: a heading drawn alone, or a run of entries. */
export interface Unit {
  chapter: number
  /** The named part whose heading this piece is; the piece holds nothing else. */
  title?: Entry
  entries: Entry[]
  /** The depth the entries (or the title) are drawn at. */
  depth: number
  /** The heading above the entries, when they begin its part (a stat block may not repeat it). */
  under?: string
  /** The key of the last heading before the piece ends: where the reader is in it. */
  heading: string
  /** The keys of the headings the piece draws, in reading order. */
  keys: string[]
  /** How tall the piece is before it has been drawn, in pixels. */
  height: number
  /** The page the piece starts, when the text marks one the page before it did not. */
  page?: number
  /** The page in force where the piece starts: the last one marked before it. */
  from?: number
}

/** The pieces of a book, and where its headings and chapters are among them. */
export interface Flow {
  units: Unit[]
  /** The piece that draws each heading or picture (by key). */
  byKey: Map<string, number>
  /** The first piece of each chapter. */
  starts: number[]
  /** The piece each marked page starts in, or first appears in. */
  pages: Map<number, number>
  /** The marked pages, lowest first; the last is the book's last page. */
  marked: number[]
}

interface Obj {
  type?: string
  name?: string
  style?: string
  entries?: Entry[]
  [key: string]: unknown
}

const isObj = (entry: unknown): entry is Obj =>
  typeof entry === 'object' && entry !== null

/** What a piece is worth in pixels before it is drawn: lines of text, a table, a picture. */
const SIZE = {
  line: 27,
  paragraph: 10,
  charsPerLine: 85,
  heading: 56,
  tableRow: 34,
  tableBase: 60,
  image: 380,
  creature: 340,
  other: 140,
}

function estimate(entry: unknown): number {
  if (typeof entry === 'string') {
    return Math.ceil(entry.length / SIZE.charsPerLine) * SIZE.line + SIZE.paragraph
  }
  if (typeof entry === 'number') return SIZE.line
  if (Array.isArray(entry)) return entry.reduce((sum: number, e) => sum + estimate(e), 0)
  if (!isObj(entry)) return 0
  switch (entry.type) {
    case 'image':
    case 'gallery':
      return SIZE.image
    case 'statblock':
      return entry.tag === 'creature' || entry.prop === 'monsterFluff'
        ? SIZE.creature
        : SIZE.other
    case 'table':
      return (
        SIZE.tableBase +
        (Array.isArray(entry.rows) ? entry.rows.length : 0) * SIZE.tableRow
      )
    default:
      return (
        (entry.name ? SIZE.heading : 0) +
        estimate(entry.entries) +
        estimate(entry.entry) +
        estimate(entry.items)
      )
  }
}

/** Whether a part is cut into a heading and the pieces under it. */
function cuts(entry: Entry, depth: number): entry is Obj {
  if (!isObj(entry) || (entry.type !== 'section' && entry.type !== 'entries'))
    return false
  if (!Array.isArray(entry.entries) || entry.style) return false
  // A part that runs in (its name set in its first paragraph) is one piece.
  const runsIn =
    entry.type === 'entries' && !!entry.name && depth >= appConfig.books.runInFromDepth
  return !runsIn
}

/** Call `fn` for every object in an entry, the entry itself first, in reading order. */
function visit(value: unknown, fn: (node: Obj) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) visit(item, fn)
  } else if (isObj(value)) {
    fn(value)
    for (const child of Object.values(value)) {
      if (typeof child === 'object' && child !== null) visit(child, fn)
    }
  }
}

/** The keys of the headings drawn by an entry and everything in it, in reading order. */
function keysIn(value: unknown, chapter: number, scan: Scan): string[] {
  const keys: string[] = []
  visit(value, (node) => {
    const anchor = scan.anchors.get(node)
    if (anchor) keys.push(headingKey(chapter, anchor))
  })
  return keys
}

/** The keys of the pictures in an entry, which a link to a map points at. */
function picturesIn(value: unknown, chapter: number): string[] {
  const keys: string[] = []
  visit(value, (node) => {
    if (node.type === 'image' && typeof node.id === 'string')
      keys.push(headingKey(chapter, `image-${node.id}`))
  })
  return keys
}

/** The pages marked by an entry and everything in it, in reading order. */
function pagesIn(value: unknown): number[] {
  const found: number[] = []
  visit(value, (node) => {
    if (typeof node.page === 'number') found.push(node.page)
  })
  return found
}

/** Cut the chapters of a book into pieces. */
export function buildFlow(sections: Entry[], scan: Scan): Flow {
  const units: Unit[] = []
  const byKey = new Map<string, number>()
  const starts: number[] = []
  const pages = new Map<number, number>()
  // The page in force: pages are marked where a part starts, and hold until the next mark.
  let page: number | undefined

  sections.forEach((section, chapter) => {
    starts.push(units.length)
    const first = scan.headings.find((h) => h.chapter === chapter)
    // The heading in force where the piece starts: the chapter's own, until another.
    let last = first ? headingKey(chapter, first.anchor) : ''

    const emit = (
      piece: Pick<Unit, 'title' | 'entries' | 'depth' | 'under'>,
      keys: string[],
    ) => {
      const index = units.length
      const places = [...keys, ...picturesIn(piece.entries, chapter)]
      for (const key of places) if (!byKey.has(key)) byKey.set(key, index)
      const own = isObj(piece.title) ? piece.title : piece.entries[0]
      const begins = startPageOf(own)
      const held = piece.title
        ? begins === undefined
          ? []
          : [begins]
        : pagesIn(piece.entries)
      units.push({
        chapter,
        ...piece,
        heading: last,
        keys,
        height: piece.title ? SIZE.heading : estimate(piece.entries),
        ...(begins !== undefined && begins !== page && { page: begins }),
        from: page,
      })
      for (const mark of held) if (!pages.has(mark)) pages.set(mark, index)
      page = held.at(-1) ?? page
      if (keys.length > 0) last = keys[keys.length - 1]
    }

    const part = (node: Obj, depth: number) => {
      const named = typeof node.name === 'string' && node.name !== ''
      if (named) {
        const anchor = scan.anchors.get(node)
        emit(
          { title: node, entries: [], depth },
          anchor ? [headingKey(chapter, anchor)] : [],
        )
      }
      const inner = named ? depth + 1 : depth
      let run: Entry[] = []
      let runStart = 0
      let height = 0
      const flush = () => {
        if (run.length === 0) return
        emit(
          {
            entries: run,
            depth: inner,
            under: runStart === 0 && named ? node.name : undefined,
          },
          keysIn(run, chapter, scan),
        )
        run = []
        height = 0
      }
      node.entries?.forEach((child, index) => {
        if (cuts(child, inner)) {
          flush()
          part(child, inner)
          return
        }
        // A part that starts a page starts a piece, so a page break is never mid-piece.
        if (startPageOf(child) !== undefined) flush()
        if (run.length === 0) runStart = index
        run.push(child)
        height += estimate(child)
        if (height >= appConfig.books.pieceHeight) flush()
      })
      flush()
    }

    if (cuts(section, 0)) part(section, 0)
    else emit({ entries: [section], depth: 0 }, keysIn(section, chapter, scan))
  })
  return { units, byKey, starts, pages, marked: [...pages.keys()].sort((a, b) => a - b) }
}

const flows = new WeakMap<Scan, Flow>()

/** The pieces of a book's text, cut once. */
export function flowOf(sections: Entry[], scan: Scan): Flow {
  let flow = flows.get(scan)
  if (!flow) {
    flow = buildFlow(sections, scan)
    flows.set(scan, flow)
  }
  return flow
}

/** What a piece of the text says, for finding words in it. Parts that are no text are left out. */
const NOT_TEXT = new Set([
  'type',
  'style',
  'href',
  'hrefThumbnail',
  'colStyles',
  'mapRegions',
  'grid',
  'id',
  'tag',
  'prop',
  'source',
  'className',
  'classSource',
  'shortName',
  'pantheon',
  'page',
  'data',
  'credit',
])

function collect(value: unknown, out: string[]): void {
  if (typeof value === 'string') out.push(stripTags(value))
  else if (Array.isArray(value)) for (const item of value) collect(item, out)
  else if (isObj(value)) {
    for (const [key, child] of Object.entries(value))
      if (!NOT_TEXT.has(key)) collect(child, out)
  }
}

const texts = new WeakMap<Unit, string>()

function textOf(unit: Unit): string {
  let text = texts.get(unit)
  if (text === undefined) {
    const parts: string[] = []
    collect(isObj(unit.title) ? unit.title.name : unit.entries, parts)
    text = parts.join(' ')
    texts.set(unit, text)
  }
  return text
}

/** How many words of `words` each piece marks, by piece; pieces with none are left out. */
export function matchesOf(flow: Flow, words: readonly string[]): Map<number, number> {
  const found = new Map<number, number>()
  if (words.length === 0) return found
  const pattern = wordPattern(words)
  flow.units.forEach((unit, index) => {
    const count = textOf(unit).match(pattern)?.length ?? 0
    if (count > 0) found.set(index, count)
  })
  return found
}
