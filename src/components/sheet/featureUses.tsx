// How a feature row's cell draws its counters. The Features & Traits tab and the Favorites
// share it, so a feature reads the same wherever it is.

import type { FeatureRow } from '../../derived/features'
import type { DerivedResource } from '../../derived/resources'
import type { UsePool } from '../../play/derivePlay'
import { RechargeNote } from './RechargeNote'
import { UseCounter } from './UseCounter'

/** The counters of a feature row, each with what restores it. */
export function FeatureUses({
  row,
  counters,
  pools,
}: {
  row: FeatureRow
  counters: Map<string, DerivedResource[]>
  pools: readonly UsePool[] | undefined
}) {
  return (
    <span className="sheet-uses-cell">
      {(counters.get(row.id) ?? []).map((r) => (
        <span key={r.id} className="sheet-uses-cell__item">
          <UseCounter resource={r} pool={pools?.find((p) => p.id === r.id)} />
          <RechargeNote resource={r} named={r.label !== row.name} />
        </span>
      ))}
    </span>
  )
}
