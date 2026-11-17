// How a book's catalog fields read to a person: its group and a chapter's number.
// Shared by the book list in the editor and the book reader.

import type { BookContentEntry } from './types'

// 5etools `group` codes decoded to plain labels (tooltip-helpers rule: never show
// raw shorthand). Unknown codes fall back to a title-cased form of the code itself.
export const GROUP_LABELS: Record<string, string> = {
  core: 'Core rulebook',
  screen: 'DM screen',
  setting: 'Campaign setting',
  'setting-alt': 'Campaign setting (alternate)',
  'organized-play': 'Organized play',
  supplement: 'Supplement',
  'supplement-alt': 'Supplement (alternate)',
  recipe: 'Cookbook',
  homecraft: 'Homecraft',
  other: 'Other',
}

export function groupLabel(group: string | undefined): string | null {
  if (!group) return null
  return (
    GROUP_LABELS[group] ??
    group.replace(/(^|[-\s])([a-z])/g, (_, sep, c) => sep + c.toUpperCase())
  )
}

// A table-of-contents entry's chapter/appendix prefix, e.g. "Chapter 2" or
// "Appendix A". Front matter (no ordinal) has none.
export function ordinalLabel(entry: BookContentEntry): string | null {
  const ordinal = entry.ordinal
  if (!ordinal) return null
  const kind = ordinal.type === 'appendix' ? 'Appendix' : 'Chapter'
  return ordinal.identifier === undefined ? kind : `${kind} ${ordinal.identifier}`
}
