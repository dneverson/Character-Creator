// The single source of truth for editing a character's class build.
// Both the build tray and the reference table drive their mutations
// through this hook so there is exactly one implementation of "add a class",
// "set its level", "choose a subclass" and "remove it" (DRY).
//
// Multiclass identity is the class itself (name|source): a character holds at
// most one entry per class, so adding a subclass for a class already in the
// build updates that entry rather than duplicating it.
//
// Subclass timing: a chosen subclass is ALWAYS kept once picked, even if
// the class level later drops below the subclass unlock level. The subclass is
// "planned" and simply does not contribute features until the class reaches its
// unlock level - feature resolution is already level-gated, so nothing leaks in
// early. This is the deliberate reversal of the earlier "clear on downlevel"
// behaviour.

import { useCallback, useMemo } from 'react'
import {
  loadClasses,
  multiclassRequirements,
  subclassesFor,
  subclassUnlockLevel,
  type LoadedClass,
  type MulticlassRequirements,
  type SubclassEntry,
} from '../../data/class'
import type { ClassRef } from '../../character/model'
import { useActiveCharacter, useCharacterStore } from '../../character/store'
import { classEntryScores } from '../../character/feats'
import { unassignedAbilities } from '../../character/stats'
import { checkLevelCap, checkMulticlass, type Deviation } from '../../rules/compliance'
import { useAsyncData } from '../../hooks/useAsyncData'
import type { ClassRow } from './classRows'
import { useFeatSummary } from './useFeatSummary'

export const classKey = (name: string, source: string) => `${name}|${source}`

export interface ClassBuild {
  loading: boolean
  error: Error | null
  loaded: LoadedClass[] | null
  /** Classes scoped to the character's enabled books. */
  available: LoadedClass[]
  /** Lookup from `classKey` to the loaded class. */
  byKey: Map<string, LoadedClass>
  /** The character's current build (empty array when none). */
  classes: ClassRef[]
  totalLevel: number
  /** Multiclass prerequisite deviations, keyed by `multiclass-req:<classKey>`. */
  deviationByKey: Map<string, Deviation>
  /** Total-level-cap deviations. */
  levelDeviations: Deviation[]
  /** Whether a browse row's class is already part of the build. */
  isInBuild: (row: ClassRow) => boolean
  /** Add a class (and its subclass, if the row carries one) to the build. */
  addEntry: (row: ClassRow) => void
  /** Set a class entry's level (never clears the planned subclass). */
  setLevel: (index: number, level: number) => void
  /** Choose or clear a class entry's subclass by `shortName|source` (''=clear). */
  setSubclass: (index: number, value: string) => void
  /** Remove a class entry from the build. */
  removeEntry: (index: number) => void
}

export function useClassBuild(): ClassBuild {
  const character = useActiveCharacter()
  const updateActive = useCharacterStore((s) => s.updateActive)
  const { data: loaded, error, loading } = useAsyncData(loadClasses)
  // Multiclass prerequisites use the scores each class was taken with, the feat
  // increases gained before it included. Feat data loading or failing only leaves
  // those increases out; the class build itself does not depend on it.
  const featSummary = useFeatSummary().summary

  const selectedBooks = character?.selectedBooks
  const available = useMemo(() => {
    if (!loaded || !selectedBooks) return []
    const set = new Set(selectedBooks)
    return loaded.filter((l) => set.has(l.entry.source))
  }, [loaded, selectedBooks])

  const byKey = useMemo(() => {
    const m = new Map<string, LoadedClass>()
    for (const l of available) m.set(classKey(l.entry.name, l.entry.source), l)
    return m
  }, [available])

  const requirementsBySource = useMemo(() => {
    const m = new Map<string, MulticlassRequirements | undefined>()
    for (const l of available) {
      m.set(classKey(l.entry.name, l.entry.source), multiclassRequirements(l.entry))
    }
    return m
  }, [available])

  // Stable identity so the mutation callbacks below only change when the build
  // actually changes (the `?? []` would otherwise be a new array every render).
  const classes = useMemo(() => character?.classes ?? [], [character?.classes])

  const setClasses = useCallback(
    (next: ClassRef[]) => updateActive({ classes: next }),
    [updateActive],
  )

  const addEntry = useCallback(
    (row: ClassRow) => {
      const name = row.loaded.entry.name
      const source = row.loaded.entry.source
      const key = classKey(name, source)
      const subclass = row.subclass
        ? {
            name: row.subclass.name,
            shortName: row.subclass.shortName,
            source: row.subclass.source,
          }
        : undefined
      const existing = classes.findIndex((c) => classKey(c.name, c.source) === key)
      if (existing >= 0) {
        // Class already in the build: adopt the row's subclass if it names one,
        // otherwise leave the entry untouched (a bare-class row is a no-op).
        if (!subclass) return
        setClasses(classes.map((c, i) => (i === existing ? { ...c, subclass } : c)))
        return
      }
      setClasses([...classes, { name, source, level: 1, subclass }])
    },
    [classes, setClasses],
  )

  const setLevel = useCallback(
    (index: number, level: number) => {
      const nextLevel = Math.max(1, level || 1)
      // The planned subclass is kept regardless of level; features stay gated.
      setClasses(classes.map((c, i) => (i === index ? { ...c, level: nextLevel } : c)))
    },
    [classes, setClasses],
  )

  const setSubclass = useCallback(
    (index: number, value: string) => {
      const cls = classes[index]
      if (!cls) return
      const loadedClass = byKey.get(classKey(cls.name, cls.source))
      const sub = loadedClass
        ? subclassesForEnabled(loadedClass, selectedBooks).find(
            (s) => `${s.shortName}|${s.source}` === value,
          )
        : undefined
      setClasses(
        classes.map((c, i) =>
          i === index
            ? {
                ...c,
                subclass: sub
                  ? { name: sub.name, shortName: sub.shortName, source: sub.source }
                  : undefined,
              }
            : c,
        ),
      )
    },
    [classes, byKey, selectedBooks, setClasses],
  )

  const removeEntry = useCallback(
    (index: number) => setClasses(classes.filter((_, i) => i !== index)),
    [classes, setClasses],
  )

  const isInBuild = useCallback(
    (row: ClassRow) => {
      const key = classKey(row.loaded.entry.name, row.loaded.entry.source)
      return classes.some((c) => classKey(c.name, c.source) === key)
    },
    [classes],
  )

  const totalLevel = classes.reduce((sum, c) => sum + (c.level || 0), 0)

  const { deviationByKey, levelDeviations } = useMemo(() => {
    if (!character) {
      return { deviationByKey: new Map<string, Deviation>(), levelDeviations: [] }
    }
    const entries = classEntryScores(character, featSummary)
    const unset = unassignedAbilities(character.abilities, character.statMethod)
    const mc = checkMulticlass(classes, requirementsBySource, entries, unset)
    return {
      deviationByKey: new Map(mc.map((d) => [d.id, d])),
      levelDeviations: checkLevelCap(totalLevel),
    }
  }, [character, classes, requirementsBySource, totalLevel, featSummary])

  return {
    loading,
    error,
    loaded,
    available,
    byKey,
    classes,
    totalLevel,
    deviationByKey,
    levelDeviations,
    isInBuild,
    addEntry,
    setLevel,
    setSubclass,
    removeEntry,
  }
}

// The subclasses of a class that come from the character's enabled books.
// Mirrors the row scoping in the reference table.
function subclassesForEnabled(
  loaded: LoadedClass,
  selectedBooks: string[] | undefined,
): SubclassEntry[] {
  const set = new Set(selectedBooks ?? [])
  return subclassesFor(loaded).filter((s) => set.has(s.source))
}

export { subclassUnlockLevel }
