// The features and traits a character has, as one flat list: what each class (with its
// subclass) gives up to its level, the traits of the species, the background's feature
// and every feat taken. Each row carries its full text; the sheet's Features & Traits tab
// reads this and groups nothing itself.

import { featuresForClass } from '../data/class'
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

export function featureRows({ classes, race, background, feats }: Sources): FeatureRow[] {
  const out: FeatureRow[] = []
  for (const { row, loaded, level } of classes) {
    if (!loaded || level < 1) continue
    featuresForClass(loaded, { ...row, level })
      .filter((f) => f.entries.length > 0)
      .forEach((f, i) =>
        out.push({
          id: `class:${row.name}|${row.source}:${f.level}:${i}`,
          name: f.name,
          from: row.name,
          kind: 'Class',
          level: f.level,
          entries: f.entries,
        }),
      )
  }
  if (race) {
    namedEntries(race.entries).forEach((e, i) =>
      out.push({
        id: `race:${race.key}:${i}`,
        name: e.name,
        from: race.name,
        kind: 'Species',
        entries: textOf(e),
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
    })
  }
  return out
}
