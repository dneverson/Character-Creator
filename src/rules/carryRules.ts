// Which items work while only carried. A magic item meant to be worn or wielded works only
// when worn or wielded (DMG 2014, chapter 7, "Wearing and Wielding Items"); an item whose
// own text says it works while it is on your person, or while you carry it, works from the
// pack too (Stone of Good Luck). The data has no field for this, so the rule reads the
// item's text; the audit in carryRules.test.ts holds every such text to it.

import type { ItemKind } from '../data/itemTypes'
import { stripTags } from '../text/tags'

/** The words of an item that make it work while carried. */
export const WORKS_CARRIED =
  /while (?:(?:this|these|the) [^.,]{1,40}? (?:is|are) on your person|it(?: is|'s) on your person|on your person)|(?:if|as long as|provided that) (?:it|the [^.,]{1,30}?) is on your person|while (?:you are )?carrying (?:it|the|this)|while you carry (?:it|the|this)|while you have (?:the|this) [^.,]{1,30}? in your possession/i

/** Armor, shields and weapons are worn or wielded to work, whatever else they do. */
const WORN_OR_WIELDED: ReadonlySet<ItemKind> = new Set(['armor', 'shield', 'weapon'])

/** Whether an item of this kind and text works while carried, without being equipped. */
export function worksWhileCarried(kind: ItemKind, entries: unknown): boolean {
  return (
    !WORN_OR_WIELDED.has(kind) && WORKS_CARRIED.test(stripTags(JSON.stringify(entries)))
  )
}
