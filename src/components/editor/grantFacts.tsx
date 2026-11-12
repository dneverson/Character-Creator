// The facts every kind of origin (a race, a background) states the same way: what
// it grants, read by grants.ts, and the book and edition it comes from. Each kind
// describes itself with these, so a grant reads the same in every table.

import { grantText, grantValues, type GrantSet } from '../../data/grants'
import { editionYear } from '../../data/labels'
import { Abbr } from '../Abbr'
import { factColumn, NO_VALUE, perEntry, type Fact } from '../table/facts'
import type { Column } from '../table/types'

/** A fact that lists what an entry grants, with what a filter offers for it. */
export interface GrantFact<T> extends Fact<T> {
  values: (entry: T) => string[]
}

export function grantFact<T extends object>(
  key: string,
  label: string,
  read: (entry: T) => GrantSet[],
): GrantFact<T> {
  const sets = perEntry(read)
  const text = perEntry((entry: T) => grantText(sets(entry)))
  return {
    key,
    label,
    text,
    values: (entry) => {
      const values = grantValues(sets(entry))
      return values.length > 0 ? values : [NO_VALUE]
    },
  }
}

/** A column for a grant, filtered by each thing granted. */
export function grantColumn<T>(
  fact: GrantFact<T>,
  extra: Partial<Column<T>> = {},
): Column<T> {
  return factColumn(fact, { filterValue: fact.values, ...extra })
}

/** What every entry of a book has. */
interface FromABook {
  source: string
  edition?: 'classic' | 'one'
}

export const sourceFact: Fact<FromABook> = {
  key: 'source',
  role: 'source',
  label: 'Source',
  text: (entry) => entry.source,
  render: (entry) => <Abbr code={entry.source} kind="source" />,
}

export const editionFact: Fact<FromABook> = {
  key: 'edition',
  role: 'edition',
  label: 'Edition',
  text: (entry) => editionYear(entry.edition),
}
