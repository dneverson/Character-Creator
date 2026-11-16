// How Quick lookup describes a row. An entry of a kind that has a dataset of its own (a
// spell, an item, a race...) is described by that dataset's own description, handed its
// own entry; this only passes each row's entry on. The kinds without a dataset share one
// description: their facts, their book and their text. So the detail pane and the compare
// window say exactly what they say everywhere else.

import { Abbr } from '../Abbr'
import { Entries } from '../../text/Entries'
import { editionYear } from '../../data/labels'
import {
  KIND_LABELS,
  type LookupRow,
  type Subject,
  type TextSubject,
} from '../../lookup/types'
import type { Snippet } from '../../lookup/search'
import { describeBeasts } from '../editor/beastFacts'
import { classNames } from '../editor/spellFacts'
import { describeBackgrounds } from '../editor/backgroundFacts'
import { describeFeats } from '../editor/featFacts'
import { editionFact, sourceFact } from '../editor/grantFacts'
import { describeItems } from '../editor/itemFacts'
import { describeRaces } from '../editor/raceFacts'
import { describeRewards } from '../editor/rewardFacts'
import { describeSpells } from '../editor/spellFacts'
import { colTitle, describeClasses } from '../editor/classViewShared'
import {
  factColumn,
  NO_VALUE,
  type Describe,
  type Fact,
  type FactGroup,
} from '../table/facts'
import type { Column } from '../table/types'

/** The groups of a dataset's description, asking each row for its own entry. */
function adapt<S extends object>(
  rows: LookupRow[],
  type: Subject['type'],
  pick: (subject: Subject) => S | undefined,
  describe: Describe<S>,
): FactGroup<LookupRow>[] {
  const own = new Map<LookupRow, S>()
  for (const row of rows) {
    const entry = pick(row.subject)
    if (entry) own.set(row, entry)
  }
  if (own.size === 0) return []
  const entryOf = (row: LookupRow) => own.get(row)
  return describe([...own.values()]).map((group) => ({
    key: `${type}-${group.key}`,
    title: group.title,
    empty: group.empty,
    ...(group.entryTitle && {
      entryTitle: (row: LookupRow) => {
        const entry = entryOf(row)
        return entry ? (group.entryTitle?.(entry) ?? '') : ''
      },
    }),
    facts: group.facts.map((fact): Fact<LookupRow> => ({
      key: fact.key,
      label: fact.label,
      role: fact.role,
      text: (row) => {
        const entry = entryOf(row)
        return entry ? fact.text(entry) : ''
      },
      ...(fact.render && {
        render: (row: LookupRow) => {
          const entry = entryOf(row)
          return entry && fact.render ? fact.render(entry) : null
        },
      }),
    })),
  }))
}

const page: Fact<TextSubject> = {
  key: 'page',
  role: 'page',
  label: 'Page',
  text: (entry) => (entry.page ? `p. ${entry.page}` : ''),
}

const description: Fact<TextSubject> = {
  key: 'description',
  role: 'body',
  label: 'Description',
  text: (entry) => (entry.entries.length > 0 ? JSON.stringify(entry.entries) : ''),
  render: (entry) => <Entries entries={entry.entries} />,
}

/** The kinds of entry that have no dataset: the labelled facts any of them has, then the text. */
const describeText: Describe<TextSubject> = (entries) => {
  const labels = [...new Set(entries.flatMap((e) => e.facts.map((f) => f.label)))]
  const facts: Fact<TextSubject>[] = labels.map((label) => ({
    key: label,
    label,
    text: (entry) => entry.facts.find((f) => f.label === label)?.value ?? '',
  }))
  return [
    { key: 'basics', title: 'Basics', facts: [...facts, sourceFact, editionFact, page] },
    { key: 'text', title: 'Text', facts: [description] },
  ]
}

/** The description of any rows of Quick lookup, kind by kind. */
export const describeLookup: Describe<LookupRow> = (rows) => [
  ...adapt(
    rows,
    'spell',
    (s) => (s.type === 'spell' ? s.value : undefined),
    describeSpells,
  ),
  ...adapt(rows, 'item', (s) => (s.type === 'item' ? s.value : undefined), describeItems),
  ...adapt(rows, 'race', (s) => (s.type === 'race' ? s.value : undefined), describeRaces),
  ...adapt(
    rows,
    'background',
    (s) => (s.type === 'background' ? s.value : undefined),
    describeBackgrounds,
  ),
  ...adapt(rows, 'feat', (s) => (s.type === 'feat' ? s.value : undefined), describeFeats),
  ...adapt(
    rows,
    'reward',
    (s) => (s.type === 'reward' ? s.value : undefined),
    describeRewards,
  ),
  ...adapt(
    rows,
    'class',
    (s) => (s.type === 'class' ? s.value : undefined),
    describeClasses,
  ),
  ...adapt(
    rows,
    'creature',
    (s) => (s.type === 'creature' ? s.value : undefined),
    describeBeasts,
  ),
  ...adapt(rows, 'text', (s) => (s.type === 'text' ? s.value : undefined), describeText),
]

/** A row's name as its detail and compare column head it. */
export const lookupTitle = (row: LookupRow): string =>
  row.subject.type === 'class' ? colTitle(row.subject.value) : row.name

/** What rides with the name: the kind of entry and its edition. */
export const lookupTags = (row: LookupRow): string[] => [
  KIND_LABELS[row.kind],
  editionYear(row.edition),
]

const spellClasses = (row: LookupRow): string[] =>
  row.subject.type === 'spell' ? classNames(row.subject.value) : []

/** The columns of the results, given the snippet each text match is shown with. */
export function lookupColumns(
  snippets: ReadonlyMap<string, Snippet>,
): Column<LookupRow>[] {
  const kind: Fact<LookupRow> = {
    key: 'kind',
    label: 'Kind',
    text: (row) => KIND_LABELS[row.kind],
  }
  const source: Fact<LookupRow> = {
    key: 'source',
    label: 'Source',
    text: (row) => row.source,
    render: (row) => <Abbr code={row.source} kind="source" />,
  }
  const edition: Fact<LookupRow> = {
    key: 'edition',
    label: 'Edition',
    text: (row) => editionYear(row.edition),
  }
  return [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <>
          <strong>{row.name}</strong>
          {row.context && (
            <span className="text-body-secondary small ms-2">{row.context}</span>
          )}
        </>
      ),
      sortValue: (row) => row.name,
      filterable: false,
    },
    factColumn(kind),
    factColumn(source),
    factColumn(edition),
    // The classes whose spell list holds a spell, to filter the Spell kind by class.
    {
      key: 'classLists',
      header: 'Class lists',
      render: (row) => spellClasses(row).join(', ') || NO_VALUE,
      sortValue: (row) => spellClasses(row).join(', '),
      filterValue: (row) => {
        const names = spellClasses(row)
        return names.length > 0 ? names : [NO_VALUE]
      },
      defaultHidden: true,
    },
    {
      key: 'match',
      header: 'Where it matches',
      render: (row) => {
        const snippet = snippets.get(row.id)
        return snippet ? (
          <span className="small">
            {snippet.before}
            <mark>{snippet.match}</mark>
            {snippet.after}
          </span>
        ) : (
          '-'
        )
      },
      sortable: false,
      filterable: false,
      priority: 1,
    },
  ]
}
