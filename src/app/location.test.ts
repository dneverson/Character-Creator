import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCharacter } from '../character/model'
import { selectSheetTab, useCharacterStore } from '../character/store'
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
