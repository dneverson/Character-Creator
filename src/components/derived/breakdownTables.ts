// The tables that say how a number adds up, from the spec its info button and its roll share.

import type { BreakdownTable } from '../sheet/SheetDetail'
import type { BreakdownSpec } from './DerivedNumber'

/** The tables that say how a number adds up: its own, and the further ones. */
export function tablesOf(spec: BreakdownSpec): BreakdownTable[] {
  return [
    {
      quantity: spec.quantity,
      ariaLabel: spec.label,
      amountHeader: spec.amountHeader ?? spec.label,
      totalLabel: spec.totalLabel ?? spec.label,
      format: spec.format,
    },
    ...(spec.also ?? []).map((extra) => ({
      quantity: extra.quantity,
      ariaLabel: extra.label,
      amountHeader: extra.amountHeader ?? extra.label,
      totalLabel: extra.label,
      format: extra.format,
    })),
  ]
}
