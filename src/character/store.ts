// The characters in the app, and which one is open.
//
// This store holds them in memory only. Where they are kept between visits is
// the business of a `CharacterStorage`, joined to this store by
// `connectCharacterStorage` (see persistence.ts).

import { create } from 'zustand'
import { edited, type CharacterPatch } from './history'
import { canGainLevel } from './levelUp'
import {
  createCharacter,
  historyEntry,
  type Character,
  type HistoryAction,
} from './model'

export type View = 'list' | 'editor' | 'sheet' | 'levelUp'

/**
 * What the last level up changed, kept in memory for this visit to the character so it can
 * be taken back: the character, the history entry it made and the build values before it.
 */
export interface LevelUpUndo {
  id: string
  entryId: string
  restore: CharacterPatch
}

/** Whether Level up can open for a character: after Done, below level 20. */
export const canLevelUp = (character: Character) =>
  character.completedAt !== undefined && canGainLevel(character)

interface CCState {
  characters: Record<string, Character>
  /** Display order of character ids (most recently created last). */
  order: string[]
  activeId: string | null
  view: View
  /**
   * The sheet tab the player chose, and the character it was chosen on, so a tab never
   * carries over to another character. Null until one is chosen, when the first shows.
   */
  sheetTab: { id: string; tab: string } | null
  /** The last level up of the open character, while it can still be undone. */
  levelUpUndo: LevelUpUndo | null

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
   * Switch the open character between its editor, its sheet and Level up. Nothing happens
   * while no character is open, and Level up opens only when the character can gain a level.
   */
  setView: (view: Exclude<View, 'list'>) => void
  /** Open a tab of the sheet. */
  setSheetTab: (tab: string) => void
  /**
   * Go to a place named by the address (see src/app/location.ts). A character that is not
   * stored sends the app to the list.
   */
  restoreLocation: (place: { view: View; id?: string; tab?: string | null }) => void
  /**
   * The player pressed Done on the active character: record it (once) and open the sheet.
   * Open choices do not stop it.
   */
  completeBuild: () => void
  /**
   * Merge a patch into the active character, bump `updatedAt` and record the edit
   * in its history. `action` says what the edit was when it was more than an
   * edit (a roll).
   */
  updateActive: (patch: CharacterPatch, action?: HistoryAction) => void
  /**
   * Apply a level up to the active character as one edit (`patch` holds the build values
   * it changed), remember how to undo it, and open the sheet.
   */
  confirmLevelUp: (
    patch: CharacterPatch,
    action: Extract<HistoryAction, { type: 'level-up' }>,
  ) => void
  /** Take the last level up back, while nothing but play has changed since. */
  undoLevelUp: () => void
}

export const useCharacterStore = create<CCState>()((set, get) => ({
  characters: {},
  order: [],
  activeId: null,
  view: 'list',
  sheetTab: null,
  levelUpUndo: null,

  newCharacter: () => {
    const character = createCharacter()
    set((s) => ({
      characters: { ...s.characters, [character.id]: character },
      order: [...s.order, character.id],
      activeId: character.id,
      view: 'editor',
      sheetTab: null,
      levelUpUndo: null,
    }))
  },

  openCharacter: (id) => {
    const character = get().characters[id]
    if (!character) return
    // A finished build opens on its sheet; one still in progress, in the editor.
    set({
      activeId: id,
      view: character.completedAt === undefined ? 'editor' : 'sheet',
      sheetTab: null,
      levelUpUndo: null,
    })
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
        sheetTab: activeId ? s.sheetTab : null,
        levelUpUndo: s.levelUpUndo?.id === id ? null : s.levelUpUndo,
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

  backToList: () =>
    set({ view: 'list', activeId: null, sheetTab: null, levelUpUndo: null }),

  setView: (view) => {
    const { activeId, characters } = get()
    const character = activeId ? characters[activeId] : undefined
    if (!character) return
    if (view === 'levelUp' && !canLevelUp(character)) return
    set({ view, sheetTab: null })
  },

  setSheetTab: (tab) =>
    set((s) => (s.activeId ? { sheetTab: { id: s.activeId, tab } } : s)),

  restoreLocation: ({ view, id, tab }) => {
    const character = id ? get().characters[id] : undefined
    if (view === 'list' || !id || !character) {
      set({ view: 'list', activeId: null, sheetTab: null, levelUpUndo: null })
      return
    }
    // An address of Level up for a character that cannot gain a level shows its sheet.
    const shown = view === 'levelUp' && !canLevelUp(character) ? 'sheet' : view
    set((s) => ({
      view: shown,
      activeId: id,
      sheetTab: shown === 'sheet' && tab ? { id, tab } : null,
      levelUpUndo: s.levelUpUndo?.id === id ? s.levelUpUndo : null,
    }))
  },

  completeBuild: () => {
    const { activeId, characters } = get()
    if (!activeId) return
    const existing = characters[activeId]
    if (!existing) return
    if (existing.completedAt === undefined) {
      get().updateActive({ completedAt: Date.now() }, { type: 'completed' })
    }
    set({ view: 'sheet', sheetTab: null })
  },

  confirmLevelUp: (patch, action) => {
    const { activeId, characters } = get()
    const before = activeId ? characters[activeId] : undefined
    if (!activeId || !before) return
    const restore: CharacterPatch = Object.fromEntries(
      Object.keys(patch).map((key) => [key, before[key as keyof CharacterPatch]]),
    )
    get().updateActive(patch, action)
    const entry = get().characters[activeId].history.at(-1)
    set({
      view: 'sheet',
      sheetTab: null,
      levelUpUndo: entry ? { id: activeId, entryId: entry.id, restore } : null,
    })
  },

  undoLevelUp: () => {
    const state = get()
    const undo = state.levelUpUndo
    if (!undo || !selectCanUndoLevelUp(state)) return
    state.updateActive(undo.restore, { type: 'level-up-undone' })
    set({ levelUpUndo: null })
  },

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

/** Selector: the tab chosen on the open character's sheet, or null. */
export const selectSheetTab = (s: Pick<CCState, 'activeId' | 'sheetTab'>) =>
  s.sheetTab && s.sheetTab.id === s.activeId ? s.sheetTab.tab : null

/**
 * Selector: whether the open character's last level up can be undone. It can while it is
 * the last change to the build: what happened in play since (damage, a rest) does not
 * count, and is kept.
 */
export function selectCanUndoLevelUp(
  s: Pick<CCState, 'activeId' | 'characters' | 'levelUpUndo'>,
): boolean {
  const undo = s.levelUpUndo
  if (!undo || undo.id !== s.activeId) return false
  const history = s.characters[undo.id]?.history ?? []
  const at = history.findIndex((entry) => entry.id === undo.entryId)
  if (at < 0) return false
  return history
    .slice(at + 1)
    .every(
      (entry) =>
        (!entry.action || entry.action.type === 'rest') &&
        entry.changes.every((change) => change.path[0] === 'play'),
    )
}

/** Selector: the currently active character, or null. */
export function useActiveCharacter(): Character | null {
  return useCharacterStore((s) =>
    s.activeId ? (s.characters[s.activeId] ?? null) : null,
  )
}
