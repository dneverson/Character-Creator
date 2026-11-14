// Loads what feat resolution needs (classes, race, background, feats) and
// resolves the active character's feat slots and their combined effects, so
// every section that shows ability totals, skills, or hit points agrees.

import { useMemo } from 'react'
import { loadClasses, type LoadedClass } from '../../data/class'
import { findBackground, loadBackgrounds } from '../../data/background'
import { findPlayableRace, loadRaces } from '../../data/race'
import { loadFeats } from '../../data/feats'
import { useCharacter } from '../../character/useCharacterDoc'
import { resolveFeats, type FeatSummary } from '../../character/feats'
import { useAsyncData } from '../../hooks/useAsyncData'

const EMPTY_SUMMARY: FeatSummary = {
  slots: [],
  abilityBonus: {},
  hp: { perLevel: 0, flat: 0 },
  skillSources: [],
}

export function useFeatSummary() {
  const character = useCharacter()
  const classes = useAsyncData(loadClasses)
  const backgrounds = useAsyncData(loadBackgrounds)
  const races = useAsyncData(loadRaces)
  const featData = useAsyncData(loadFeats)

  const classByKey = useMemo(() => {
    const m = new Map<string, LoadedClass>()
    for (const l of classes.data ?? []) m.set(`${l.entry.name}|${l.entry.source}`, l)
    return m
  }, [classes.data])

  const bgRef = character?.background
  const background = useMemo(
    () => findBackground(backgrounds.data, bgRef),
    [backgrounds.data, bgRef],
  )
  const raceRef = character?.race
  const race = useMemo(() => findPlayableRace(races.data, raceRef), [races.data, raceRef])
  const feats = useMemo(() => featData.data ?? [], [featData.data])

  const summary = useMemo(
    () =>
      character
        ? resolveFeats(character, { feats, classByKey, race, background })
        : EMPTY_SUMMARY,
    [character, feats, classByKey, race, background],
  )

  return {
    classByKey,
    background,
    race,
    feats,
    summary,
    loading: classes.loading || backgrounds.loading || races.loading || featData.loading,
    error: classes.error ?? backgrounds.error ?? races.error ?? featData.error,
  }
}
