// The derived sheet of the active character: every number worked out once from what the
// character has and the loaded data, for the sections that show them.

import { useMemo, useState } from 'react'
import { useCharacter } from '../../character/useCharacterDoc'
import { loadClassOptions } from '../../data/classOptions'
import { loadBookEditions } from '../../data/edition'
import { loadItems } from '../../data/items'
import { loadLanguages } from '../../data/languages'
import { loadRewards } from '../../data/rewards'
import type { Character } from '../../character/model'
import { deriveSheet, sameBuild } from '../../derived'
import type { DeriveDeps } from '../../derived/sources'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useFeatSummary } from './useFeatSummary'

/**
 * The character as last derived: the same object until its build changes, so an edit in
 * play (a use spent, damage taken) keeps the sheet, and what shows it, as they are.
 */
function useBuild(character: Character | null): Character | null {
  const [held, setHeld] = useState(character)
  if (held === character) return held
  if (held && character && sameBuild(held, character)) return held
  setHeld(character)
  return character
}

export function useDerivedSheet() {
  const character = useBuild(useCharacter())
  const { classByKey, background, race, feats, loading, error } = useFeatSummary()
  const items = useAsyncData(loadItems)
  const languages = useAsyncData(loadLanguages)
  const options = useAsyncData(loadClassOptions)
  const editions = useAsyncData(loadBookEditions)
  const rewards = useAsyncData(loadRewards)

  const deps = useMemo<DeriveDeps>(
    () => ({
      classByKey,
      background,
      race,
      feats,
      items: items.data ?? undefined,
      languages: languages.data ?? undefined,
      optionCatalog: options.data ?? undefined,
      editionOf: editions.data ?? undefined,
      rewards: rewards.data ?? undefined,
    }),
    [
      classByKey,
      background,
      race,
      feats,
      items.data,
      languages.data,
      options.data,
      editions.data,
      rewards.data,
    ],
  )

  const sheet = useMemo(
    () => (character ? deriveSheet(character, deps) : undefined),
    [character, deps],
  )

  const catalog = useMemo(
    () => ({ languages: languages.data ?? [], items: items.data ?? [] }),
    [languages.data, items.data],
  )

  return {
    sheet,
    /** What the sheet was derived from, for other derivations of the same character. */
    deps,
    catalog,
    loading: loading || items.loading || languages.loading || options.loading,
    error: error ?? items.error ?? languages.error ?? options.error,
  }
}
