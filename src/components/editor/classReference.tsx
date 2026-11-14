// The class reference table's columns and rows: the Class & Level section browses every
// class and subclass with them, and Level up shows the same table to choose a class from.

import type { Column } from '../table/types'
import { hitDieLabel, subclassesFor, type LoadedClass } from '../../data/class'
import { castingLabel, rowEdition, rowSource, upper, type ClassRow } from './classRows'

// The stat columns. The shared browse table places the "Build" action column
// before them. Level up shows the same table to choose a class from.
export const referenceColumns: Column<ClassRow>[] = [
  {
    key: 'name',
    header: 'Class',
    // Each row names the class and its subclass ("Fighter (Champion)"). Kept as
    // a single text node so the class name is not split into its own element.
    render: (r) =>
      r.subclass ? (
        <span>
          <strong>{r.loaded.entry.name}</strong> ({r.subclass.name})
        </span>
      ) : (
        <strong>{r.loaded.entry.name}</strong>
      ),
    sortable: true,
    // Empty second part keeps a bare class row above its own subclasses.
    sortValue: (r) => `${r.loaded.entry.name} ${r.subclass?.name ?? ''}`,
  },
  {
    key: 'hd',
    header: 'Hit Die',
    render: (r) => hitDieLabel(r.loaded.entry),
    sortable: true,
    sortValue: (r) => r.loaded.entry.hd?.faces ?? 0,
    priority: 2,
  },
  {
    key: 'saves',
    header: 'Saves',
    render: (r) => upper(r.loaded.entry.proficiency) || '-',
    priority: 3,
  },
  {
    key: 'casting',
    header: 'Spellcasting',
    render: (r) => castingLabel(r.loaded),
    filterable: true,
    filterValue: (r) => castingLabel(r.loaded),
    priority: 3,
  },
  {
    key: 'source',
    header: 'Source',
    render: (r) => rowSource(r),
    filterable: true,
    filterValue: rowSource,
    priority: 1,
  },
  {
    key: 'edition',
    header: 'Edition',
    render: (r) => rowEdition(r),
    filterable: true,
    filterValue: rowEdition,
    priority: 1,
  },
]

export const searchText = (r: ClassRow) =>
  `${r.loaded.entry.name} ${r.subclass?.name ?? ''} ${rowSource(r)}`

/** A row for each class and subclass of the enabled books. */
export function referenceRows(
  loaded: LoadedClass[],
  selectedBooks: string[],
): ClassRow[] {
  const set = new Set(selectedBooks)
  const out: ClassRow[] = []
  for (const l of loaded) {
    if (!set.has(l.entry.source)) continue
    // Only surface subclasses from books the player has enabled.
    const subs = subclassesFor(l).filter((s) => set.has(s.source))
    if (subs.length === 0) {
      // Fallback: a class with no available subclass still gets one row so it
      // does not disappear from the reference entirely.
      out.push({ loaded: l })
    } else {
      for (const subclass of subs) out.push({ loaded: l, subclass })
    }
  }
  return out
}
