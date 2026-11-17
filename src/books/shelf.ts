// How the shelf lays the books out: grouped as the catalog groups them, each group's books
// by the date they were published.

import { groupLabel } from '../data/bookLabels'
import type { BookDoc, DocKind } from './types'

export interface ShelfGroup {
  /** The catalog's group code, or '' for a document that has none. */
  group: string
  label: string
  docs: BookDoc[]
}

/**
 * The documents of one kind in groups, the groups in the order the catalog first names
 * them, each group's documents oldest first (the ones without a date last, by name).
 */
export function shelfGroups(docs: readonly BookDoc[], kind: DocKind): ShelfGroup[] {
  const groups = new Map<string, ShelfGroup>()
  for (const doc of docs) {
    if (doc.kind !== kind) continue
    const key = doc.group ?? ''
    const shelf = groups.get(key) ?? {
      group: key,
      label: groupLabel(doc.group) ?? 'Other',
      docs: [],
    }
    groups.set(key, shelf)
    shelf.docs.push(doc)
  }
  const byDate = (a: BookDoc, b: BookDoc) =>
    (a.published ?? '9999').localeCompare(b.published ?? '9999') ||
    a.name.localeCompare(b.name)
  for (const shelf of groups.values()) shelf.docs.sort(byDate)
  return [...groups.values()]
}
