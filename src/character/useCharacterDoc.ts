// "The character document": the one character the editor sections and the sheet read, and
// the one way they change it. By default that is the character open in the store, and an
// edit goes through the store (so it is saved and recorded in the history). A provider
// (see CharacterDoc.tsx) can point the same sections at another copy, a draft, so that
// nothing reaches the store until the draft is accepted.

import { createContext, useContext } from 'react'
import type { CharacterPatch } from './history'
import type { Character, HistoryAction } from './model'
import { useCharacterStore } from './store'

/** Changes the document: merges a patch and records the edit, as the store does. */
export type UpdateCharacter = (patch: CharacterPatch, action?: HistoryAction) => void

export interface CharacterDoc {
  /** The document as rendered; null when no character is open. */
  character: Character | null
  update: UpdateCharacter
  /**
   * The document as it is at this moment, for handlers that run several changes in one
   * click and so must not read the rendered copy.
   */
  latest: () => Character | undefined
}

/** The provided document; null means the store's open character. */
export const CharacterDocContext = createContext<CharacterDoc | null>(null)

/** The character open in the store, as it is now. */
function latestInStore(): Character | undefined {
  const { activeId, characters } = useCharacterStore.getState()
  return activeId ? characters[activeId] : undefined
}

/** The character to show: the provided document's, else the store's open character. */
export function useCharacter(): Character | null {
  const doc = useContext(CharacterDocContext)
  const inStore = useCharacterStore((s) =>
    doc || !s.activeId ? null : (s.characters[s.activeId] ?? null),
  )
  return doc ? doc.character : inStore
}

/** The way to change the character: the provided document's, else the store's. */
export function useUpdateCharacter(): UpdateCharacter {
  const doc = useContext(CharacterDocContext)
  const updateActive = useCharacterStore((s) => s.updateActive)
  return doc ? doc.update : updateActive
}

/** A reader of the character as it is at the moment it is called. */
export function useLatestCharacter(): () => Character | undefined {
  const doc = useContext(CharacterDocContext)
  return doc ? doc.latest : latestInStore
}
