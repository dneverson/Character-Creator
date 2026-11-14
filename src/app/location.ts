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
//
// The store is the source of truth. A change of view, character or tab writes the hash
// (a new history entry when the view or character changed, so Back and Forward work; the
// same entry when only the tab did). A change of the hash (reload, Back, Forward, a typed
// address) is applied to the store. An address that names no stored character, or that is
// not understood, leads to the list.

import { selectSheetTab, useCharacterStore, type View } from '../character/store'

export interface Place {
  view: View
  id?: string
  tab?: string | null
}

const VIEW_SEGMENT = { editor: 'edit', sheet: 'sheet', levelUp: 'levelup' } as const
const SEGMENT_VIEW: Record<string, Exclude<View, 'list'>> = {
  edit: 'editor',
  sheet: 'sheet',
  levelup: 'levelUp',
}

/** The hash for a place. */
export function formatHash({ view, id, tab }: Place): string {
  if (view === 'list' || !id) return '#/'
  const base = `#/c/${encodeURIComponent(id)}/${VIEW_SEGMENT[view]}`
  return view === 'sheet' && tab ? `${base}/${encodeURIComponent(tab)}` : base
}

/** The place a hash names; anything that is not understood is the list. */
export function parseHash(hash: string): Place {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const [head, id, segment, tab] = parts
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
  return view === 'list' || !activeId
    ? { view: 'list' }
    : { view, id: activeId, tab: selectSheetTab(state) }
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
      useCharacterStore.getState().restoreLocation(place)
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
    const sameEntry = before.view === place.view && before.id === place.id
    if (sameEntry) window.history.replaceState(null, '', hash)
    else window.history.pushState(null, '', hash)
  }

  apply()
  last = placeOf()
  const unsubscribe = useCharacterStore.subscribe(write)
  window.addEventListener('popstate', apply)
  window.addEventListener('hashchange', apply)
  return () => {
    unsubscribe()
    window.removeEventListener('popstate', apply)
    window.removeEventListener('hashchange', apply)
  }
}
