// What the character can cast and the spell data to look it up in: the casting classes,
// every spell by key and by name, and every grant that gives a spell or a choice of one.
// The Spells section edits against it and the sheet's Spells tab reads it.

import { useMemo } from 'react'
import { useActiveCharacter } from '../../character/store'
import { characterCasters } from '../../character/spellcasting'
import { resolveSpellGrants, spellsByName } from '../../character/spellGrants'
import { loadSpells } from '../../data/spells'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useFeatSummary } from './useFeatSummary'

export function useSpellList() {
  const character = useActiveCharacter()
  const featSummary = useFeatSummary()
  const spellsData = useAsyncData(loadSpells)
  const { classByKey, race, background, summary } = featSummary

  const casters = useMemo(
    () =>
      character ? characterCasters(character, classByKey, summary.abilityBonus) : [],
    [character, classByKey, summary.abilityBonus],
  )
  const allSpells = useMemo(() => spellsData.data ?? [], [spellsData.data])
  const byKey = useMemo(() => new Map(allSpells.map((s) => [s.key, s])), [allSpells])
  const byName = useMemo(() => spellsByName(allSpells), [allSpells])
  const resolved = useMemo(
    () =>
      character
        ? resolveSpellGrants(character, {
            race,
            background,
            featSlots: summary.slots,
            classByKey,
          })
        : undefined,
    [character, race, background, summary.slots, classByKey],
  )
  const grants = useMemo(() => resolved?.grants ?? [], [resolved])

  return {
    featSummary,
    spellsData,
    casters,
    allSpells,
    byKey,
    byName,
    resolved,
    grants,
    loading: featSummary.loading || spellsData.loading,
    error: featSummary.error ?? spellsData.error,
  }
}
