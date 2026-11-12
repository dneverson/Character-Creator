// The Features & Traits tab: everything the classes, species, background and feats give,
// in the shared table, each with its full text in the sheet's detail pane.

import type { FeatureRow } from '../../derived/features'
import { BrowseTable } from '../table/BrowseTable'
import {
  describeFeature,
  featureColumns,
  featureKey,
  featureName,
  featureSearchText,
} from './featureFacts'
import { useSheetRowDetail } from './SheetDetail'
import type { SheetPanelProps } from './SheetPanels'

export function FeaturesPanel({ sheet }: SheetPanelProps) {
  const detailTarget = useSheetRowDetail('features')
  return (
    <BrowseTable<FeatureRow>
      tableId="sheet-features"
      rows={sheet.features}
      columns={featureColumns}
      idOf={featureKey}
      nameOf={featureName}
      describe={describeFeature}
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
