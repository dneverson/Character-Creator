// The counter of a limited use: pips for a few uses, a number with a minus and a plus for a
// pool (sorcery points, Lay on Hands). Spending and regaining go through the play actions;
// nothing is locked but the count, which stays between none and the maximum.

import type { MouseEvent } from 'react'
import type { DerivedResource } from '../../derived/resources'
import { restoreUse, spendUse } from '../../play/actions'
import type { UsePool } from '../../play/derivePlay'
import { IconButton } from './PlayStrip'
import { Pip } from './SheetPips'
import { useApplyPlay } from './usePlay'

/** The most uses shown as pips; a larger pool is a number with a minus and a plus. */
export const PIP_LIMIT = 6

export function UseCounter({
  resource,
  pool,
}: {
  resource: DerivedResource
  /** What is spent of it; absent for an unlimited counter. */
  pool: UsePool | undefined
}) {
  const applyPlay = useApplyPlay()
  if (resource.max === undefined || !pool) {
    return <span className="sheet-uses">Unlimited</span>
  }
  const name = resource.label
  if (pool.total === 0) return <span className="sheet-uses">None yet</span>
  const spend = () => applyPlay((p) => spendUse(p, pool.id, pool.total))
  const restore = () => applyPlay((p) => restoreUse(p, pool.id, pool.total))
  // In a table row, a click on the counter is the spend, not a request for the row's text.
  const stop = (e: MouseEvent) => e.stopPropagation()
  if (pool.total <= PIP_LIMIT) {
    return (
      <span
        className="sheet-pips sheet-uses"
        role="group"
        aria-label={`${name} uses`}
        onClick={stop}
      >
        {Array.from({ length: pool.total }, (_, i) => {
          const used = i >= pool.left
          return (
            <Pip
              key={i}
              filled={!used}
              pressed={used}
              label={`${name} use ${i + 1} of ${pool.total}, ${used ? 'used' : 'available'}`}
              onClick={used ? restore : spend}
            />
          )
        })}
      </span>
    )
  }
  return (
    <span
      className="sheet-uses sheet-uses--pool"
      role="group"
      aria-label={`${name} uses`}
      onClick={stop}
    >
      <IconButton
        label={`Spend one ${name}`}
        icon="minus"
        disabled={pool.left === 0}
        onClick={spend}
      />
      <strong>
        {pool.left}/{pool.total}
      </strong>
      <IconButton
        label={`Regain one ${name}`}
        icon="add"
        disabled={pool.spent === 0}
        onClick={restore}
      />
    </span>
  )
}
