// The characters in the app, and which one is open.
//
// This store holds them in memory only. Where they are kept between visits is
// the business of a `CharacterStorage`, joined to this store by
// `connectCharacterStorage` (see persistence.ts).

import { create } from 'zustand'
import { edited, type CharacterPatch } from './history'
import {
  createCharacter,
  historyEntry,
  type Character,
  type HistoryAction,
} from './model'

type View = 'list' | 'editor'

interface CCState {
  characters: Record<string, Character>
  /** Display order of character ids (most recently created last). */
  order: string[]
  activeId: string | null
  view: View

  newCharacter: () => void
  openCharacter: (id: string) => void
  deleteCharacter: (id: string) => void
  duplicateCharacter: (id: string) => void
  renameCharacter: (id: string, name: string) => void
  importCharacter: (character: Character) => void
  /**
   * Put a corrected copy of a stored character in its place. This is not an edit
   * by the player, so `updatedAt` is left alone and nothing is recorded.
   */
  replaceCharacter: (character: Character) => void
  backToList: () => void
  /**
   * Merge a patch into the active character, bump `updatedAt` and record the edit
   * in its history. `action` says what the edit was when it was more than an
   * edit (a roll).
   */
  updateActive: (patch: CharacterPatch, action?: HistoryAction) => void
}

export const useCharacterStore = create<CCState>()((set, get) => ({
  characters: {},
  order: [],
  activeId: null,
  view: 'list',

  newCharacter: () => {
    const character = createCharacter()
    set((s) => ({
      characters: { ...s.characters, [character.id]: character },
      order: [...s.order, character.id],
      activeId: character.id,
      view: 'editor',
    }))
  },

  openCharacter: (id) => {
    if (!get().characters[id]) return
    set({ activeId: id, view: 'editor' })
  },

  deleteCharacter: (id) => {
    set((s) => {
      const characters = { ...s.characters }
      delete characters[id]
      const order = s.order.filter((x) => x !== id)
      const activeId = s.activeId === id ? null : s.activeId
      return {
        characters,
        order,
        activeId,
        view: activeId ? s.view : 'list',
      }
    })
  },

  duplicateCharacter: (id) => {
    const source = get().characters[id]
    if (!source) return
    const now = Date.now()
    const clone = structuredClone(source)
    const copy: Character = {
      ...clone,
      id: crypto.randomUUID(),
      name: `${source.name} (copy)`,
      // The copy is the same character so far: it keeps the history, and says
      // where it came from.
      history: [...clone.history, historyEntry(now, { type: 'duplicated', from: id })],
      createdAt: now,
      updatedAt: now,
    }
    set((s) => ({
      characters: { ...s.characters, [copy.id]: copy },
      order: [...s.order, copy.id],
    }))
  },

  renameCharacter: (id, name) => {
    set((s) => {
      const existing = s.characters[id]
      if (!existing) return s
      return { characters: { ...s.characters, [id]: edited(existing, { name }) } }
    })
  },

  importCharacter: (character) => {
    set((s) => ({
      characters: { ...s.characters, [character.id]: character },
      order: s.order.includes(character.id) ? s.order : [...s.order, character.id],
    }))
  },

  replaceCharacter: (character) => {
    set((s) =>
      s.characters[character.id]
        ? { characters: { ...s.characters, [character.id]: character } }
        : s,
    )
  },

  backToList: () => set({ view: 'list', activeId: null }),

  updateActive: (patch, action) => {
    set((s) => {
      if (!s.activeId) return s
      const existing = s.characters[s.activeId]
      if (!existing) return s
      return {
        characters: {
          ...s.characters,
          [s.activeId]: edited(existing, patch, action),
        },
      }
    })
  },
}))

/** Selector: the currently active character, or null. */
export function useActiveCharacter(): Character | null {
  return useCharacterStore((s) =>
    s.activeId ? (s.characters[s.activeId] ?? null) : null,
  )
}
