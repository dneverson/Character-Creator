// The character's whole spell list for reading, with nothing to remove: the lines of the
// sheet's Spells tab.

import { useMemo } from 'react'
import { useCharacter } from '../../character/useCharacterDoc'
import type { SpellLine } from './SpellLines'
import { useSpellList } from './useSpellList'
import { yourSpellLines, type YourSpellsInputs } from './yourSpellLines'

export function useSpellLines(effects?: YourSpellsInputs['effects']) {
  const character = useCharacter()
  const { casters, grants, byKey, byName, loading } = useSpellList()
  const list = useMemo(() => {
    if (!character) return { lines: [] as SpellLine[], granted: 0 }
    const { lines, granted } = yourSpellLines({
      casters,
      character,
      grants: grants.filter((g) => g.mode !== 'expanded'),
      byKey,
      byName,
      removeClassPick: () => undefined,
      removeGrantPick: () => undefined,
      effects,
    })
    return { lines: lines.map((l) => ({ ...l, remove: undefined })), granted }
  }, [character, casters, grants, byKey, byName, effects])
  return { casters, ...list, loading }
}
