#!/usr/bin/env node
// Derive page numbers for the book tables of contents and annotate books.json
// in place. Imported by pull-data.mjs (so CI produces pages alongside the JSON)
// and usable standalone against an existing books.json.
//
// The full book-text files (data/book/book-<source>.json, hundreds of KB of prose
// each) are NOT shipped - they are fetched only to read the `page` field off each
// chapter/section and fold those numbers into the slim contents the app already
// carries. A header that has no inline page in the book text (e.g. a linked class
// or creature stat block) is simply left without a page.

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

// Walk a book-text subtree, recording the first `page` seen for each `name`.
// Section, entries, and inset nodes all carry name+page; leaf statblock refs do
// not, and are skipped. First-occurrence-wins keeps a header scoped to its own
// chapter when the same name recurs elsewhere in the book.
export function collectPages(node, map = {}) {
  if (Array.isArray(node)) {
    for (const child of node) collectPages(child, map)
    return map
  }
  if (!node || typeof node !== 'object') return map
  if (
    typeof node.name === 'string' &&
    typeof node.page === 'number' &&
    !(node.name in map)
  ) {
    map[node.name] = node.page
  }
  if (Array.isArray(node.entries)) collectPages(node.entries, map)
  return map
}

// Walk a book-text subtree, recording each statblock *reference* stub keyed by
// name. Chapters whose sub-headings are classes, spells, or creatures list them
// as `{ type: 'statblock', name, source? }` with no inline page - the name→source
// pair lets us look the page up in the entity index (buildPageIndex). A stub may
// name its own source (a creature reprinted from another book, e.g. XMM) or omit
// it, in which case the page lives in the containing book's own entity file; the
// omission is recorded as `null` so the caller can fall back to the book's source.
// First-occurrence-wins keeps a ref scoped to its own chapter.
export function collectRefs(node, map = {}) {
  if (Array.isArray(node)) {
    for (const child of node) collectRefs(child, map)
    return map
  }
  if (!node || typeof node !== 'object') return map
  if (node.type === 'statblock' && typeof node.name === 'string' && !(node.name in map)) {
    map[node.name] = typeof node.source === 'string' ? node.source : null
  }
  if (Array.isArray(node.entries)) collectRefs(node.entries, map)
  return map
}

// Build a `${source}|${normName}` → page lookup from entity records. Every pulled
// data file exposes its entities (classes, spells, monsters, backgrounds, …) as
// top-level arrays whose items carry name+source+page; feeding those arrays here
// yields the pages for the reference-only sub-headings the book text omits.
// First occurrence wins, so a primary entry is never shadowed by a later reprint.
export function buildPageIndex(records, index = new Map()) {
  for (const rec of records) {
    if (
      rec &&
      typeof rec === 'object' &&
      typeof rec.name === 'string' &&
      typeof rec.source === 'string' &&
      typeof rec.page === 'number'
    ) {
      const key = `${rec.source}|${norm(rec.name)}`
      if (!index.has(key)) index.set(key, rec.page)
    }
  }
  return index
}

// A `(source, name) → page | undefined` lookup over a buildPageIndex map.
export function pageResolver(index) {
  return (source, name) => (source ? index.get(`${source}|${norm(name)}`) : undefined)
}

// Find the book-text top-level section for a contents chapter. The book text
// prefixes chapters ("Chapter 1: Playing the Game") that the contents strips
// ("Playing the Game"), so an exact match, a "…: name" suffix, or a normalised
// suffix all count.
function matchSection(name, sections) {
  for (const sec of sections) {
    const n = sec?.name
    if (typeof n !== 'string') continue
    if (n === name || n.endsWith(`: ${name}`) || norm(n).endsWith(norm(name))) return sec
  }
  return null
}

/**
 * Annotate one book's `contents` with page numbers read from its book-text `data`
 * array. Mutates `contents` (chapter entries gain `page`; string headers with a
 * page become `{ header, page }` objects). Returns how many pages were applied.
 */
export function annotateContents(
  contents,
  bookData,
  resolve = () => undefined,
  bookSource,
) {
  if (!Array.isArray(contents) || !Array.isArray(bookData)) return 0
  let applied = 0
  for (const chapter of contents) {
    const section = matchSection(chapter.name, bookData)
    if (!section) continue
    if (typeof section.page === 'number') {
      chapter.page = section.page
      applied++
    }
    const byName = collectPages(section)
    const byNorm = {}
    for (const key of Object.keys(byName)) {
      const nk = norm(key)
      if (!(nk in byNorm)) byNorm[nk] = byName[key]
    }
    // Reference-only sub-headings (classes, spells, creatures, …) carry no inline
    // page in the book text; map their names to the source of their statblock stub
    // so the entity index can supply the page.
    const refs = collectRefs(section)
    const refsByNorm = {}
    for (const key of Object.keys(refs)) {
      const nk = norm(key)
      if (!(nk in refsByNorm)) refsByNorm[nk] = refs[key]
    }
    if (!Array.isArray(chapter.headers)) continue
    chapter.headers = chapter.headers.map((header) => {
      const text = typeof header === 'string' ? header : header.header
      let page = byName[text] ?? byNorm[norm(text)]
      if (page === undefined) {
        // Only fall back to the entity index for headers that are actual reference
        // stubs (so prose headings never pick up a same-named entity's page). A
        // stub without its own source defaults to the containing book's source.
        const nt = norm(text)
        if (text in refs || nt in refsByNorm) {
          const src = refs[text] ?? refsByNorm[nt] ?? bookSource
          page = resolve(src, text)
        }
      }
      if (page === undefined) return header
      applied++
      return typeof header === 'string' ? { header: text, page } : { ...header, page }
    })
  }
  return applied
}

/**
 * Fetch each book's text file, derive pages, and annotate `books` in place.
 * `fetchFile(path)` resolves to a Response (the same CDN-with-fallback fetch the
 * data pull uses). Books without a text file (404) are skipped, never fatal.
 */
export async function annotateBookPages({
  books,
  fetchFile,
  concurrency = 6,
  log = () => {},
  resolve = () => undefined,
}) {
  const targets = books.filter(
    (b) => b?.source && Array.isArray(b.contents) && b.contents.length,
  )
  log(`  ${targets.length} books with contents to page-annotate`)
  let next = 0
  async function pump() {
    let annotated = 0
    let pages = 0
    let missing = 0
    while (next < targets.length) {
      const book = targets[next++]
      const path = `data/book/book-${book.source.toLowerCase()}.json`
      try {
        const res = await fetchFile(path)
        const json = JSON.parse(await res.text())
        const applied = annotateContents(book.contents, json.data, resolve, book.source)
        if (applied > 0) {
          annotated++
          pages += applied
        }
      } catch {
        missing++
      }
    }
    return { annotated, pages, missing }
  }
  const results = await Promise.all(Array.from({ length: concurrency }, pump))
  const fold = (k) => results.reduce((sum, r) => sum + r[k], 0)
  log(
    `  pages: ${fold('annotated')}/${targets.length} books annotated, ` +
      `${fold('pages')} page numbers, ${fold('missing')} without text`,
  )
  return { books: targets.length, annotated: fold('annotated'), pages: fold('pages') }
}
