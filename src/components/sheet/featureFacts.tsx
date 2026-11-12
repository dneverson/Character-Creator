// How a feature or trait is described: where it comes from and its text in full. The
// Features & Traits tab hands this to the shared table, which draws the columns and the
// detail pane from it.

import type { FeatureRow } from '../../derived/features'
import { Entries } from '../../text/Entries'
import { factColumn, type Describe, type Fact } from '../table/facts'
import type { Column } from '../table/types'

export const featureKey = (row: FeatureRow) => row.id
export const featureName = (row: FeatureRow) => row.name

const from: Fact<FeatureRow> = {
  key: 'from',
  label: 'From',
  text: (row) => row.from,
}
const kind: Fact<FeatureRow> = {
  key: 'kind',
  label: 'Kind',
  text: (row) => row.kind,
}
const level: Fact<FeatureRow> = {
  key: 'level',
  label: 'Level',
  text: (row) => (row.level === undefined ? '' : String(row.level)),
}
const description: Fact<FeatureRow> = {
  key: 'description',
  role: 'body',
  label: 'Description',
  text: (row) => (row.entries.length > 0 ? JSON.stringify(row.entries) : ''),
  render: (row) => <Entries entries={row.entries} />,
}

export const featureColumns: Column<FeatureRow>[] = [
  {
    key: 'name',
    header: 'Feature',
    render: (row) => <span className="fw-semibold">{row.name}</span>,
    sortValue: (row) => row.name,
    filterable: false,
  },
  factColumn(from),
  factColumn(kind, { priority: 2 }),
  factColumn(level, {
    priority: 1,
    sortValue: (row) => row.level ?? 0,
  }),
]

export const describeFeature: Describe<FeatureRow> = () => [
  { key: 'basics', title: 'Basics', facts: [from, kind, level] },
  { key: 'text', title: 'Text', facts: [description] },
]

export const featureSearchText = (row: FeatureRow) =>
  `${row.name} ${row.from} ${row.kind}`
