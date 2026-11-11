// Shared, dataset-specific helpers for the class/subclass table rows. Kept free
// of JSX so the browser table, the compare modal, the build tray and the merged
// Class & Level section all read from one row model (DRY). Anything that renders
// (columns, detail panes) stays in the components that own the JSX.

import type { LoadedClass, SubclassEntry } from '../../data/class'
import { editionYear } from '../../data/labels'

/**
 * A single browsable row: either a base class (no `subclass`) or one of its
 * subclass variants. Subclasses inherit the parent class's hit die, saves and
 * spellcasting, so those always read from `loaded.entry`.
 */
export interface ClassRow {
  loaded: LoadedClass
  subclass?: SubclassEntry
}

/** Stable, unique row identity (also the table's selection/focus id). */
export const rowKey = (r: ClassRow) =>
  r.subclass
    ? `${r.loaded.entry.name}|${r.loaded.entry.source}|${r.subclass.shortName}|${r.subclass.source}`
    : `${r.loaded.entry.name}|${r.loaded.entry.source}`

// Origin of the row: a subclass row reports the book the subclass ships in.
export const rowSource = (r: ClassRow) => r.subclass?.source ?? r.loaded.entry.source

export const rowEdition = (r: ClassRow) =>
  editionYear(r.subclass?.edition ?? r.loaded.entry.edition)

export const editionLabel = (l: LoadedClass) => editionYear(l.entry.edition)

export const upper = (parts?: string[]) =>
  (parts ?? []).map((p) => p.toUpperCase()).join(', ')

// A player-friendly label for the raw casterProgression codes in the data.
const CASTER_LABEL: Record<string, string> = {
  full: 'Full caster',
  '1/2': 'Half caster',
  '1/3': 'Third caster',
  artificer: 'Artificer',
  pact: 'Pact magic',
}

export function castingLabel(l: LoadedClass): string {
  const prog = l.entry.casterProgression
  if (!prog) return 'Non-caster'
  return CASTER_LABEL[prog] ?? prog
}

/** Spellcasting label with the casting ability appended, e.g. "Full caster (INT)". */
export function castingWithAbility(l: LoadedClass): string {
  const base = castingLabel(l)
  return l.entry.spellcastingAbility
    ? `${base} (${l.entry.spellcastingAbility.toUpperCase()})`
    : base
}
