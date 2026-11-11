// Where the user's characters are kept.
//
// The app reads and writes characters through `CharacterStorage` and never
// through a browser API. Another place to keep them (the user's account, later)
// is another implementation of this interface, not a change to the app.
//
// `localCharacterStorage` is the implementation for this device: one record per
// character in a key-value store (the browser's database), so saving one
// character never rewrites the others and a long history has room to grow.

import {
  ensureCharacterDefaults,
  type Character,
  type StoredCharacter,
} from '../character/model'
import type { DeviceSettings } from './deviceSettings'
import type { KeyValueStore } from './keyValue'

export interface CharacterStorage {
  /** Every stored character, complete for the current model. */
  loadAll(): Promise<Character[]>
  /** Store a character, replacing the stored one with the same id. */
  save(character: Character): Promise<void>
  remove(id: string): Promise<void>
}

/**
 * Where characters were kept before: all of them in one device setting, in the
 * layout the state library wrote (`{ state: { characters: { id: character } } }`).
 * They are brought over once. The setting itself is left as it is, so nothing
 * of the user's is deleted, and a second setting records that the move is done.
 */
export interface EarlierCharacters {
  settings: DeviceSettings
  /** The setting that held the characters. */
  key: string
  /** The setting that records they were brought over. */
  movedKey: string
}

export interface LocalCharacterStorageOptions {
  store: KeyValueStore<Character>
  /** Whether what is written now will still be there on the next visit. */
  persistent: () => boolean
  earlier: EarlierCharacters
}

function readEarlier({ settings, key, movedKey }: EarlierCharacters): Character[] {
  if (settings.getItem(movedKey) !== null) return []
  const text = settings.getItem(key)
  if (text === null) return []
  try {
    const saved = JSON.parse(text) as {
      state?: { characters?: Record<string, StoredCharacter | null> }
    }
    return Object.entries(saved.state?.characters ?? {})
      .filter(([, character]) => typeof character === 'object' && character !== null)
      .map(([id, character]) => ensureCharacterDefaults({ ...character, id }))
  } catch {
    // Not what the app wrote: there is nothing to bring over.
    return []
  }
}

export function localCharacterStorage({
  store,
  persistent,
  earlier,
}: LocalCharacterStorageOptions): CharacterStorage {
  return {
    async loadAll() {
      const ids = await store.keys()
      const stored = await Promise.all(ids.map((id) => store.get(id)))
      // A record an earlier version of the app wrote is stored again once it has
      // been brought up to date, so that happens one time and not on every visit.
      const upgraded: Character[] = []
      const characters = stored.flatMap((record, at) => {
        if (!record) return []
        const character = ensureCharacterDefaults({ ...record, id: ids[at] })
        if (character.schemaVersion !== record.schemaVersion) upgraded.push(character)
        return [character]
      })

      const brought = readEarlier(earlier).filter(({ id }) => !ids.includes(id))
      await Promise.all(
        [...upgraded, ...brought].map((character) => store.set(character.id, character)),
      )
      // Only a move that will last counts as done; otherwise it is tried again
      // on the next visit, and the characters are there for this one meanwhile.
      if (persistent()) earlier.settings.setItem(earlier.movedKey, 'true')

      return [...characters, ...brought]
    },
    save: (character) => store.set(character.id, character),
    remove: (id) => store.delete(id),
  }
}
