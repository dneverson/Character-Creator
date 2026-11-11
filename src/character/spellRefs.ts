// Saved spells are references (name and source); these keep a list of them tidy.

import type { SpellRef } from './model'

export const refOf = (s: { name: string; source: string; level: number }): SpellRef => ({
  name: s.name,
  source: s.source,
  level: s.level,
})

export const refKey = (r: { name: string; source: string }) =>
  `${r.name}|${r.source}`.toLowerCase()

/** The list without the spell with this key. */
export const without = (list: SpellRef[], key: string) =>
  list.filter((r) => refKey(r) !== key)

/** The list with the spell added, once. */
export const withRef = (list: SpellRef[], ref: SpellRef) =>
  list.some((r) => refKey(r) === refKey(ref)) ? list : [...list, ref]
