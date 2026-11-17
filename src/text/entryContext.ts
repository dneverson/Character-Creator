// What the reader asks of the entries renderer beyond the plain drawing: the book look
// (headings, sidebars, page marks), the words to mark, the anchors headings carry, and how
// a picture is drawn. Without a provider every entry is drawn exactly as before, so the
// detail panes of the tables are unchanged.

import { createContext, type ReactNode } from 'react'

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
}

export interface EntryContextValue {
  /** Draw as the printed book does: headings by depth, sidebars, page marks. */
  book: boolean
  /** The anchor of each named node of the text (see src/books/outline.ts). */
  anchors?: Map<object, string>
  /** Lower-case words to mark wherever they start a word of the text. */
  words: readonly string[]
  /** How a picture is drawn. */
  renderImage?: (image: ImageEntry) => ReactNode
}

export const EntryContext = createContext<EntryContextValue | null>(null)
