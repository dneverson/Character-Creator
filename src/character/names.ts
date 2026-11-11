// Keeping a character's picks named the way the content in use names them.
//
// A few spells and items go by one name in the books and another in the free
// rules (see src/data/srd.ts). A character built on one and opened on the other
// would point at names the loaded content does not have. `reconcileNames` puts
// that right, going by the loaded content alone:
//   - a pick named as the SRD names it is renamed to the book's name when the
//     content has the entry under the book's name (the character was built on the
//     free rules);
//   - a pick that goes by a book's name is marked with the SRD's name, so it can
//     still be found on the free rules later, in another browser too;
//   - a pick marked that way is renamed to the SRD's name when the content has
//     the entry under that name only (the character is read on the free rules).
// A pick the content does not know at all is left as it is.
//
// The walk covers the whole character, so a pick stored anywhere in it, now or
// in a later version of the model, is covered without being listed here. It goes
// by name and source alone: the entries with two names are spells and items, and
// none of them shares its name and source with an entry of another kind.

import type { Character } from './model'

/** A pick, or an entry of the content: a name within a source. */
export interface ContentName {
  name: string
  source: string
  /** What the SRD calls it, when that is another name. */
  srdName?: string
}

/** The names the loaded content uses. */
export interface NameIndex {
  /** Every entry by source and name, with the SRD's name for it when that differs. */
  srdNames: ReadonlyMap<string, string | undefined>
  /** The book's name of an entry, by source and SRD name. */
  bookNames: ReadonlyMap<string, string>
}

const keyOf = (source: string, name: string) => `${source}|${name}`

export function nameIndex(entries: readonly ContentName[]): NameIndex {
  const srdNames = new Map<string, string | undefined>()
  const bookNames = new Map<string, string>()
  for (const entry of entries) {
    srdNames.set(keyOf(entry.source, entry.name), entry.srdName)
    if (entry.srdName) bookNames.set(keyOf(entry.source, entry.srdName), entry.name)
  }
  return { srdNames, bookNames }
}

function isContentName(value: object): value is ContentName {
  return (
    'name' in value &&
    typeof value.name === 'string' &&
    'source' in value &&
    typeof value.source === 'string' &&
    (!('srdName' in value) ||
      value.srdName === undefined ||
      typeof value.srdName === 'string')
  )
}

/** One pick, named as the content names it. The same object when nothing changes. */
function reconciled<T extends ContentName>(pick: T, index: NameIndex): T {
  const key = keyOf(pick.source, pick.name)
  if (index.srdNames.has(key)) {
    const srdName = index.srdNames.get(key)
    if (srdName === pick.srdName) return pick
    const next = { ...pick, srdName }
    if (srdName === undefined) delete next.srdName
    return next
  }
  const bookName = index.bookNames.get(key)
  if (bookName !== undefined) return { ...pick, name: bookName, srdName: pick.name }
  if (
    pick.srdName !== undefined &&
    index.srdNames.has(keyOf(pick.source, pick.srdName))
  ) {
    const next = { ...pick, name: pick.srdName }
    delete next.srdName
    return next
  }
  return pick
}

/** Reconcile every pick inside a value. The same value when nothing changes. */
function walk<T>(value: T, index: NameIndex): T {
  if (Array.isArray(value)) {
    const next = value.map((item: unknown) => walk(item, index))
    return next.some((item, at) => item !== value[at]) ? (next as T) : value
  }
  if (typeof value !== 'object' || value === null) return value
  let whole: T & object = value
  for (const [key, item] of Object.entries(value)) {
    const next: unknown = walk(item, index)
    if (next !== item) whole = { ...whole, [key]: next }
  }
  return isContentName(whole) ? reconciled(whole, index) : whole
}

/**
 * The character with its picks named as the loaded content names them. Returns
 * the character itself when every pick already is. The history is left as it
 * is: it says what was done, under the names of the time.
 */
export function reconcileNames(character: Character, index: NameIndex): Character {
  const { history, ...picks } = character
  const named = walk(picks, index)
  return named === picks ? character : { ...named, history }
}
