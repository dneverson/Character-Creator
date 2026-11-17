// What a book's text is made of, read in one pass: its headings (the outline the reader
// draws beside the text, and the places a link or a search result can point at) and its
// blocks of text (what the search reads). The two come from one walk so that a heading's
// address is the same everywhere.

import type { Entry } from '../text/Entries'
import { stripTags } from '../text/tags'

/** A named part of the text: a chapter, a heading, a sidebar. */
export interface Heading {
  chapter: number
  /** Unique within its chapter; see `slugOf`. */
  anchor: string
  name: string
  /** 0 for a chapter, 1 for a heading in it, and so on. A sidebar is one below the headings beside it. */
  depth: number
  /** Whether it is a sidebar or similar box rather than a heading of the text. */
  box: boolean
  /** The page it starts on, when the text says. */
  page?: number
}

/** A piece of running text, with the heading it sits under. */
export interface Block {
  text: string
  /** The index in `headings` of the nearest heading above it. */
  heading: number
}

export interface Scan {
  headings: Heading[]
  blocks: Block[]
  /** The anchor of each named node of the text, for the renderer. */
  anchors: Map<object, string>
}

interface Node {
  type?: unknown
  name?: unknown
  page?: unknown
  entry?: unknown
  entries?: unknown
  rows?: unknown
  row?: unknown
  caption?: unknown
  colLabels?: unknown
  by?: unknown
}

const BOXES = new Set(['inset', 'insetReadaloud', 'variantInner', 'flowBlock'])
const HEADINGS = new Set(['section', 'entries', ...BOXES])
/** Parts that hold more text, in the order the text reads. */
const CHILDREN = [
  'headerEntries',
  'entry',
  'entries',
  'items',
  'footnotes',
  'footerEntries',
  'wrappeds',
  'blocks',
  'tables',
] as const
/** Parts that are not text of the book: a picture, a reference to an entry. */
const NOT_TEXT = new Set(['image', 'statblock', 'gallery'])

/** A heading's name as an address: lower case, words joined by hyphens. */
export function slugOf(name: string): string {
  return stripTags(name)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

const isObject = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null

/** The text a table cell shows when it is plain: a string, a number or a roll. */
export function cellTextOf(cell: unknown): string {
  if (typeof cell === 'string' || typeof cell === 'number') return stripTags(String(cell))
  if (!isObject(cell)) return ''
  const roll = (cell as { roll?: { exact?: number; min?: number; max?: number } }).roll
  if (roll?.exact !== undefined) return String(roll.exact)
  if (roll?.min !== undefined && roll.max !== undefined) return `${roll.min}-${roll.max}`
  return typeof cell.entry === 'string' ? stripTags(cell.entry) : ''
}

/** Read the sections of a book's text, each section being one chapter. */
export function scan(sections: Entry[]): Scan {
  const headings: Heading[] = []
  const blocks: Block[] = []
  const anchors = new Map<object, string>()
  const seen = new Map<number, Map<string, number>>()

  const anchorFor = (chapter: number, name: string): string => {
    const counts = seen.get(chapter) ?? new Map<string, number>()
    seen.set(chapter, counts)
    const base = slugOf(name) || 'part'
    const count = (counts.get(base) ?? 0) + 1
    counts.set(base, count)
    return count === 1 ? base : `${base}-${count}`
  }

  const text = (value: string, heading: number) => {
    const plain = stripTags(value).trim()
    if (plain) blocks.push({ text: plain, heading })
  }

  const walk = (node: unknown, chapter: number, depth: number, heading: number) => {
    if (typeof node === 'string') return text(node, heading)
    if (typeof node === 'number') return text(String(node), heading)
    if (Array.isArray(node)) {
      for (const child of node) walk(child, chapter, depth, heading)
      return
    }
    if (!isObject(node)) return
    const type = typeof node.type === 'string' ? node.type : ''
    if (NOT_TEXT.has(type)) return

    let here = heading
    let below = depth
    if (HEADINGS.has(type) && typeof node.name === 'string') {
      const box = BOXES.has(type)
      const entry: Heading = {
        chapter,
        anchor: anchorFor(chapter, node.name),
        name: stripTags(node.name),
        depth: box ? depth + 1 : depth,
        box,
        ...(typeof node.page === 'number' && { page: node.page }),
      }
      headings.push(entry)
      here = headings.length - 1
      anchors.set(node, entry.anchor)
      text(node.name, here)
      below = depth + 1
    }

    if (type === 'table') {
      if (typeof node.caption === 'string') text(node.caption, here)
      const labels = Array.isArray(node.colLabels) ? node.colLabels.map(cellTextOf) : []
      if (labels.length > 0) text(labels.join(' | '), here)
      for (const row of Array.isArray(node.rows) ? node.rows : []) {
        const cells: unknown = isObject(row) && Array.isArray(row.row) ? row.row : row
        if (Array.isArray(cells)) text(cells.map(cellTextOf).join(' | '), here)
      }
      walk((node as { footnotes?: unknown }).footnotes, chapter, below, here)
      return
    }
    if (type === 'quote') {
      walk(node.entries, chapter, below, here)
      if (typeof node.by === 'string') text(node.by, here)
      return
    }
    // A list item reads as its name and its text together.
    if (
      type === 'item' &&
      typeof node.name === 'string' &&
      typeof node.entry === 'string'
    ) {
      text(`${node.name} ${node.entry}`, here)
      walk(node.entries, chapter, below, here)
      return
    }
    if (type === 'item' && typeof node.name === 'string') text(node.name, here)
    for (const key of CHILDREN) {
      walk((node as Record<string, unknown>)[key], chapter, below, here)
    }
  }

  sections.forEach((section, chapter) => {
    const named =
      isObject(section) &&
      HEADINGS.has(String(section.type)) &&
      typeof section.name === 'string'
    if (named) return walk(section, chapter, 0, -1)
    // A chapter the text leaves unnamed still has a place in the outline.
    headings.push({
      chapter,
      anchor: anchorFor(chapter, 'part'),
      name: `Part ${chapter + 1}`,
      depth: 0,
      box: false,
    })
    walk(section, chapter, 1, headings.length - 1)
  })
  return { headings, blocks, anchors }
}
