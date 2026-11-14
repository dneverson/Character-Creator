// The counters of the feature rows: which counter belongs to which row, and the "Uses" fact
// of a row's text. The Features & Traits tab and the Favorites share them.

import { useMemo } from 'react'
import type { DerivedSheet } from '../../derived'
import type { FeatureRow } from '../../derived/features'
import type { DerivedResource } from '../../derived/resources'
import type { Describe, Fact } from '../table/facts'
import { describeFeature } from './featureFacts'
import { usePlay } from './usePlay'
import { usesText } from './usesText'

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

export function useFeatureUses(sheet: DerivedSheet) {
  const pools = usePlay(sheet)?.derived.uses
  const counters = useMemo(
    () => countersByRow(sheet.features, sheet.resources),
    [sheet.features, sheet.resources],
  )
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
  return { counters, pools, describe }
}
