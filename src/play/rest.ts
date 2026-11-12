// A rest applied to the play state, by the rules table of the edition (restRules.ts). Nothing
// here blocks: a rest at 0 hit points only carries a warning, and the player can always go on.

import type { HitDieSpend, PlayState } from '../character/model'
import type { RestEffect, RestKind } from '../rules/restRules'
import { heal, MAX_EXHAUSTION } from './actions'
import type { HitDicePool } from './derivePlay'

const find = <K extends RestEffect['kind']>(
  rules: readonly RestEffect[],
  kind: K,
): Extract<RestEffect, { kind: K }> | undefined =>
  rules.find((e): e is Extract<RestEffect, { kind: K }> => e.kind === kind)

/** The hit points one hit die gives: the roll and the Constitution modifier, at least the minimum. */
export function hitDieHp(roll: number, conMod: number, minimum: number): number {
  return Math.max(minimum, roll + conMod)
}

/** The hit dice a long rest gives back, by size: the largest first, never more than were spent. */
export function regainedDice(
  pools: readonly HitDicePool[],
  portion: 'all' | 'half',
  minimum: number,
): Record<string, number> {
  const total = pools.reduce((sum, pool) => sum + pool.total, 0)
  let budget = portion === 'all' ? total : Math.max(minimum, Math.floor(total / 2))
  const back: Record<string, number> = {}
  for (const pool of [...pools].sort((a, b) => b.faces - a.faces)) {
    const n = Math.min(budget, pool.spent)
    if (n > 0) back[pool.die] = n
    budget -= n
  }
  return back
}

/** What a rest at this point would warn about, or undefined. */
export function restWarning(
  rules: readonly RestEffect[],
  currentHp: number,
): string | undefined {
  const rule = find(rules, 'requiresHp')
  return rule && currentHp <= 0 ? rule.text : undefined
}

export interface RestInput {
  maxHp: number
  hitDice: readonly HitDicePool[]
  /** Short rest: the hit dice spent and what they rolled. */
  spends?: readonly HitDieSpend[]
}

/** The play state after a rest of this kind under these rules. */
export function applyRest(
  play: PlayState,
  rules: readonly RestEffect[],
  input: RestInput,
): PlayState {
  let next = play
  const spends = find(rules, 'spendHitDice') ? (input.spends ?? []) : []
  if (spends.length > 0) {
    const hitDiceSpent = { ...next.hitDiceSpent }
    for (const { die } of spends) hitDiceSpent[die] = (hitDiceSpent[die] ?? 0) + 1
    next = { ...next, hitDiceSpent }
    next = heal(
      next,
      spends.reduce((sum, s) => sum + s.hp, 0),
      input.maxHp,
    )
  }
  if (find(rules, 'restoreHp')) next = heal(next, input.maxHp, input.maxHp)
  if (find(rules, 'resetDeathSaves')) {
    next = { ...next, deathSaves: { successes: 0, failures: 0 } }
  }
  const dice = find(rules, 'regainHitDice')
  if (dice) {
    const back = regainedDice(input.hitDice, dice.portion, dice.minimum)
    const hitDiceSpent = { ...next.hitDiceSpent }
    for (const [die, n] of Object.entries(back)) {
      hitDiceSpent[die] = Math.max(0, (hitDiceSpent[die] ?? 0) - n)
    }
    next = { ...next, hitDiceSpent }
  }
  const slots = find(rules, 'restoreSlots')
  if (slots?.which.includes('standard')) next = { ...next, slotsSpent: [] }
  if (slots?.which.includes('pact')) next = { ...next, pactSpent: 0 }
  if (find(rules, 'endTempHp')) next = { ...next, tempHp: 0 }
  if (find(rules, 'reduceExhaustion')) {
    next = {
      ...next,
      exhaustion: Math.max(0, Math.min(next.exhaustion, MAX_EXHAUSTION) - 1),
    }
  }
  return next
}

export const REST_TITLES: Record<RestKind, string> = {
  short: 'Short rest',
  long: 'Long rest',
}
