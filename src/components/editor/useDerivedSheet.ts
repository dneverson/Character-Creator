// The derived sheet of the active character: every number worked out once from what the
// character has and the loaded data, for the sections that show them.

import { useMemo } from 'react'
import { useCharacter } from '../../character/useCharacterDoc'
import { loadClassOptions } from '../../data/classOptions'
import { loadBookEditions } from '../../data/edition'
import { loadItems } from '../../data/items'
import { loadLanguages } from '../../data/languages'
import { deriveSheet } from '../../derived'
import type { DeriveDeps } from '../../derived/sources'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useFeatSummary } from './useFeatSummary'

export function useDerivedSheet() {
  const character = useCharacter()
  const { classByKey, background, race, feats, loading, error } = useFeatSummary()
  const items = useAsyncData(loadItems)
  const languages = useAsyncData(loadLanguages)
  const options = useAsyncData(loadClassOptions)
  const editions = useAsyncData(loadBookEditions)

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
