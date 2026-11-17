// What the reader asks of the entries renderer beyond the plain drawing: the book look
// (headings, sidebars, page marks), the words to mark, the anchors headings carry, and how
// a picture is drawn. Without a provider every entry is drawn exactly as before, so the
// detail panes of the tables are unchanged.

import { createContext, type ReactNode } from 'react'
import type { Scan } from '../books/outline'
import type { BookDoc } from '../books/types'

/** A picture of a book's text, as the data has it. */
export interface ImageEntry {
  type: 'image'
  href?: { type?: string; path?: string; url?: string }
  title?: string
  credit?: string
  width?: number
  height?: number
  altText?: string
  maxWidth?: number
  maxHeight?: number
  imageType?: string
  /** The id other parts of the text name the picture by (a map's player version, an area key). */
  id?: string
  /** A smaller copy of the picture for lists, which the reader does not need. */
  hrefThumbnail?: { type?: string; path?: string }
  /** The overlay a battle map is meant to carry: a square or a hex grid, or none. */
  grid?: ImageGrid
  /** The areas drawn on a map: the id of the heading of each, and its outline. */
  mapRegions?: { area: string; points?: number[][] }[]
  /** The map this is the player version of. */
  mapParent?: { id: string }
  mapName?: string
  /** A picture drawn for a light page (a handout), whatever the theme. */
  expectsLightBackground?: boolean
  /** How the printed page sets it ("comic-speaker-left"). */
  style?: string
}

/** The grid of a battle map: where it starts, how big a cell is, and what it stands for. */
export interface ImageGrid {
  type?: string
  /** A cell's size in pixels of the picture. */
  size?: number
  offsetX?: number
  offsetY?: number
  /** How far a cell stands for, and in what ("5" and "ft" when the data says nothing). */
  distance?: number
  units?: string
  scale?: number
}

/** A `statblock` entry of a book's text, as the data has it. */
export interface StatblockEntry {
  type: 'statblock'
  name?: string
  displayName?: string
  tag?: string
  prop?: string
  source?: string
  /** "narrow" is the printed one-column block, "inset" one set into the text. */
  style?: string
  /** Shut until the reader opens it. */
  collapsed?: boolean
  className?: string
  classSource?: string
  shortName?: string
  pantheon?: string
  /** The page the book prints it on, when that is not where the text has it. */
  printedOn?: number
  /** How the printed page sets it; `isSkipRootName`: the page prints no name above it. */
  data?: { renderCompact?: { isSkipRootName?: boolean } }
}

export interface EntryContextValue {
  /** Draw as the printed book does: headings by depth, sidebars, page marks. */
  book: boolean
  /** The anchor of each named node of the text (see src/books/outline.ts). */
  anchors?: Map<object, string>
  /** The chapter drawn, which makes an anchor unique in the whole book. */
  chapter?: number
  /** The book or adventure drawn, for the links between its places. */
  doc?: Pick<BookDoc, 'kind' | 'id'>
  /** Where each id of the data is, and the maps each area is on (see src/books/outline.ts). */
  ids?: Scan['ids']
  maps?: Scan['maps']
  /** Lower-case words to mark wherever they start a word of the text. */
  words: readonly string[]
  /**
   * From which depth a named `entries` part runs in (its name in bold italic at the start
   * of its text) rather than heading its own block. Left out, none does.
   */
  runInFrom?: number
  /** How a picture is drawn. */
  renderImage?: (image: ImageEntry, group?: ImageEntry[]) => ReactNode
  /**
   * How a stat block is drawn: the entry the text names, read when it is near. `headed`:
   * the heading right above carries the same name, so the block does not repeat it.
   * `anchor`: the id and key to carry when the block is itself a heading of the book.
   */
  renderStatblock?: (
    entry: StatblockEntry,
    headed: boolean,
    anchor: AnchorProps,
  ) => ReactNode
}

/**
 * What a heading (or a stat block that is one) carries in the page: its id and key, and the
 * page the text marks it on, so the reader can tell the page of what is at its reading line.
 */
export interface AnchorProps {
  id?: string
  'data-anchor'?: string
  'data-page'?: number
}

export const EntryContext = createContext<EntryContextValue | null>(null)
