// A rest applied to the play state, by the rules table of the edition (restRules.ts). Nothing
// here blocks: a rest at 0 hit points only carries a warning, and the player can always go on.

import type { HitDieSpend, PlayState, RestoredUse } from '../character/model'
import type { Recharge } from '../rules/resources'
import type { RestEffect, RestKind } from '../rules/restRules'
import type { SpellSlots } from '../rules/spellcasting'
import { heal, MAX_EXHAUSTION } from './actions'
import type { DerivedResource } from '../derived/resources'
import type { HitDicePool, UsePool } from './derivePlay'

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

/**
 * The effects of a rest that mean something for this character: the slots a rest restores
 * are listed only for a character with slots of that kind (Pact Magic for a Warlock).
 */
export function restEffectsFor(
  rules: readonly RestEffect[],
  slots: SpellSlots,
): readonly RestEffect[] {
  const has = {
    standard: slots.standard.some((n) => n > 0),
    pact: (slots.pact?.slots ?? 0) > 0,
  }
  return rules.filter((e) => e.kind !== 'restoreSlots' || e.which.some((w) => has[w]))
}

/** A limited-use counter as a rest reads it: what was spent and what restores it. */
export interface UseRecharge {
  id: string
  label: string
  spent: number
  recharge: Recharge
  /** Uses a short rest restores on top of the recharge (Sorcerous Restoration). */
  shortRegain: number
}

/** The counters of the derived sheet with what is spent of each, as a rest reads them. */
export function rechargesOf(
  resources: readonly DerivedResource[],
  pools: readonly UsePool[],
): UseRecharge[] {
  const spent = new Map(pools.map((p) => [p.id, p.spent]))
  return resources.map((r) => ({
    id: r.id,
    label: r.label,
    spent: spent.get(r.id) ?? 0,
    recharge: r.recharge,
    shortRegain: r.shortRegain,
  }))
}

/** The uses a rest of this kind gives back, by counter; none for a counter with none spent. */
export function restoredUses(on: RestKind, uses: readonly UseRecharge[]): RestoredUse[] {
  return uses.flatMap((use) => {
    const back =
      on === 'long'
        ? use.recharge === 'none'
          ? 0
          : use.spent
        : use.recharge === 'short'
          ? use.spent
          : (use.recharge === 'shortOne' ? 1 : 0) + use.shortRegain
    const regained = Math.min(back, use.spent)
    return regained > 0 ? [{ id: use.id, label: use.label, regained }] : []
  })
}

export interface RestInput {
  maxHp: number
  hitDice: readonly HitDicePool[]
  /** Short rest: the hit dice spent and what they rolled. */
  spends?: readonly HitDieSpend[]
  /** The limited-use counters, for the rest to restore what each one says. */
  uses?: readonly UseRecharge[]
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
  const recharge = find(rules, 'rechargeUses')
  if (recharge) {
    const uses = { ...next.uses }
    for (const { id, regained } of restoredUses(recharge.on, input.uses ?? [])) {
      uses[id] = Math.max(0, (uses[id] ?? 0) - regained)
    }
    next = { ...next, uses }
  }
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
