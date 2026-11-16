// The features and traits a character has, as one flat list: what each class (with its
// subclass) gives up to its level, the traits of the species, the background's feature
// and every feat taken. Each row carries its full text; the sheet's Features & Traits tab
// reads this and groups nothing itself.

import { featuresForClass } from '../data/class'
import type { ClassOption } from '../data/classOptions'
import type { Item } from '../data/itemTypes'
import { holderId } from '../rules/holder'
import { featureWithheld, heldEntries } from './classOptions'
import { takenFeaturePicks } from './featurePicks'
import type { Entry } from '../text/Entries'
import type { Sources } from './sources'
import type { AbilityTotals } from './armorClass'
import { heldOptionEffects, optionRowLines } from './optionEffects'
import type { Line } from './types'

export type FeatureKind = 'Class' | 'Species' | 'Background' | 'Feat' | 'Reward'

export interface FeatureRow {
  /** Unique on the sheet. */
  id: string
  name: string
  /** What gives it: the class, the species, the background, "Feat". */
  from: string
  kind: FeatureKind
  /** The class level it is gained at; absent for the others. */
  level?: number
  /** A feature of the chosen subclass, not of the class itself. */
  ofSubclass?: true
  entries: Entry[]
  /** Where a limited-use counter finds it (`DerivedResource.anchor`). */
  anchor?: string
  /**
   * The anchors of the features its text takes in by reference, which have no row of their
   * own: PHB Font of Magic holds Sorcery Points, whose counter shows on this row.
   */
  nested?: string[]
  /**
   * What the feature does to the numbers of the sheet, and where, as lines: an option's
   * bonus to a cantrip's damage, the item its infusion is in, a maneuver's superiority die.
   */
  lines?: Line[]
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
  items: readonly Item[] = [],
  totals?: AbilityTotals,
): FeatureRow[] {
  const { classes, race, background, feats } = sources
  const out: FeatureRow[] = []
  // An optional class feature not taken, or the feature it replaced, is not had.
  const withheld = (id: string) => featureWithheld(sources.featureChoices, id)
  for (const { row, loaded, level } of classes) {
    if (!loaded || level < 1) continue
    featuresForClass(loaded, { ...row, level })
      .filter((f) => f.entries.length > 0 && !(f.id && withheld(f.id)))
      .forEach((f, i) => {
        const tag = `class:${row.name}|${row.source}`
        const entries = heldEntries(f.entries, withheld)
        const nested = referencedNames(entries).map((name) => `${tag}#${name}`)
        out.push({
          id: `${tag}:${f.level}:${i}`,
          name: f.name,
          from: row.name,
          kind: 'Class',
          level: f.level,
          ...(f.id?.startsWith('subclassFeature|') ? { ofSubclass: true as const } : {}),
          entries,
          anchor: `${tag}#${f.name}`,
          ...(nested.length > 0 ? { nested } : {}),
        })
      })
  }
  // The feature taken from a list to choose from (a Totem Spirit, a Divine Order). Its
  // anchor is the one its counters take: the class's tag and the feature's own name.
  for (const slot of sources.featureSlots) {
    // The features of an optional class feature's choice are rows of the class already.
    if (slot.variant) continue
    for (const option of slot.options) {
      if (!sources.featureChoices.chosen.has(holderId(option.holder))) continue
      out.push({
        id: `${slot.tag}:${option.ref}`,
        name: `${option.name} (${slot.name})`,
        from: slot.owner.name,
        kind: 'Class',
        level: option.level,
        entries: option.entries,
        anchor: `${slot.owner.tag}#${option.name}`,
      })
    }
  }
  // What was taken of a feature's own list (favored enemies, favored terrains).
  for (const { held, taken } of takenFeaturePicks(sources, { catalog, items })) {
    if (taken.length === 0) continue
    out.push({
      id: held.tag,
      name: `${held.pick.title}: ${taken.map((o) => o.name).join(', ')}`,
      from: held.source.label,
      kind: 'Class',
      entries: taken.map((o) => `${o.name}: ${o.text}`),
    })
  }
  // The options taken (an invocation, a maneuver) and those known outright.
  const byKey = new Map(catalog.map((o) => [o.key, o]))
  const effects = heldOptionEffects(sources)
  for (const slot of sources.optionSlots) {
    const keys = [...slot.required, ...(sources.character.classOptions[slot.tag] ?? [])]
    keys.forEach((key, i) => {
      const option = byKey.get(key)
      if (!option) return
      const lines = totals ? optionRowLines(sources, option, totals, effects) : []
      out.push({
        id: `${slot.tag}:${key}:${i}`,
        name: option.name,
        from: `${slot.owner.name} - ${slot.title}`,
        kind: slot.owner.kind === 'feat' ? 'Feat' : 'Class',
        entries: option.entries,
        anchor: `option:${key}`,
        ...(lines.length > 0 ? { lines } : {}),
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
          anchor: `background#${e.name}`,
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
  for (const { reward, source } of sources.rewards)
    out.push({
      id: source.tag,
      name: reward.name,
      from: reward.type,
      kind: 'Reward',
      entries: reward.entries,
      anchor: source.tag,
    })
  return out
}
