// How a limited-use counter is put in words beside its pips and in the detail pane: what
// restores it, and how its maximum is worked out.

import type { DerivedResource } from '../../derived/resources'
import type { Recharge } from '../../rules/resources'

/** What restores the uses, short enough to sit beside the pips. */
const RECHARGE_SHORT: Record<Recharge, string> = {
  short: 'Short or long rest',
  long: 'Long rest',
  shortOne: '1 per short rest, all per long',
  none: '',
}

export function rechargeShort(resource: DerivedResource): string {
  const base = RECHARGE_SHORT[resource.recharge] || resource.restores
  return resource.shortRegain > 0
    ? `${base}, ${resource.shortRegain} per short rest`
    : base
}

/**
 * The counter in a sentence: "Rage: 3 uses. Maximum: ... All on a long rest.". The uses
 * left are the counter's own to show: the text of an open pane does not follow a spend.
 */
export function usesText(resource: DerivedResource): string {
  const { max } = resource
  const count =
    max === undefined ? 'Unlimited uses' : `${max} ${max === 1 ? 'use' : 'uses'}`
  return `${resource.label}: ${count}. Maximum: ${resource.basis}. ${resource.restores}.`
}
