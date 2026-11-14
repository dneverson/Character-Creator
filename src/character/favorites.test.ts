import { describe, expect, it } from 'vitest'
import {
  FAVORITE_KEY_MAX,
  addFavorite,
  moveFavorite,
  normalizeFavorites,
  removeFavorite,
  type Favorite,
} from './favorites'
import { edited } from './history'
import { parseImportedCharacter } from './io'
import { createCharacter, ensureCharacterDefaults } from './model'
import { selectCanUndoLevelUp, useCharacterStore } from './store'

const a: Favorite = { kind: 'attack', key: 'attack|Longsword|PHB' }
const b: Favorite = { kind: 'spell', key: 'Sacred Flame|PHB' }
const c: Favorite = { kind: 'use', key: 'use:rage' }

describe('normalizeFavorites', () => {
  it('keeps valid favorites once each, in order, with only their two fields', () => {
    expect(normalizeFavorites([a, b, { ...a }, { ...c, extra: 1 }])).toEqual([a, b, c])
  })

  it('drops what is not a favorite', () => {
    const junk = [
      null,
      'x',
      42,
      [],
      { kind: 'attack' },
      { key: 'k' },
      { kind: 'weapon', key: 'k' },
      { kind: 'item', key: '' },
      { kind: 'item', key: 7 },
      { kind: 'item', key: 'k'.repeat(FAVORITE_KEY_MAX + 1) },
    ]
    expect(normalizeFavorites(junk)).toEqual([])
    expect(normalizeFavorites('nope')).toEqual([])
    expect(normalizeFavorites(undefined)).toEqual([])
  })

  it('tells one kind from another with the same key', () => {
    expect(
      normalizeFavorites([
        { kind: 'item', key: 'x' },
        { kind: 'feature', key: 'x' },
      ]),
    ).toHaveLength(2)
  })
})

describe('add, remove and move', () => {
  it('adds at the end, once, without touching the list it was given', () => {
    const list = [a]
    expect(addFavorite(list, b)).toEqual([a, b])
    expect(addFavorite([a, b], a)).toEqual([a, b])
    expect(list).toEqual([a])
  })

  it('removes the one favorite', () => {
    expect(removeFavorite([a, b, c], b)).toEqual([a, c])
    expect(removeFavorite([a], b)).toEqual([a])
  })

  it('moves one place and stays put at either end or when absent', () => {
    expect(moveFavorite([a, b, c], c, -1)).toEqual([a, c, b])
    expect(moveFavorite([a, b, c], a, 1)).toEqual([b, a, c])
    expect(moveFavorite([a, b, c], a, -1)).toEqual([a, b, c])
    expect(moveFavorite([a, b, c], c, 1)).toEqual([a, b, c])
    expect(moveFavorite([a, b], c, 1)).toEqual([a, b])
  })
})

describe('a character with favorites', () => {
  it('has none until one is pinned, and loads a saved list cleaned up', () => {
    const made = createCharacter()
    expect('favorites' in ensureCharacterDefaults(made)).toBe(false)
    const loaded = ensureCharacterDefaults(
      JSON.parse(
        JSON.stringify({ ...made, favorites: [a, { kind: 'x', key: 'y' }, a, b] }),
      ),
    )
    expect(loaded.favorites).toEqual([a, b])
    const empty = ensureCharacterDefaults(
      JSON.parse(JSON.stringify({ ...made, favorites: 'all of them' })),
    )
    expect('favorites' in empty).toBe(false)
  })

  it('keeps its schema version: a new optional field needs no migration', () => {
    const made = createCharacter()
    expect(ensureCharacterDefaults({ ...made, favorites: [a] }).schemaVersion).toBe(
      made.schemaVersion,
    )
  })

  it('comes through the export file and an import validates it', () => {
    const made = { ...createCharacter('Tordek'), favorites: [a, b] }
    const exported = JSON.stringify(made, null, 2)
    expect(parseImportedCharacter(exported).favorites).toEqual([a, b])
    const hostile = JSON.stringify({ ...made, favorites: [a, { kind: 'item' }, 5] })
    expect(parseImportedCharacter(hostile).favorites).toEqual([a])
  })

  it('records no history entry when a favorite is pinned, moved or removed', () => {
    const before = createCharacter()
    const pinned = edited(before, { favorites: [a, b] }, undefined, 1000)
    expect(pinned.favorites).toEqual([a, b])
    expect(pinned.history).toEqual(before.history)
    const moved = edited(pinned, { favorites: [b, a] }, undefined, 2000)
    expect(moved.history).toEqual(before.history)
    const removed = edited(moved, { favorites: [] }, undefined, 3000)
    expect(removed.history).toEqual(before.history)
  })

  it('leaves the Level up undo and Done alone', () => {
    const made = createCharacter('Tordek')
    const levelled = edited(
      made,
      { name: 'Tordek the Bold' },
      { type: 'level-up', class: 'Fighter', from: 1, to: 2 },
      1000,
    )
    const entryId = levelled.history[levelled.history.length - 1].id
    useCharacterStore.setState({
      characters: { [levelled.id]: levelled },
      order: [levelled.id],
      activeId: levelled.id,
      levelUpUndo: { id: levelled.id, entryId, restore: { name: 'Tordek' } },
    })
    expect(selectCanUndoLevelUp(useCharacterStore.getState())).toBe(true)
    useCharacterStore.getState().updateActive({ favorites: [a] })
    const after = useCharacterStore.getState()
    expect(selectCanUndoLevelUp(after)).toBe(true)
    expect(after.characters[levelled.id].history).toEqual(levelled.history)
    expect(after.characters[levelled.id].completedAt).toBe(levelled.completedAt)
    useCharacterStore.setState({ levelUpUndo: null })
  })
})
