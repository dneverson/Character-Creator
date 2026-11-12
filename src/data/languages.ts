// The languages of the books, for the picks a source lets the player make.

import { memoizeContent } from '../content/epoch'
import { fetchData } from './dataClient'

export interface Language {
  name: string
  /** How each book that prints it types it: standard, exotic, rare or secret. */
  entries: { source: string; type: string }[]
  /** The script it is written in, when the data gives one. */
  script?: string
  /** Who typically speaks it, as the data words it (tags still in). */
  speakers?: string[]
}

interface LanguagesFile {
  language: {
    name: string
    source: string
    type?: string
    script?: string
    typicalSpeakers?: string[]
  }[]
}

/** Every language once, by name (a language printed in two editions is one). */
export const loadLanguages = memoizeContent(async (): Promise<Language[]> => {
  const data = await fetchData<LanguagesFile>('languages.json')
  const byName = new Map<string, Language>()
  for (const row of data.language) {
    const key = row.name.toLowerCase()
    const found = byName.get(key) ?? { name: row.name, entries: [], speakers: [] }
    found.script ??= row.script
    const speakers = (found.speakers ??= [])
    for (const speaker of row.typicalSpeakers ?? [])
      if (!speakers.includes(speaker)) speakers.push(speaker)
    const type = row.type ?? 'standard'
    if (!found.entries.some((e) => e.source === row.source && e.type === type)) {
      found.entries.push({ source: row.source, type })
    }
    byName.set(key, found)
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
})
