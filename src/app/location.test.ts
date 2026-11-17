import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCharacter } from '../character/model'
import { selectSheetTab, useCharacterStore } from '../character/store'
import { openBook, useBookStore } from '../books/state'
import { useLookupStore } from '../lookup/state'
import { connectLocation, formatHash, parseHash } from './location'

const nextEvent = (name: 'popstate' | 'hashchange') =>
  new Promise<void>((resolve) =>
    window.addEventListener(name, () => resolve(), { once: true }),
  )

let disconnect: (() => void) | undefined
const tom = createCharacter('Tom')

/** A page load: the stored characters are there, nothing is open, the address is read. */
function loadPage() {
  disconnect?.()
  useCharacterStore.setState({
    characters: { [tom.id]: tom },
    order: [tom.id],
    activeId: null,
    view: 'list',
    sheetTab: null,
  })
  useLookupStore.setState({ open: false, entryId: null })
  useBookStore.setState({ open: false, place: null })
  disconnect = connectLocation()
}

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})
afterEach(() => {
  disconnect?.()
  disconnect = undefined
})

describe('the address', () => {
  it('writes and reads back every place', () => {
    for (const place of [
      { view: 'list' as const },
      { view: 'editor' as const, id: 'a-1' },
      { view: 'sheet' as const, id: 'a-1', tab: null },
      { view: 'sheet' as const, id: 'a-1', tab: 'spells' },
      { view: 'levelUp' as const, id: 'a-1' },
    ]) {
      expect(parseHash(formatHash(place))).toEqual({
        ...place,
        ...(place.view === 'list' ? {} : { tab: place.tab ?? null }),
      })
    }
    expect(formatHash({ view: 'sheet', id: 'a-1', tab: 'spells' })).toBe(
      '#/c/a-1/sheet/spells',
    )
    expect(formatHash({ view: 'editor', id: 'a-1', tab: 'spells' })).toBe('#/c/a-1/edit')
    expect(formatHash({ view: 'levelUp', id: 'a-1' })).toBe('#/c/a-1/levelup')
  })

  it('writes and reads back Quick lookup, with or without an entry', () => {
    expect(formatHash({ view: 'list', lookup: { entryId: null } })).toBe('#/lookup')
    expect(
      formatHash({
        view: 'editor',
        id: 'a-1',
        lookup: { entryId: 'spell:fire ball|phb' },
      }),
    ).toBe('#/lookup/spell%3Afire%20ball%7Cphb')
    expect(parseHash('#/lookup')).toEqual({ view: 'list', lookup: { entryId: null } })
    expect(parseHash('#/lookup/spell%3Afire%20ball%7Cphb')).toEqual({
      view: 'list',
      lookup: { entryId: 'spell:fire ball|phb' },
    })
    expect(parseHash('#/lookup/a/b')).toEqual({ view: 'list' })
    expect(parseHash('#/lookup/%E0%A4%A')).toEqual({ view: 'list' })
  })

  it('takes anything it does not understand as the list', () => {
    for (const hash of [
      '',
      '#',
      '#/',
      '#/x',
      '#/c',
      '#/c/a',
      '#/c/a/nope',
      '#/c/a/edit/x',
    ]) {
      expect(parseHash(hash)).toEqual({ view: 'list' })
    }
    expect(parseHash('#/c/%E0%A4%A/sheet')).toEqual({ view: 'list' })
  })
})

describe('keeping the address and the app in step', () => {
  it('shows where the app is, with ids and names only', () => {
    loadPage()
    useCharacterStore.getState().openCharacter(tom.id)
    expect(window.location.hash).toBe(`#/c/${tom.id}/edit`)
    useCharacterStore.getState().setView('sheet')
    useCharacterStore.getState().setSheetTab('spells')
    expect(window.location.hash).toBe(`#/c/${tom.id}/sheet/spells`)
    expect(decodeURIComponent(window.location.hash)).not.toContain('Tom')
    useCharacterStore.getState().backToList()
    expect(window.location.hash).toBe('#/')
  })

  it('restores the view, character and tab after a reload', () => {
    loadPage()
    useCharacterStore.getState().openCharacter(tom.id)
    useCharacterStore.getState().setView('sheet')
    useCharacterStore.getState().setSheetTab('spells')

    loadPage()
    const state = useCharacterStore.getState()
    expect([state.view, state.activeId, selectSheetTab(state)]).toEqual([
      'sheet',
      tom.id,
      'spells',
    ])
  })

  it('goes Back and Forward through the places visited', async () => {
    loadPage()
    const store = useCharacterStore.getState()
    store.openCharacter(tom.id)
    store.setView('sheet')
    store.setSheetTab('notes')

    let moved = nextEvent('popstate')
    window.history.back()
    await moved
    expect(useCharacterStore.getState().view).toBe('editor')
    expect(selectSheetTab(useCharacterStore.getState())).toBeNull()

    moved = nextEvent('popstate')
    window.history.back()
    await moved
    expect(useCharacterStore.getState().view).toBe('list')
    expect(useCharacterStore.getState().activeId).toBeNull()

    moved = nextEvent('popstate')
    window.history.forward()
    await moved
    expect(useCharacterStore.getState().view).toBe('editor')
    expect(useCharacterStore.getState().activeId).toBe(tom.id)
  })

  it('opens Quick lookup over the open view without changing the character', () => {
    loadPage()
    useCharacterStore.getState().openCharacter(tom.id)
    const before = useCharacterStore.getState().characters[tom.id]
    useLookupStore.getState().openLookup()
    expect(window.location.hash).toBe('#/lookup')
    expect(useCharacterStore.getState().view).toBe('editor')
    useLookupStore.getState().openLookup('item:rope|phb')
    expect(window.location.hash).toBe('#/lookup/item%3Arope%7Cphb')
    useLookupStore.getState().closeLookup()
    expect(window.location.hash).toBe(`#/c/${tom.id}/edit`)
    expect(useCharacterStore.getState().characters[tom.id]).toBe(before)
  })

  it('opens Quick lookup from an address, after a reload', () => {
    window.history.replaceState(null, '', '#/lookup/item%3Arope%7Cphb')
    loadPage()
    expect(useLookupStore.getState()).toMatchObject({
      open: true,
      entryId: 'item:rope|phb',
    })
    expect(window.location.hash).toBe('#/lookup/item%3Arope%7Cphb')
  })

  it('goes Back from Quick lookup to the view it was opened over, and Forward to it', async () => {
    loadPage()
    useCharacterStore.getState().openCharacter(tom.id)
    useLookupStore.getState().openLookup()

    let moved = nextEvent('popstate')
    window.history.back()
    await moved
    expect(useLookupStore.getState().open).toBe(false)
    expect(useCharacterStore.getState().view).toBe('editor')

    moved = nextEvent('popstate')
    window.history.forward()
    await moved
    expect(useLookupStore.getState().open).toBe(true)
    expect(useCharacterStore.getState().view).toBe('editor')
    expect(useCharacterStore.getState().activeId).toBe(tom.id)
  })

  it('opens the book reader over the open view, one step of history for each place', async () => {
    loadPage()
    useCharacterStore.getState().openCharacter(tom.id)
    openBook(null)
    expect(window.location.hash).toBe('#/books')
    expect(useCharacterStore.getState().view).toBe('editor')
    const place = {
      kind: 'book' as const,
      id: 'PHB',
      chapter: 1,
      anchor: 'a',
      find: null,
    }
    openBook(place)
    expect(window.location.hash).toBe('#/book/PHB/1/a')

    let moved = nextEvent('popstate')
    window.history.back()
    await moved
    expect(window.location.hash).toBe('#/books')
    expect(useBookStore.getState()).toMatchObject({ open: true, place: null })

    moved = nextEvent('popstate')
    window.history.back()
    await moved
    expect(useBookStore.getState().open).toBe(false)
    expect(window.location.hash).toBe(`#/c/${tom.id}/edit`)
  })

  it('opens the book reader from an address, after a reload', () => {
    window.history.replaceState(null, '', '#/book/PHB/2?find=dragon')
    loadPage()
    expect(useBookStore.getState()).toMatchObject({
      open: true,
      place: { id: 'PHB', chapter: 2, find: 'dragon' },
    })
    expect(window.location.hash).toBe('#/book/PHB/2?find=dragon')
  })

  it('does not open a place again when the address already shows it', () => {
    window.history.replaceState(null, '', '#/books')
    loadPage()
    const { request } = useBookStore.getState()
    window.dispatchEvent(new Event('hashchange'))
    expect(useBookStore.getState().request).toBe(request)
  })

  it('lets Quick lookup opened over the reader take the address', () => {
    loadPage()
    openBook(null)
    useLookupStore.getState().openLookup()
    expect(window.location.hash).toBe('#/lookup')
    useLookupStore.getState().closeLookup()
    expect(window.location.hash).toBe('#/books')
  })

  it('follows an address typed in', async () => {
    loadPage()
    const changed = nextEvent('hashchange')
    window.location.hash = `#/c/${tom.id}/sheet/features`
    await changed
    const state = useCharacterStore.getState()
    expect([state.view, selectSheetTab(state)]).toEqual(['sheet', 'features'])
  })

  it('sends an unknown character to the list without an error', () => {
    window.history.replaceState(null, '', '#/c/not-a-character/sheet/spells')
    loadPage()
    expect(useCharacterStore.getState().view).toBe('list')
    expect(useCharacterStore.getState().activeId).toBeNull()
    expect(window.location.hash).toBe('#/')
  })

  it('sends a character that was deleted to the list', () => {
    loadPage()
    useCharacterStore.getState().openCharacter(tom.id)
    const address = window.location.hash
    useCharacterStore.getState().deleteCharacter(tom.id)
    expect(window.location.hash).toBe('#/')
    // The old address, opened after the character is gone.
    window.history.replaceState(null, '', address)
    disconnect?.()
    disconnect = connectLocation()
    expect(useCharacterStore.getState().view).toBe('list')
    expect(window.location.hash).toBe('#/')
  })

  it('opens the sheet an address names once the characters have loaded', async () => {
    useCharacterStore.setState({
      characters: {},
      order: [],
      activeId: null,
      view: 'list',
      sheetTab: null,
    })
    window.history.replaceState(null, '', `#/c/${tom.id}/sheet/actions`)
    let finish = () => {}
    const loaded = new Promise<void>((resolve) => {
      finish = resolve
    })
    disconnect = connectLocation(loaded)
    // While they load, the address is left as it is.
    expect(window.location.hash).toBe(`#/c/${tom.id}/sheet/actions`)
    useCharacterStore.setState({ characters: { [tom.id]: tom }, order: [tom.id] })
    expect(window.location.hash).toBe(`#/c/${tom.id}/sheet/actions`)
    finish()
    await loaded
    await Promise.resolve()
    const state = useCharacterStore.getState()
    expect(state.view).toBe('sheet')
    expect(state.activeId).toBe(tom.id)
    expect(selectSheetTab(state)).toBe('actions')
    expect(window.location.hash).toBe(`#/c/${tom.id}/sheet/actions`)
  })

  it('starts nothing once disconnected while the characters load', async () => {
    loadPage()
    disconnect?.()
    window.history.replaceState(null, '', `#/c/${tom.id}/edit`)
    const loaded = Promise.resolve()
    connectLocation(loaded)()
    await loaded
    await Promise.resolve()
    expect(useCharacterStore.getState().view).toBe('list')
  })

  it('stops following when disconnected', () => {
    loadPage()
    disconnect?.()
    useCharacterStore.getState().openCharacter(tom.id)
    expect(window.location.hash).toBe('')
  })
})
