// The features and traits a character has, as one flat list: what each class (with its
// subclass) gives up to its level, the traits of the species, the background's feature
// and every feat taken. Each row carries its full text; the sheet's Features & Traits tab
// reads this and groups nothing itself.

import { featuresForClass } from '../data/class'
import type { ClassOption } from '../data/classOptions'
import { holderId } from '../rules/holder'
import type { Entry } from '../text/Entries'
import type { Sources } from './sources'

export type FeatureKind = 'Class' | 'Species' | 'Background' | 'Feat'

export interface FeatureRow {
  /** Unique on the sheet. */
  id: string
  name: string
  /** What gives it: the class, the species, the background, "Feat". */
  from: string
  kind: FeatureKind
  /** The class level it is gained at; absent for the others. */
  level?: number
  entries: Entry[]
  /** Where a limited-use counter finds it (`DerivedResource.anchor`). */
  anchor?: string
  /**
   * The anchors of the features its text takes in by reference, which have no row of their
   * own: PHB Font of Magic holds Sorcery Points, whose counter shows on this row.
   */
  nested?: string[]
}

/** The names of the class and subclass features an entry list takes in by reference. */
function referencedNames(entries: readonly Entry[]): string[] {
  return entries.flatMap((e): string[] => {
    if (typeof e !== 'object' || e === null) return []
    const ref = e as { type?: string; classFeature?: string; subclassFeature?: string }
    const uid =
      ref.type === 'refClassFeature'
        ? ref.classFeature
        : ref.type === 'refSubclassFeature'
          ? ref.subclassFeature
          : undefined
    if (uid) return [uid.split('|')[0]]
    const inner = (e as { entries?: Entry[] }).entries
    return Array.isArray(inner) ? referencedNames(inner) : []
  })
}

interface Named {
  name: string
}

const textOf = (entry: Named & Entry): Entry[] => {
  const inner = (entry as { entries?: Entry[] }).entries
  return inner ?? []
}

/** The entries of a species or background that are a trait or feature of their own, with text. */
const namedEntries = (entries: readonly Entry[] | undefined): (Named & Entry)[] =>
  (entries ?? []).filter(
    (e): e is Named & Entry =>
      typeof e === 'object' &&
      'name' in e &&
      typeof e.name === 'string' &&
      e.name !== '' &&
      textOf(e as Named & Entry).length > 0,
  )

export function featureRows(
  sources: Sources,
  catalog: readonly ClassOption[] = [],
): FeatureRow[] {
  const { classes, race, background, feats } = sources
  const out: FeatureRow[] = []
  for (const { row, loaded, level } of classes) {
    if (!loaded || level < 1) continue
    featuresForClass(loaded, { ...row, level })
      .filter((f) => f.entries.length > 0)
      .forEach((f, i) => {
        const tag = `class:${row.name}|${row.source}`
        const nested = referencedNames(f.entries).map((name) => `${tag}#${name}`)
        out.push({
          id: `${tag}:${f.level}:${i}`,
          name: f.name,
          from: row.name,
          kind: 'Class',
          level: f.level,
          entries: f.entries,
          anchor: `${tag}#${f.name}`,
          ...(nested.length > 0 ? { nested } : {}),
        })
      })
  }
  // The feature taken from a list to choose from (a Totem Spirit, a Divine Order).
  for (const slot of sources.featureSlots) {
    for (const option of slot.options) {
      if (!sources.featureChoices.chosen.has(holderId(option.holder))) continue
      out.push({
        id: `${slot.tag}:${option.ref}`,
        name: `${option.name} (${slot.name})`,
        from: slot.owner.name,
        kind: 'Class',
        level: option.level,
        entries: option.entries,
      })
    }
  }
  // The options taken (an invocation, a maneuver) and those known outright.
  const byKey = new Map(catalog.map((o) => [o.key, o]))
  for (const slot of sources.optionSlots) {
    const keys = [...slot.required, ...(sources.character.classOptions[slot.tag] ?? [])]
    keys.forEach((key, i) => {
      const option = byKey.get(key)
      if (!option) return
      out.push({
        id: `${slot.tag}:${key}:${i}`,
        name: option.name,
        from: `${slot.owner.name} - ${slot.title}`,
        kind: slot.owner.kind === 'feat' ? 'Feat' : 'Class',
        entries: option.entries,
        anchor: `option:${key}`,
      })
    })
  }
  if (race) {
    namedEntries(race.entries).forEach((e, i) =>
      out.push({
        id: `race:${race.key}:${i}`,
        name: e.name,
        from: race.name,
        kind: 'Species',
        entries: textOf(e),
        anchor: `race#${e.name}`,
      }),
    )
  }
  if (background) {
    namedEntries(background.entries)
      // The background's feature is marked by the data; its other entries are not features.
      .filter((e) => (e as { data?: { isFeature?: boolean } }).data?.isFeature === true)
      .forEach((e, i) =>
        out.push({
          id: `background:${background.key}:${i}`,
          // "Feature: Shelter of the Faithful", "Baldur's Gate Feature: Religious Community".
          name: e.name.replace(/^.*?Feature:\s*/, '').trim(),
          from: background.name,
          kind: 'Background',
          entries: textOf(e),
        }),
      )
  }
  for (const { feat, source } of feats) {
    out.push({
      id: source.tag,
      name: feat.label,
      from: 'Feat',
      kind: 'Feat',
      entries: feat.entries,
      anchor: source.tag,
    })
  }
  return out
}
