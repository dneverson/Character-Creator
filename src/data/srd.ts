// What the System Reference Documents call an entry.
//
// The SRD names a few spells and items differently from the books. The free
// rules this site hosts use the SRD's names; the full content uses the books'
// names and marks such an entry with the SRD's name (the value of its `srd` or
// `srd52` mark, which is plainly `true` when both names are the same).

import { freeRulesLicense } from '../config/content'

const FLAGS = freeRulesLicense.documents.map((document) => document.flag)

/** The name the SRD gives an entry, when that is not the entry's own name. */
export function srdNameOf(entry: object): string | undefined {
  for (const flag of FLAGS) {
    const value: unknown = Reflect.get(entry, flag)
    if (typeof value === 'string') return value
  }
  return undefined
}

/** Whether one of the System Reference Documents the site hosts prints the entry. */
export function inFreeRules(entry: object): boolean {
  return FLAGS.some((flag) => {
    const value: unknown = Reflect.get(entry, flag)
    return value !== undefined && value !== false
  })
}
