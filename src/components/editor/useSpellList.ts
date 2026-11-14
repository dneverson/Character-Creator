// What the character can cast and the spell data to look it up in: the casting classes,
// every spell by key and by name, and every grant that gives a spell or a choice of one.
// The Spells section edits against it and the sheet's Spells tab reads it.

import { useMemo } from 'react'
import { useCharacter } from '../../character/useCharacterDoc'
import { characterCasters } from '../../character/spellcasting'
import { resolveSpellGrants, spellsByName } from '../../character/spellGrants'
import { loadClassOptions } from '../../data/classOptions'
import { loadBookEditions } from '../../data/edition'
import { loadSpells } from '../../data/spells'
import { chosenOptions } from '../../derived/classOptions'
import { collectSources } from '../../derived/sources'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useFeatSummary } from './useFeatSummary'

export function useSpellList() {
  const character = useCharacter()
  const featSummary = useFeatSummary()
  const spellsData = useAsyncData(loadSpells)
  const optionData = useAsyncData(loadClassOptions)
  const editions = useAsyncData(loadBookEditions)
  const { classByKey, race, background, summary, feats } = featSummary

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
            options: chosenOptions(
              collectSources(character, {
                classByKey,
                race,
                background,
                feats,
                optionCatalog: optionData.data ?? undefined,
              }),
              {
                classByKey,
                optionCatalog: optionData.data ?? undefined,
                editionOf: editions.data ?? undefined,
              },
            ),
          })
        : undefined,
    [
      character,
      race,
      background,
      summary.slots,
      classByKey,
      feats,
      optionData.data,
      editions.data,
    ],
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
