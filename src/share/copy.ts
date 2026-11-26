// Keeping a copy of a shared character.

import { historyEntry, type Character } from '../character/model'

/** The copy to keep: a new character of its own, with a history that starts with the copying. */
export function copyOfShared(shared: Character, now = Date.now()): Character {
  return {
    ...structuredClone(shared),
    id: crypto.randomUUID(),
    history: [historyEntry(now, { type: 'duplicated', from: shared.id })],
    createdAt: now,
    updatedAt: now,
  }
}
