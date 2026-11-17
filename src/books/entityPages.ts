// The pages of what a book's text only names. A stat block that stands for a creature, a
// spell, a race... carries no page in the book's text, but the entry it names has its own
// (`source` and `page` in the data files). When the entry is of the book's own source, that
// is the page the book prints it on, so the block is given it: the reader marks the page,
// the contents show it and the page box can go to it. An entry of another book (a creature
// an adventure takes from the Monster Manual) says nothing about this book's pages.

import {
  indexKey,
  kindOfProp,
  loadEntityPages,
  type EntityRef,
  type PageIndex,
} from '../data/bookPages'
import { REFERENCE_TAGS } from '../lookup/references'
import type { Entry } from '../text/Entries'
import { replace } from './expand'

type Json = Record<string, unknown>

const isJson = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const text = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

/** The entry a stat block names: its kind (the data file's), source and name. */
interface Named {
  node: Json
  kind: string
  source: string
  name: string
}

/** The stat blocks of a text that name an entry of `book`'s own source and have no page. */
function namedIn(node: unknown, book: string, found: Named[] = []): Named[] {
  if (Array.isArray(node)) node.forEach((child) => namedIn(child, book, found))
  else if (isJson(node)) {
    const tag = text(node.tag)
    const prop = text(node.prop)
    const name = text(node.name) ?? text(node.shortName)
    const kind = tag ?? (prop ? kindOfProp(prop) : undefined)
    if (node.type === 'statblock' && kind && name && typeof node.page !== 'number') {
      // A block without a source means the tag's default one, as the reader reads it.
      const source = text(node.source) ?? REFERENCE_TAGS[kind]?.defaultSource
      if (source?.toLowerCase() === book.toLowerCase())
        found.push({ node, kind, source, name })
    } else Object.values(node).forEach((child) => namedIn(child, book, found))
  }
  return found
}

/**
 * The sections with each stat block that names an entry of the book's own source given
 * the entry's page. A name the data has no page for is left as it is.
 */
export async function withEntityPages(sections: Entry[], book: string): Promise<Entry[]> {
  const named = namedIn(sections, book)
  if (named.length === 0) return sections
  try {
    const wanted: EntityRef[] = named.map(({ kind, source }) => ({ kind, source }))
    const index: PageIndex = await loadEntityPages(wanted)
    const paged = new Map<object, Entry>()
    for (const { node, kind, source, name } of named) {
      const page = index.get(indexKey(kind, source, name))
      if (page !== undefined) paged.set(node, { ...node, page })
    }
    return paged.size > 0 ? (replace(sections, paged) as Entry[]) : sections
  } catch {
    return sections
  }
}
