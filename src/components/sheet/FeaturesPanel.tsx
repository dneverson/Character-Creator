// The Features & Traits tab: everything the classes, species, background and feats give,
// in the shared table, each with its full text in the sheet's detail pane. A feature with
// limited uses has its counter in the Uses column, on the first row of that feature.

import { useMemo } from 'react'
import type { FeatureRow } from '../../derived/features'
import type { DerivedResource } from '../../derived/resources'
import { BrowseTable } from '../table/BrowseTable'
import type { Describe, Fact } from '../table/facts'
import type { Column } from '../table/types'
import {
  describeFeature,
  featureColumns,
  featureKey,
  featureName,
  featureSearchText,
} from './featureFacts'
import { useSheetRowDetail } from './SheetDetail'
import type { SheetPanelProps } from './SheetPanels'
import { UseCounter } from './UseCounter'
import { RechargeNote } from './RechargeNote'
import { usesText } from './usesText'
import { usePlay } from './usePlay'

/** The counters of each feature row: only the first row of a feature carries them. */
function countersByRow(
  rows: readonly FeatureRow[],
  resources: readonly DerivedResource[],
): Map<string, DerivedResource[]> {
  const out = new Map<string, DerivedResource[]>()
  const taken = new Set<string>()
  for (const row of rows) {
    if (!row.anchor || taken.has(row.anchor)) continue
    taken.add(row.anchor)
    const list = resources.filter((r) => r.anchor === row.anchor)
    if (list.length > 0) out.set(row.id, list)
  }
  return out
}

export function FeaturesPanel({ sheet }: SheetPanelProps) {
  const detailTarget = useSheetRowDetail('features')
  const current = usePlay(sheet)
  const pools = current?.derived.uses
  const counters = useMemo(
    () => countersByRow(sheet.features, sheet.resources),
    [sheet.features, sheet.resources],
  )
  const columns = useMemo<Column<FeatureRow>[]>(() => {
    const uses: Column<FeatureRow> = {
      key: 'uses',
      header: 'Uses',
      priority: 0,
      filterable: false,
      sortValue: (row) => (counters.has(row.id) ? 1 : 0),
      render: (row) => (
        <span className="sheet-uses-cell">
          {(counters.get(row.id) ?? []).map((r) => (
            <span key={r.id} className="sheet-uses-cell__item">
              <UseCounter resource={r} pool={pools?.find((p) => p.id === r.id)} />
              <RechargeNote resource={r} named={r.label !== row.name} />
            </span>
          ))}
        </span>
      ),
    }
    const [name, ...rest] = featureColumns
    return [name, uses, ...rest]
  }, [counters, pools])
  const describe = useMemo<Describe<FeatureRow>>(() => {
    const usesFact: Fact<FeatureRow> = {
      key: 'uses',
      label: 'Uses',
      text: (row) => (counters.get(row.id) ?? []).map(usesText).join(' '),
    }
    // A feature without limited uses has nothing in the fact, and the pane leaves it out.
    return (rows) =>
      describeFeature(rows).map((group) =>
        group.key === 'basics' ? { ...group, facts: [...group.facts, usesFact] } : group,
      )
  }, [counters])
  return (
    <BrowseTable<FeatureRow>
      tableId="sheet-features"
      rows={sheet.features}
      columns={columns}
      idOf={featureKey}
      nameOf={featureName}
      describe={describe}
      searchText={featureSearchText}
      compact
      detailTarget={detailTarget}
      labels={{
        compare: 'Compare features',
        search: 'Search features...',
        table: 'Features and traits',
      }}
    />
  )
}
