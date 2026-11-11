import { useEffect, useMemo } from 'react'
import { nameIndex, reconcileNames } from '../character/names'
import { useActiveCharacter, useCharacterStore } from '../character/store'
import { loadItems } from '../data/items'
import { loadSpells } from '../data/spells'
import { useAsyncData } from './useAsyncData'

/**
 * Keep the open character's picks named the way the content in use names them
 * (see src/character/names.ts): when the character is opened, when it changes,
 * and when the content does (the full content arrives, or is switched off).
 *
 * The spells and items are the entries that go by two names. Both lists are the
 * ones the editor's sections load, so nothing is fetched on this hook's account.
 * A list that has not loaded, or failed to, simply contributes no names.
 */
export function useContentNames(): void {
  const character = useActiveCharacter()
  const replaceCharacter = useCharacterStore((s) => s.replaceCharacter)
  const { data: spells } = useAsyncData(loadSpells)
  const { data: items } = useAsyncData(loadItems)

  const index = useMemo(
    () => nameIndex([...(spells ?? []), ...(items ?? [])]),
    [spells, items],
  )

  useEffect(() => {
    if (!character) return
    const named = reconcileNames(character, index)
    if (named !== character) replaceCharacter(named)
  }, [character, index, replaceCharacter])
}
