// The address bar as part of the app's state: which view is open, which character and, on
// the sheet, which tab. It is kept in the URL hash, never the path, because the site is
// served from a sub-path of GitHub Pages. The hash holds only ids and view and tab names,
// never character data.
//
//   #/                      the Characters list
//   #/c/<id>/edit           a character in the editor
//   #/c/<id>/sheet          a character's sheet
//   #/c/<id>/sheet/<tab>    the sheet, on one tab
//   #/c/<id>/levelup        a character gaining a level
//   #/lookup                Quick lookup, open over whatever view was open
//   #/lookup/<entry id>     Quick lookup, opened on one entry
//   #/books                 the book reader, on its shelf of books, open over the view
//   #/book/<id>/...         the book reader, at a place in a book (src/books/address.ts)
//
// The store is the source of truth. A change of view, character or tab writes the hash
// (a new history entry when the view or character changed, so Back and Forward work; the
// same entry when only the tab did). A change of the hash (reload, Back, Forward, a typed
// address) is applied to the store. An address that names no stored character, or that is
// not understood, leads to the list.

import { selectSheetTab, useCharacterStore, type View } from '../character/store'
import { formatBookHash, parseBookHash } from '../books/address'
import { useBookStore } from '../books/state'
import type { BookPlace } from '../books/types'
import { useLookupStore } from '../lookup/state'

export interface Place {
  view: View
  id?: string
  tab?: string | null
  /** Quick lookup is open (over the view), on this entry when one is named. */
  lookup?: { entryId: string | null }
  /** The book reader is open (over the view), at this place; null is its shelf. */
  books?: { place: BookPlace | null }
}

const VIEW_SEGMENT = { editor: 'edit', sheet: 'sheet', levelUp: 'levelup' } as const
const SEGMENT_VIEW: Record<string, Exclude<View, 'list'>> = {
  edit: 'editor',
  sheet: 'sheet',
  levelup: 'levelUp',
}

/** The hash for a place. */
export function formatHash({ view, id, tab, lookup, books }: Place): string {
  if (lookup) {
    return lookup.entryId ? `#/lookup/${encodeURIComponent(lookup.entryId)}` : '#/lookup'
  }
  if (books) return formatBookHash(books.place)
  if (view === 'list' || !id) return '#/'
  const base = `#/c/${encodeURIComponent(id)}/${VIEW_SEGMENT[view]}`
  return view === 'sheet' && tab ? `${base}/${encodeURIComponent(tab)}` : base
}

/** The place a hash names; anything that is not understood is the list. */
export function parseHash(hash: string): Place {
  const books = parseBookHash(hash)
  if (books !== undefined) return { view: 'list', books: { place: books } }
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const [head, id, segment, tab] = parts
  if (head === 'lookup') {
    if (parts.length > 2) return { view: 'list' }
    try {
      return { view: 'list', lookup: { entryId: id ? decodeURIComponent(id) : null } }
    } catch {
      return { view: 'list' }
    }
  }
  const view = segment ? SEGMENT_VIEW[segment] : undefined
  if (head !== 'c' || !id || !view || parts.length > (view === 'sheet' ? 4 : 3)) {
    return { view: 'list' }
  }
  try {
    return { view, id: decodeURIComponent(id), tab: tab ? decodeURIComponent(tab) : null }
  } catch {
    return { view: 'list' }
  }
}

/** Where the store says the app is. */
function placeOf(): Place {
  const state = useCharacterStore.getState()
  const { view, activeId } = state
  const place: Place =
    view === 'list' || !activeId
      ? { view: 'list' }
      : { view, id: activeId, tab: selectSheetTab(state) }
  const reader = useBookStore.getState()
  const withBooks: Place = reader.open
    ? { ...place, books: { place: reader.place } }
    : place
  const { open, entryId } = useLookupStore.getState()
  return open ? { ...withBooks, lookup: { entryId } } : withBooks
}

/**
 * Keep the hash and the store in step, both ways, starting with the hash as it is now.
 * Given the loading of the stored characters, it starts once they are in the store, so
 * an address that names a character is not taken for one that names none while they
 * load. Returns the function that stops it.
 */
export function connectLocation(loaded?: Promise<unknown>): () => void {
  let stop: (() => void) | undefined
  let stopped = false
  const start = () => {
    if (!stopped) stop = follow()
  }
  if (loaded) loaded.then(start, start)
  else start()
  return () => {
    stopped = true
    stop?.()
  }
}

/** Follow the hash and the store from now on; returns the function that stops it. */
function follow(): () => void {
  let applying = false

  const apply = () => {
    const place = parseHash(window.location.hash)
    applying = true
    try {
      // The lookup opens over the view that is open; any other address closes it.
      if (place.lookup) useLookupStore.getState().openLookup(place.lookup.entryId)
      else {
        useLookupStore.getState().closeLookup()
        const reader = useBookStore.getState()
        if (place.books) {
          // The reader opens over the view that is open; one already there stays as is.
          const same =
            reader.open &&
            formatBookHash(reader.place) === formatBookHash(place.books.place)
          if (!same) reader.openBook(place.books.place)
        } else {
          reader.closeBooks()
          useCharacterStore.getState().restoreLocation(place)
        }
      }
    } finally {
      applying = false
    }
    // An address that led nowhere is replaced by the one it led to.
    const shown = formatHash(placeOf())
    if (shown !== formatHash(place)) window.history.replaceState(null, '', shown)
  }

  let last = placeOf()
  const write = () => {
    const place = placeOf()
    const hash = formatHash(place)
    const before = last
    last = place
    if (applying || hash === formatHash(parseHash(window.location.hash))) return
    const sameEntry = before.lookup
      ? place.lookup !== undefined
      : place.lookup === undefined &&
        before.books === undefined &&
        place.books === undefined &&
        before.view === place.view &&
        before.id === place.id
    if (sameEntry) window.history.replaceState(null, '', hash)
    else window.history.pushState(null, '', hash)
  }

  apply()
  last = placeOf()
  const unsubscribe = useCharacterStore.subscribe(write)
  const unsubscribeLookup = useLookupStore.subscribe(write)
  const unsubscribeBooks = useBookStore.subscribe(write)
  window.addEventListener('popstate', apply)
  window.addEventListener('hashchange', apply)
  return () => {
    unsubscribe()
    unsubscribeLookup()
    unsubscribeBooks()
    window.removeEventListener('popstate', apply)
    window.removeEventListener('hashchange', apply)
  }
}
