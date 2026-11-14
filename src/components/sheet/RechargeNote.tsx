// The words beside a counter's pips: its name when the row has another, and what restores
// it, with how its maximum is worked out as the tooltip.

import type { DerivedResource } from '../../derived/resources'
import { rechargeShort } from './usesText'

export function RechargeNote({
  resource,
  named,
}: {
  resource: DerivedResource
  /** Show the counter's name ("Superiority Dice") before the recharge. */
  named: boolean
}) {
  return (
    <span
      className="sheet-uses__note"
      title={`${resource.restores}. Maximum: ${resource.basis}.`}
    >
      {named ? `${resource.label} - ` : ''}
      {rechargeShort(resource)}
    </span>
  )
}
