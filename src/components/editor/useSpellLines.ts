// The character's whole spell list for reading, with nothing to remove: the lines of the
// sheet's Spells tab.

import { useMemo } from 'react'
import { useCharacter } from '../../character/useCharacterDoc'
import type { Line } from '../../derived/types'
import type { SpellLine } from './SpellLines'
import { useSpellList } from './useSpellList'
import { yourSpellLines } from './yourSpellLines'

const NO_EFFECTS: Record<string, Line[]> = {}

/** The spell's key as a class option names it: "eldritch blast|phb". */
const keyOf = (line: SpellLine) => `${line.spell.name}|${line.spell.source}`.toLowerCase()

export function useSpellLines(effects: Record<string, Line[]> = NO_EFFECTS) {
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
    })
    return {
      lines: lines.map((l) => {
        const own = effects[keyOf(l)]
        return { ...l, remove: undefined, ...(own ? { effects: own } : {}) }
      }),
      granted,
    }
  }, [character, casters, grants, byKey, byName, effects])
  return { casters, ...list, loading }
}
