// The play state of the open character, read against its build, and the one way the sheet
// changes it. A change reads the state as it is at that moment, so quick clicks add up, and
// goes through the store, which records it in the history like any other edit.

import { useMemo } from 'react'
import type { HistoryAction, PlayState } from '../../character/model'
import { useActiveCharacter, useCharacterStore } from '../../character/store'
import type { DerivedSheet } from '../../derived'
import { derivePlay } from '../../play/derivePlay'

/** Replaces the open character's play state with what `change` makes of it. */
export function applyPlay(
  change: (play: PlayState) => PlayState,
  action?: HistoryAction,
): void {
  const { activeId, characters, updateActive } = useCharacterStore.getState()
  const character = activeId ? characters[activeId] : undefined
  if (character) updateActive({ play: change(character.play) }, action)
}

/** The play state and what is left of it against the build; undefined without a character. */
export function usePlay(sheet: DerivedSheet) {
  const play = useActiveCharacter()?.play
  const derived = useMemo(
    () => (play ? derivePlay(sheet, play) : undefined),
    [sheet, play],
  )
  return play && derived ? { play, derived } : undefined
}
