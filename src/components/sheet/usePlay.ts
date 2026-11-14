// The play state of the current character, read against its build, and the one way the
// sheet changes it. A change reads the state as it is at that moment, so quick clicks add
// up, and goes through the character document, which records it in the history like any
// other edit.

import { useCallback, useMemo } from 'react'
import {
  useCharacter,
  useLatestCharacter,
  useUpdateCharacter,
} from '../../character/useCharacterDoc'
import type { HistoryAction, PlayState } from '../../character/model'
import type { DerivedSheet } from '../../derived'
import { derivePlay } from '../../play/derivePlay'

/** A function that replaces the play state with what `change` makes of it. */
export function useApplyPlay() {
  const latest = useLatestCharacter()
  const update = useUpdateCharacter()
  return useCallback(
    (change: (play: PlayState) => PlayState, action?: HistoryAction): void => {
      const character = latest()
      if (character) update({ play: change(character.play) }, action)
    },
    [latest, update],
  )
}

/** The play state and what is left of it against the build; undefined without a character. */
export function usePlay(sheet: DerivedSheet) {
  const play = useCharacter()?.play
  const derived = useMemo(
    () => (play ? derivePlay(sheet, play) : undefined),
    [sheet, play],
  )
  return play && derived ? { play, derived } : undefined
}
