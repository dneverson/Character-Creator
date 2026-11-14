// The Features & Traits tab: everything the classes, species, background and feats give,
// in the shared table, each with its full text in the sheet's detail pane. A feature with
// limited uses has its counter in the Uses column, on the first row of that feature.

import { useMemo } from 'react'
import type { FeatureRow } from '../../derived/features'
import { BrowseTable } from '../table/BrowseTable'
import type { Column } from '../table/types'
import {
  featureColumns,
  featureKey,
  featureName,
  featureSearchText,
} from './featureFacts'
import { FeatureUses } from './featureUses'
import { useFeatureUses } from './useFeatureUses'
import { PinButton } from './PinButton'
import { useSheetRowDetail } from './SheetDetail'
import type { SheetPanelProps } from './SheetPanels'

export function FeaturesPanel({ sheet }: SheetPanelProps) {
  const detailTarget = useSheetRowDetail('features')
  const { counters, pools, describe } = useFeatureUses(sheet)
  const columns = useMemo<Column<FeatureRow>[]>(() => {
    const uses: Column<FeatureRow> = {
      key: 'uses',
      header: 'Uses',
      priority: 0,
      filterable: false,
      sortValue: (row) => (counters.has(row.id) ? 1 : 0),
      render: (row) => <FeatureUses row={row} counters={counters} pools={pools} />,
    }
    const [name, ...rest] = featureColumns
    return [name, uses, ...rest]
  }, [counters, pools])
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
      pin={(row) => <PinButton kind="feature" id={featureKey(row)} />}
      labels={{
        compare: 'Compare features',
        search: 'Search features...',
        table: 'Features and traits',
      }}
    />
  )
}
