// What a book's text is made of, read in one pass: its headings (the outline the reader
// draws beside the text, and the places a link or a search result can point at) and its
// blocks of text (what the search reads). The two come from one walk so that a heading's
// address is the same everywhere.

import type { Entry } from '../text/Entries'
import { stripTags } from '../text/tags'
import type { Listed } from './listed'

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
  /** A place a link can go to that the contents do not list (see `contentsOf`). */
  anchorOnly?: true
}

/** A piece of running text, with the heading it sits under. */
export interface Block {
  text: string
  /** The index in `headings` of the nearest heading above it. */
  heading: number
}

/** A place in the text that an id of the data names: a chapter, a heading or a map. */
export interface Target {
  chapter: number
  /** A heading's anchor or a map's ("image-032"); null is the top of the chapter. */
  anchor: string | null
  name: string
}

export interface Scan {
  headings: Heading[]
  blocks: Block[]
  /** The anchor of each named node of the text, for the renderer. */
  anchors: Map<object, string>
  /** Where each id of the data is: what an area key ({@area name|id}) points at. */
  ids: Map<string, Target>
  /** The maps each area (by its id) is drawn on, for the way from a heading to its map. */
  maps: Map<string, Target[]>
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
  id?: unknown
  title?: unknown
  mapRegions?: unknown
  images?: unknown
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
/** The stat blocks whose name is a heading of the book: the entries a chapter is made of. */
const NAMED_STATBLOCKS = new Set(['class', 'subclass', 'race', 'spell'])

/**
 * The stat blocks that are places of the book without being entries of its contents: the
 * conditions, which the printed book sets as blocks with no heading. They get an anchor, so
 * a link finds them by name, but the contents list them only when the book's own contents do.
 */
const ANCHORED_STATBLOCKS = new Set(['condition'])

/** Parts that are not text of the book: a picture, a reference to an entry. */
const NOT_TEXT = new Set(['image', 'statblock', 'gallery'])

/** The key of a heading, unique in a book: its chapter and its anchor. */
export const headingKey = (chapter: number, anchor: string): string =>
  `${chapter}:${anchor}`

/** The id of a heading's element in the page; a heading's anchor is unique only in its chapter. */
export const headingDomId = (chapter: number, anchor: string): string =>
  `book-${chapter}-${anchor}`

/**
 * The id of the element a place's anchor names: a heading's (see `headingDomId`), or a
 * picture's ("image-032"), which is unique in the whole book.
 */
export const anchorDomId = (chapter: number, anchor: string): string =>
  anchor.startsWith('image-') ? `book-${anchor}` : headingDomId(chapter, anchor)

/** A heading's name as an address: lower case, words joined by hyphens. */
export function slugOf(name: string): string {
  return stripTags(name)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

/** The headings the contents list: every place of the text but those that are only anchors. */
export const contentsOf = (headings: readonly Heading[]): Heading[] =>
  headings.filter((heading) => !heading.anchorOnly)

/**
 * The anchor the contents show for the place the reader is at: the place's own, or when it
 * is not in the contents the heading they list just above it (null: the chapter's top).
 */
export function contentsAnchor(
  headings: readonly Heading[],
  chapter: number,
  anchor: string | null,
): string | null {
  const at = headings.findIndex((h) => h.chapter === chapter && h.anchor === anchor)
  if (anchor === null || at < 0) return anchor
  for (let i = at; i >= 0 && headings[i].chapter === chapter; i--) {
    if (!headings[i].anchorOnly)
      return headings[i].depth === 0 ? null : headings[i].anchor
  }
  return null
}

const isObject = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null

/**
 * The page a part starts on: its own, or the one its first entry starts on, when that
 * entry is a part that says (a heading followed at once by a stat block printed on page 13
 * starts on page 13). A part whose first entry is plain text says nothing.
 */
export function startPageOf(node: unknown): number | undefined {
  let at: unknown = node
  while (isObject(at)) {
    if (typeof at.page === 'number') return at.page
    at = Array.isArray(at.entries) ? at.entries[0] : undefined
  }
  return undefined
}

/** The text a table cell shows when it is plain: a string, a number or a roll. */
export function cellTextOf(cell: unknown): string {
  if (typeof cell === 'string' || typeof cell === 'number') return stripTags(String(cell))
  if (!isObject(cell)) return ''
  const roll = (cell as { roll?: { exact?: number; min?: number; max?: number } }).roll
  if (roll?.exact !== undefined) return String(roll.exact)
  if (roll?.min !== undefined && roll.max !== undefined) return `${roll.min}-${roll.max}`
  return typeof cell.entry === 'string' ? stripTags(cell.entry) : ''
}

/**
 * Read the sections of a book's text, each section being one chapter. `listed` is what the
 * book's contents list by chapter: a stat block they name is a heading too (the creatures
 * of an appendix, the backgrounds of a chapter), the first one of each name.
 */
export function scan(sections: Entry[], listed: Listed = new Map()): Scan {
  const headings: Heading[] = []
  const blocks: Block[] = []
  const anchors = new Map<object, string>()
  const ids = new Map<string, Target>()
  const maps = new Map<string, Target[]>()
  const seen = new Map<number, Set<string>>()
  // The listed names no heading of the chapter has yet.
  const wanted = new Map<number, Set<string>>()
  const wantedIn = (chapter: number): Set<string> => {
    const names = wanted.get(chapter) ?? new Set(listed.get(chapter))
    wanted.set(chapter, names)
    return names
  }

  /** A name's slug, with a number after it when the chapter has the slug already. */
  const anchorFor = (chapter: number, name: string): string => {
    const used = seen.get(chapter) ?? new Set<string>()
    seen.set(chapter, used)
    const base = slugOf(name) || 'part'
    let anchor = base
    // "Extra Attack 2" is a slug of its own, so a second "Extra Attack" skips it.
    for (let count = 2; used.has(anchor); count++) anchor = `${base}-${count}`
    used.add(anchor)
    return anchor
  }

  const text = (value: string, heading: number) => {
    const plain = stripTags(value).trim()
    if (plain) blocks.push({ text: plain, heading })
  }

  /** The maps and pictures of the text are places too: a map has the areas drawn on it. */
  const pictures = (node: Node, chapter: number) => {
    if (node.type === 'gallery') {
      for (const image of Array.isArray(node.images) ? node.images : []) {
        if (isObject(image)) pictures(image, chapter)
      }
      return
    }
    if (typeof node.id !== 'string') return
    const target: Target = {
      chapter,
      anchor: `image-${node.id}`,
      name: typeof node.title === 'string' ? stripTags(node.title) : 'Map',
    }
    if (!ids.has(node.id)) ids.set(node.id, target)
    for (const region of Array.isArray(node.mapRegions) ? node.mapRegions : []) {
      const area = isObject(region) ? (region as { area?: unknown }).area : undefined
      if (typeof area !== 'string') continue
      const on = maps.get(area)
      if (on) on.push(target)
      else maps.set(area, [target])
    }
  }

  /**
   * A stat block that stands for a class, a race or a spell is a heading of the chapter,
   * unless the heading right above has its name (the text prints the name once).
   */
  const statblockHeading = (
    node: Node,
    chapter: number,
    depth: number,
    heading: number,
  ) => {
    const tag = (node as { tag?: unknown }).tag
    const prop = (node as { prop?: unknown }).prop
    const label = String(
      (node as { displayName?: unknown }).displayName ?? node.name ?? '',
    )
    if (!label) return
    const slug = slugOf(label)
    const isListed = wantedIn(chapter).delete(slug)
    const isNamed = NAMED_STATBLOCKS.has(String(tag)) || prop === 'subclass'
    const anchorOnly = !isListed && !isNamed
    if (anchorOnly && !ANCHORED_STATBLOCKS.has(String(tag))) return
    const above = headings[heading]
    if (above && slugOf(above.name) === slug) return
    const page = startPageOf(node)
    const entry: Heading = {
      chapter,
      anchor: anchorFor(chapter, label),
      name: stripTags(label),
      depth,
      box: false,
      ...(page !== undefined && { page }),
      ...(anchorOnly && { anchorOnly: true as const }),
    }
    headings.push(entry)
    anchors.set(node, entry.anchor)
    text(label, headings.length - 1)
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
    if (type === 'image' || type === 'gallery') return pictures(node, chapter)
    if (type === 'statblock') return statblockHeading(node, chapter, depth, heading)
    if (NOT_TEXT.has(type)) return

    let here = heading
    let below = depth
    if (HEADINGS.has(type) && typeof node.name === 'string') {
      const box = BOXES.has(type)
      const page = startPageOf(node)
      const entry: Heading = {
        chapter,
        anchor: anchorFor(chapter, node.name),
        name: stripTags(node.name),
        depth: box ? depth + 1 : depth,
        box,
        ...(page !== undefined && { page }),
      }
      wantedIn(chapter).delete(slugOf(node.name))
      headings.push(entry)
      here = headings.length - 1
      anchors.set(node, entry.anchor)
      if (typeof node.id === 'string' && !ids.has(node.id))
        ids.set(node.id, {
          chapter,
          anchor: entry.depth > 0 ? entry.anchor : null,
          name: entry.name,
        })
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
  return { headings, blocks, anchors, ids, maps }
}
