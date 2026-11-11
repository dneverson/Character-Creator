// Shared by the data audits of the hand-written rules tables: walks the book data in
// `.local/data` (absent on CI and on a fresh checkout, where the audits skip) and finds
// the records whose text matches, by the same address a table row names its holder with.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { stripTags } from '../text/tags'

export const dataDir = existsSync('.local/data/races.json') ? '.local/data' : undefined

const SKIPPED = /fluff|bestiary|generated|adventure|\/book\//

function jsonFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = `${dir}/${e.name}`
    if (e.isDirectory()) return jsonFiles(path)
    return e.name.endsWith('.json') && !SKIPPED.test(path) ? [path] : []
  })
}

export type Rec = Record<string, unknown>

const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v)

/** Every record of every collection of the data, with the collection's name. */
export function records(dir: string): { collection: string; record: Rec }[] {
  const out: { collection: string; record: Rec }[] = []
  // A skipped `describe` still runs its body to collect its tests, so an audit
  // reads the data even where there is none: no data is no records.
  if (!dir) return out
  for (const file of jsonFiles(dir)) {
    const json: unknown = JSON.parse(readFileSync(file, 'utf8'))
    if (!isRec(json)) continue
    for (const [collection, list] of Object.entries(json)) {
      if (!Array.isArray(list)) continue
      for (const record of list) if (isRec(record)) out.push({ collection, record })
    }
  }
  return out
}

/** The address of a record, as `holderId` writes it. */
export function recordId(collection: string, r: Rec): string {
  const base = `${collection}|${String(r.name)}|${String(r.source ?? '')}`
  if (collection === 'classFeature') return `${base}|${String(r.className)}`
  if (collection === 'subclassFeature') {
    return `${base}|${String(r.className)}|${String(r.subclassShortName)}`
  }
  return base
}

/** The plain text of a record: its entries, or the whole record when it has none. */
export const textOf = (r: Rec): string => stripTags(JSON.stringify(r.entries ?? r))

/** The ids of the records of the named collections whose text matches. */
export function findIds(
  dir: string,
  collections: readonly string[],
  matches: (text: string, r: Rec) => boolean,
): Set<string> {
  const found = new Set<string>()
  for (const { collection, record } of records(dir)) {
    if (collections.includes(collection) && matches(textOf(record), record)) {
      found.add(recordId(collection, record))
    }
  }
  return found
}
