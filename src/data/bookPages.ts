// Page numbers for a book's table of contents.
//
// `books.json` lists each book's chapters and headings but not the pages they
// open on. Those are read from the book's text file (`book/book-<source>.json`),
// which is fetched when the book's details are opened and is not kept in memory.
// A heading that only points at an entity (a class, a creature, a background, ...)
// has no page in the book text; its page comes from that entity's own record.

import { contentCache } from '../content/epoch'
import { fetchData, fetchDataUncached } from './dataClient'
import type { Book, BookContentEntry, BookHeader } from './types'

const norm = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '')

/** The fields read off a node of the book text. Nothing about it is assumed. */
interface TextNode {
  type?: unknown
  name?: unknown
  page?: unknown
  source?: unknown
  tag?: unknown
  prop?: unknown
  entries?: unknown
}

function isNode(value: unknown): value is TextNode {
  return typeof value === 'object' && value !== null
}

/**
 * Walk a book-text subtree, recording the first `page` seen for each `name`.
 * Section, entries, and inset nodes all carry name+page; leaf statblock refs do
 * not, and are skipped. First-occurrence-wins keeps a header scoped to its own
 * chapter when the same name recurs elsewhere in the book.
 */
export function collectPages(
  node: unknown,
  pages = new Map<string, number>(),
): Map<string, number> {
  if (Array.isArray(node)) {
    for (const child of node) collectPages(child, pages)
    return pages
  }
  if (!isNode(node)) return pages
  if (
    typeof node.name === 'string' &&
    typeof node.page === 'number' &&
    !pages.has(node.name)
  ) {
    pages.set(node.name, node.page)
  }
  if (Array.isArray(node.entries)) collectPages(node.entries, pages)
  return pages
}

/** What a reference stub in the book text points at. */
export interface EntityRef {
  /** The kind of entity (`creature`, `class`, `race`, ...), when the stub says. */
  kind: string | null
  /** The entity's source, or null when the stub leaves it to the containing book. */
  source: string | null
}

// A stub names its kind with `tag`, or, when it embeds the entity's description,
// with the name of the list that description is kept in (`monsterFluff`,
// `raceFluff`, ...) instead.
function kindOfProp(prop: string): string {
  const kind = prop.replace(/Fluff$/, '')
  return kind === 'monster' ? 'creature' : kind
}

/**
 * Walk a book-text subtree, recording each statblock *reference* stub by name.
 * Chapters whose sub-headings are classes, spells, or creatures list them as
 * `{ type: 'statblock', name, tag, source? }` with no inline page - the kind and
 * source let the page be looked up in that entity's own record. A stub may name
 * its own source (a creature reprinted from another book) or omit it, in which
 * case the entity belongs to the containing book. First-occurrence-wins keeps a
 * ref scoped to its own chapter.
 */
export function collectRefs(
  node: unknown,
  refs = new Map<string, EntityRef>(),
): Map<string, EntityRef> {
  if (Array.isArray(node)) {
    for (const child of node) collectRefs(child, refs)
    return refs
  }
  if (!isNode(node)) return refs
  if (
    node.type === 'statblock' &&
    typeof node.name === 'string' &&
    !refs.has(node.name)
  ) {
    const kind =
      typeof node.tag === 'string'
        ? node.tag
        : typeof node.prop === 'string'
          ? kindOfProp(node.prop)
          : null
    refs.set(node.name, {
      kind,
      source: typeof node.source === 'string' ? node.source : null,
    })
  }
  if (Array.isArray(node.entries)) collectRefs(node.entries, refs)
  return refs
}

/** The page of every entity read so far, by kind, source and name. */
export type PageIndex = Map<string, number>

const indexKey = (kind: string, source: string, name: string) =>
  `${kind}|${source}|${norm(name)}`

/**
 * Add the pages of entity records of one kind to an index. Every data file keeps
 * its entities as arrays of records carrying name+source+page. First occurrence
 * wins, so a primary entry is never shadowed by a later reprint.
 */
export function buildPageIndex(
  kind: string,
  records: unknown[],
  index: PageIndex = new Map(),
): PageIndex {
  for (const record of records) {
    if (
      isNode(record) &&
      typeof record.name === 'string' &&
      typeof record.source === 'string' &&
      typeof record.page === 'number'
    ) {
      const key = indexKey(kind, record.source, record.name)
      if (!index.has(key)) index.set(key, record.page)
    }
  }
  return index
}

/** Looks up the page of the entity a heading points at; undefined when unknown. */
export type PageResolver = (ref: EntityRef, name: string) => number | undefined

export function pageResolver(index: PageIndex): PageResolver {
  return (ref, name) =>
    ref.kind && ref.source ? index.get(indexKey(ref.kind, ref.source, name)) : undefined
}

// Find the book-text top-level section for a contents chapter. The book text
// prefixes chapters ("Chapter 1: Playing the Game") that the contents strips
// ("Playing the Game"), so an exact match, a "...: name" suffix, or a normalised
// suffix all count.
function matchSection(name: string, sections: unknown[]): TextNode | null {
  for (const section of sections) {
    if (!isNode(section) || typeof section.name !== 'string') continue
    const title = section.name
    if (
      title === name ||
      title.endsWith(`: ${name}`) ||
      norm(title).endsWith(norm(name))
    ) {
      return section
    }
  }
  return null
}

function byNormalisedName<V>(map: Map<string, V>): Map<string, V> {
  const normalised = new Map<string, V>()
  for (const [key, value] of map) {
    if (!normalised.has(norm(key))) normalised.set(norm(key), value)
  }
  return normalised
}

/**
 * A book's `contents` with the page numbers read from the sections of its text:
 * chapter entries gain `page`, and a header with a page becomes (or stays) an
 * object carrying it. Nothing is changed in place. Headers the text gives no
 * page for are asked of `resolve`, but only when they are reference stubs, so a
 * prose heading never picks up a same-named entity's page.
 */
export function annotateContents(
  contents: BookContentEntry[],
  sections: unknown[],
  resolve: PageResolver = () => undefined,
  bookSource?: string,
): BookContentEntry[] {
  return contents.map((chapter) => {
    const section = matchSection(chapter.name, sections)
    if (!section) return chapter
    const paged: BookContentEntry =
      typeof section.page === 'number' ? { ...chapter, page: section.page } : chapter
    if (!chapter.headers) return paged

    const pages = collectPages(section)
    const pagesByNorm = byNormalisedName(pages)
    const refs = collectRefs(section)
    const refsByNorm = byNormalisedName(refs)

    const headers = chapter.headers.map((header): BookHeader => {
      const text = typeof header === 'string' ? header : header.header
      let page = pages.get(text) ?? pagesByNorm.get(norm(text))
      if (page === undefined) {
        const ref = refs.get(text) ?? refsByNorm.get(norm(text))
        // A stub without its own source belongs to the containing book.
        if (ref)
          page = resolve({ ...ref, source: ref.source ?? bookSource ?? null }, text)
      }
      if (page === undefined) return header
      return typeof header === 'string' ? { header: text, page } : { ...header, page }
    })
    return { ...paged, headers }
  })
}

/**
 * The top-level sections of a book's text file, or null when the file is not a
 * book text. Both layouts the source has used are read: the sections directly
 * under `data`, and under `bookData[].data`.
 */
export function bookSections(file: unknown, source: string): unknown[] | null {
  if (!isNode(file)) return null
  const { data, bookData } = file as { data?: unknown; bookData?: unknown }
  if (Array.isArray(data)) return data
  if (!Array.isArray(bookData)) return null
  const books = bookData.filter(isNode) as { source?: unknown; data?: unknown }[]
  const book = books.find((entry) => entry.source === source) ?? books[0]
  return Array.isArray(book?.data) ? book.data : null
}

/** The data path of a book's text file. */
export function bookTextPath(source: string): string {
  return `book/book-${source.toLowerCase()}.json`
}

type FileFinder = (sources: string[]) => Promise<string[]>

const files =
  (...paths: string[]): FileFinder =>
  () =>
    Promise.resolve(paths)

/** A folder with one file per source, listed by its `index.json`. */
const filesBySource =
  (folder: string): FileFinder =>
  async (sources) => {
    const index = await fetchData<Record<string, string>>(`${folder}/index.json`)
    return sources.flatMap((source) =>
      index[source] ? [`${folder}/${index[source]}`] : [],
    )
  }

/** A folder whose files are not split by source: all of them are read. */
const allFilesOf =
  (folder: string): FileFinder =>
  async () => {
    const index = await fetchData<Record<string, string>>(`${folder}/index.json`)
    return Object.values(index).map((name) => `${folder}/${name}`)
  }

/** Where the records of each kind of entity are kept. */
const ENTITY_FILES: Record<string, FileFinder> = {
  action: files('actions.json'),
  background: files('backgrounds.json'),
  charoption: files('charcreationoptions.json'),
  class: allFilesOf('class'),
  condition: files('conditionsdiseases.json'),
  creature: filesBySource('bestiary'),
  crochet: files('homecrafts.json'),
  deck: files('decks.json'),
  deity: files('deities.json'),
  disease: files('conditionsdiseases.json'),
  facility: files('bastions.json'),
  feat: files('feats.json'),
  hazard: files('trapshazards.json'),
  item: files('items.json', 'items-base.json'),
  language: files('languages.json'),
  object: files('objects.json'),
  optfeature: files('optionalfeatures.json'),
  race: files('races.json'),
  recipe: files('recipes.json'),
  reward: files('rewards.json'),
  sense: files('senses.json'),
  spell: filesBySource('spells'),
  status: files('conditionsdiseases.json'),
  subclass: allFilesOf('class'),
  table: files('tables.json'),
  trap: files('trapshazards.json'),
  variantrule: files('variantrules.json'),
  vehicle: files('vehicles.json'),
}

/** Read the pages of the entities the given references point at. */
async function loadEntityPages(wanted: EntityRef[]): Promise<PageIndex> {
  const sourcesByKind = new Map<string, Set<string>>()
  for (const { kind, source } of wanted) {
    if (!kind || !source || !(kind in ENTITY_FILES)) continue
    const sources = sourcesByKind.get(kind) ?? new Set<string>()
    sources.add(source)
    sourcesByKind.set(kind, sources)
  }

  const index: PageIndex = new Map()
  await Promise.all(
    [...sourcesByKind].map(async ([kind, sources]) => {
      // A file that cannot be had leaves its headings without a page.
      const paths = await ENTITY_FILES[kind]([...sources]).catch(() => [])
      const loaded = await Promise.all(
        paths.map((path) => fetchData<Record<string, unknown>>(path).catch(() => null)),
      )
      // Added in the order the files are listed, so the same entity always wins.
      for (const file of loaded) {
        if (!isNode(file)) continue
        for (const value of Object.values(file)) {
          if (Array.isArray(value)) buildPageIndex(kind, value, index)
        }
      }
    }),
  )
  return index
}

const pagedContents = contentCache<BookContentEntry[]>()

/**
 * A book's table of contents with its page numbers. Resolves to the contents as
 * `books.json` gives them when the book has no text file, or it cannot be had.
 */
export function loadBookContents(book: Book): Promise<BookContentEntry[]> {
  const contents = book.contents ?? []
  if (contents.length === 0) return Promise.resolve(contents)
  return pagedContents.get(book.source, async () => {
    const text = await fetchDataUncached(bookTextPath(book.source)).catch(() => null)
    const sections = bookSections(text, book.source)
    if (!sections) return contents

    // A first pass finds which entities the headings point at; the second fills
    // in their pages once those entities' records are read.
    const wanted: EntityRef[] = []
    annotateContents(
      contents,
      sections,
      (ref) => {
        wanted.push(ref)
        return undefined
      },
      book.source,
    )
    const index = await loadEntityPages(wanted)
    return annotateContents(contents, sections, pageResolver(index), book.source)
  })
}

/** Test-only: forget the contents already paged. */
export function _clearBookContents(): void {
  pagedContents.clear()
}
