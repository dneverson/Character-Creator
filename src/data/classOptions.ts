// The optional features a class lets the player choose from (2014): today the fighting
// styles, which the data files as optional features of a feature type ("FS:F" for the
// Fighter, "FS:P" for the Paladin).

import { memoizeContent } from '../content/epoch'
import type { Entry } from '../text/Entries'
import { fetchData } from './dataClient'

export interface ClassOption {
  /** "Defense|PHB": the key a pick is stored by. */
  key: string
  name: string
  source: string
  /** The feature types it is offered under: "FS:F", "FS:R". */
  types: string[]
  /** The book's rules text for the option. */
  entries: Entry[]
}

interface OptionalFeaturesFile {
  optionalfeature: {
    name: string
    source: string
    featureType?: string[]
    entries?: Entry[]
  }[]
}

export const FIGHTING_STYLE_TYPE = 'FS:'

/** Every fighting style of the books. */
export const loadFightingStyleOptions = memoizeContent(
  async (): Promise<ClassOption[]> => {
    const data = await fetchData<OptionalFeaturesFile>('optionalfeatures.json')
    return data.optionalfeature
      .map((o) => ({
        key: `${o.name}|${o.source}`,
        name: o.name,
        source: o.source,
        types: (o.featureType ?? []).filter((t) => t.startsWith(FIGHTING_STYLE_TYPE)),
        entries: o.entries ?? [],
      }))
      .filter((o) => o.types.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name))
  },
)
