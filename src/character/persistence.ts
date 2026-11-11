// Keeping the characters in the app and the characters in storage the same.
//
// The character store holds the characters in memory and knows nothing about
// where they are kept. `connectCharacterStorage` joins it to a `CharacterStorage`:
// what is stored is read into the app once, and from then on every character
// that changes is saved and every character that is deleted is removed.

import type { CharacterStorage } from '../storage/characters'
import { storageNotKept } from '../storage/status'
import type { Character } from './model'
import { useCharacterStore } from './store'

/**
 * Join the character store to a storage. Resolves once the stored characters
 * are in the app; it never rejects (a storage that fails is reported through the
 * storage status, and the app carries on with what it has).
 *
 * Changes are saved from the first moment, also those made before the stored
 * characters have arrived, which are then added underneath them.
 */
export function connectCharacterStorage(storage: CharacterStorage): Promise<void> {
  // Each character as storage last received it. A character is saved when the
  // one in the app is no longer this very object.
  const kept = new Map<string, Character>()

  useCharacterStore.subscribe(({ characters }) => {
    for (const [id, character] of Object.entries(characters)) {
      if (kept.get(id) === character) continue
      kept.set(id, character)
      storage.save(character).catch(storageNotKept)
    }
    for (const id of [...kept.keys()]) {
      if (Object.hasOwn(characters, id)) continue
      kept.delete(id)
      storage.remove(id).catch(storageNotKept)
    }
  })

  return storage.loadAll().then((loaded) => {
    // The list shows characters in the order they were created.
    const stored = [...loaded].sort((a, b) => a.createdAt - b.createdAt)
    for (const character of stored) kept.set(character.id, character)
    useCharacterStore.setState((state) => ({
      characters: {
        ...Object.fromEntries(stored.map((character) => [character.id, character])),
        ...state.characters,
      },
      order: [
        ...stored.map(({ id }) => id).filter((id) => !state.order.includes(id)),
        ...state.order,
      ],
    }))
  }, storageNotKept)
}
