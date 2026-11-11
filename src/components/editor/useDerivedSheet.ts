// The derived sheet of the active character: every number worked out once from what the
// character has and the loaded data, for the sections that show them.

import { useMemo } from 'react'
import { useActiveCharacter } from '../../character/store'
import { loadFightingStyleOptions } from '../../data/classOptions'
import { loadItems } from '../../data/items'
import { loadLanguages } from '../../data/languages'
import { deriveSheet } from '../../derived'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useFeatSummary } from './useFeatSummary'

export function useDerivedSheet() {
  const character = useActiveCharacter()
  const { classByKey, background, race, feats, loading, error } = useFeatSummary()
  const items = useAsyncData(loadItems)
  const languages = useAsyncData(loadLanguages)
  const styles = useAsyncData(loadFightingStyleOptions)

  const sheet = useMemo(
    () =>
      character
        ? deriveSheet(character, {
            classByKey,
            background,
            race,
            feats,
            items: items.data ?? undefined,
            languages: languages.data ?? undefined,
            fightingStyles: styles.data ?? undefined,
          })
        : undefined,
    [
      character,
      classByKey,
      background,
      race,
      feats,
      items.data,
      languages.data,
      styles.data,
    ],
  )

  const catalog = useMemo(
    () => ({ languages: languages.data ?? [], items: items.data ?? [] }),
    [languages.data, items.data],
  )

  return {
    sheet,
    catalog,
    loading: loading || items.loading || languages.loading || styles.loading,
    error: error ?? items.error ?? languages.error ?? styles.error,
  }
}
