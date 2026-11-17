// What a stat block of a book's text stands for. The text only names it: a creature, an
// item, a spell, a race... that the lookup holds (`tag`), or the description a book keeps
// for one (`prop`, "monsterFluff"). The reader draws the first through the lookup's own
// description of that kind, and the second from the description files, so a stat block
// is never written out a second time.

import { resolveCopy, type Copyable } from '../data/copy'
import { fetchData } from '../data/dataClient'
import { referenceOf, REFERENCE_TAGS, type Reference } from '../lookup/references'
import type { LookupRow } from '../lookup/types'
import type { Entry } from '../text/Entries'
import type { StatblockEntry } from '../text/entryContext'

/** Where a kind of description is kept: the file, or the index that names it by source. */
interface FluffFile {
  /** A file that holds them all. */
  file?: string
  /** An index from a source (or a class) to the file that holds its descriptions. */
  index?: string
  /** The folder the index's files are in. */
  folder?: string
  list: string
}

/** The kinds of description a stat block of a book may carry. */
const FLUFF: Readonly<Record<string, FluffFile>> = {
  monsterFluff: {
    index: 'bestiary/fluff-index.json',
    folder: 'bestiary/',
    list: 'monsterFluff',
  },
  raceFluff: { file: 'fluff-races.json', list: 'raceFluff' },
  recipeFluff: { file: 'fluff-recipes.json', list: 'recipeFluff' },
  classFluff: { index: 'class/fluff-index.json', folder: 'class/', list: 'classFluff' },
  crochetPatternFluff: { file: 'fluff-homecrafts.json', list: 'crochetPatternFluff' },
}

/** Whether the books print this kind of looked-up entry in a layout of its own. */
export const hasPrinted = (row: LookupRow): boolean =>
  ['creature', 'spell', 'item'].includes(row.subject.type)

/** What a stat block asks for. */
export type Target =
  | { kind: 'lookup'; reference: Reference }
  | { kind: 'fluff'; prop: string; name: string; source: string | undefined }
  | { kind: 'table'; name: string; source: string | undefined }
  | { kind: 'crochet'; name: string; source: string | undefined }
  | { kind: 'none' }

/** A description of the data: the entries and pictures a book prints for something. */
export interface Fluff extends Copyable {
  entries?: Entry[]
  images?: Entry[]
}

/** The reference of a stat block that is a tag, or a subclass given by its class. */
function referenceFor(entry: StatblockEntry, tag: string): Reference | undefined {
  const name = entry.name ?? ''
  const source = entry.source ?? ''
  if (tag === 'subclass')
    return referenceOf(
      tag,
      [
        entry.shortName ?? name,
        entry.className ?? '',
        entry.classSource ?? '',
        source,
      ].join('|'),
    )
  if (tag === 'deity')
    return referenceOf(tag, [name, entry.pantheon ?? '', source].join('|'))
  return referenceOf(tag, [name, source].join('|'))
}

/** What a stat block stands for: a lookup entry, a description, or nothing known. */
export function targetOf(entry: StatblockEntry): Target {
  const name = entry.name ?? ''
  if (!name) return { kind: 'none' }
  const tag = entry.tag ?? (entry.prop === 'subclass' ? 'subclass' : undefined)
  // The tables of the books are all in one file, which is read for them.
  if (tag === 'table') return { kind: 'table', name, source: entry.source }
  if (tag === 'crochet') return { kind: 'crochet', name, source: entry.source }
  if (tag && REFERENCE_TAGS[tag]) {
    const reference = referenceFor(entry, tag)
    return reference ? { kind: 'lookup', reference } : { kind: 'none' }
  }
  if (entry.prop && FLUFF[entry.prop])
    return { kind: 'fluff', prop: entry.prop, name, source: entry.source }
  return { kind: 'none' }
}

/** The descriptions of a list that a file holds. */
async function listOf(spec: FluffFile, path: string): Promise<Fluff[]> {
  const file = await fetchData<Record<string, Fluff[]>>(path).catch(() => ({}))
  return (file as Record<string, Fluff[] | undefined>)[spec.list] ?? []
}

/** The file of descriptions a source (or a class name) has, when the kind has an index. */
async function pathFor(spec: FluffFile, key: string): Promise<string | undefined> {
  if (spec.file) return spec.file
  const index = await fetchData<Record<string, string>>(spec.index ?? '').catch(
    (): Record<string, string> => ({}),
  )
  // The text spells a book in another case now and then ("mtf"); the index has "MTF".
  const lower = key.toLowerCase().replace(/\s+/g, '')
  const name =
    index[key] ?? Object.entries(index).find(([k]) => k.toLowerCase() === lower)?.[1]
  return name ? `${spec.folder ?? ''}${name}` : undefined
}

/** The description of one entity, with the one it copies (and its changes) worked in. */
export async function loadFluff(
  prop: string,
  name: string,
  source: string | undefined,
): Promise<Fluff | undefined> {
  const spec = FLUFF[prop]
  if (!spec) return undefined
  const keyOf = (n: string, s: string | undefined) =>
    prop === 'classFluff' ? n : (s ?? n)
  const find = async (n: string, s: string | undefined) => {
    const path = await pathFor(spec, keyOf(n, s))
    const list = path ? await listOf(spec, path) : []
    // The data spells a name or a book in another case now and then ("mtf", "MTF").
    const same = (a: string, b: string | undefined) =>
      a.toLowerCase() === b?.toLowerCase()
    return list.find(
      (item) => same(item.name, n) && (s === undefined || same(item.source, s)),
    )
  }
  const found = await find(name, source)
  if (!found) return undefined
  // A copy names its original, which may be in another book's file: read what it needs.
  const originals = new Map<string, Fluff>()
  const gather = async (item: Fluff): Promise<void> => {
    const from = item._copy
    if (!from) return
    const original = await find(from.name, from.source)
    if (!original) return
    originals.set(`${from.name}|${from.source}`, original)
    await gather(original)
  }
  await gather(found)
  return resolveCopy(found, (n, s) => originals.get(`${n}|${s}`))
}

/**
 * The tables (and groups of tables) of every book, read for the stat blocks that name one:
 * the ones the books print in their text, then the ones a book keeps on their own (the
 * art objects of Plane Shift: Ixalan).
 */
const TABLES = ['generated/gendata-tables.json', 'tables.json']

/** A table of the books by its name, as the entry the text would hold. */
export async function loadTable(
  name: string,
  source: string | undefined,
): Promise<Entry | undefined> {
  const files = await Promise.all(
    TABLES.map((path) =>
      fetchData<Record<string, Entry[]>>(path).catch((): Record<string, Entry[]> => ({})),
    ),
  )
  const same = (a: unknown, b: string | undefined) =>
    typeof a === 'string' && a.toLowerCase() === b?.toLowerCase()
  return files
    .flatMap((file) => [...(file.table ?? []), ...(file.tableGroup ?? [])])
    .find((table) => {
      const named = table as { name?: unknown; source?: unknown }
      return (
        same(named.name, name) && (source === undefined || same(named.source, source))
      )
    })
}
