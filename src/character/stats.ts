import {
  abilityMod,
  ABILITIES,
  DEFAULT_ROLL_CONFIG,
  POINT_BUY_MIN,
  rollScorePool,
  STANDARD_ARRAY,
  sum,
  type AbilityKey,
  type RollConfig,
} from '../dice/dice'
import type { Abilities, GauntletSlot, StatMethod } from './model'

export function isRollMethod(method: StatMethod): method is 'roll' {
  return method === 'roll'
}

/** Whether a method assigns scores from a pool (vs. point-buy steppers). */
export function usesPool(method: StatMethod): boolean {
  return method !== 'pointbuy'
}

/**
 * Generate the assignable pool for a method. Roll methods roll six scores; the
 * standard array is fixed; point-buy and matrix produce no pool here (matrix is
 * rolled in the UI and its best line becomes the pool).
 */
export function generatePool(method: StatMethod, config?: RollConfig): number[] {
  if (isRollMethod(method)) return rollScorePool(config ?? DEFAULT_ROLL_CONFIG)
  if (method === 'array') return [...STANDARD_ARRAY]
  return []
}

/**
 * The six Gauntlet totals ready to disperse, or [] until six slots exist. Each
 * slot's total is live from the moment it is rolled, so the totals feed the
 * ability table as soon as the Gauntlet is rolled (there is no lock step).
 */
export function gauntletScores(slots: GauntletSlot[]): number[] {
  if (slots.length !== 6) return []
  return slots.map((s) => s.total)
}

/**
 * The six Pool group sums as tiles, one per group (0..5), with null for any group
 * not yet holding all three dice. This lets the score tiles show live feedback
 * while grouping - a completed group shows its sum, an incomplete one stays blank.
 * `groups[i]` is the group index (0..5) die `i` belongs to, or null.
 */
export function poolGroupTotals(
  dice: number[],
  groups: (number | null)[],
): (number | null)[] {
  const sums = [0, 0, 0, 0, 0, 0]
  const counts = [0, 0, 0, 0, 0, 0]
  for (let i = 0; i < dice.length; i++) {
    const g = groups[i]
    if (g == null || g < 0 || g > 5) continue
    sums[g] += dice[i]
    counts[g] += 1
  }
  return sums.map((s, g) => (counts[g] === 3 ? s : null))
}

/**
 * The six Pool group sums ready to disperse, or [] until the roll is complete.
 * A Pool result only becomes an assignable pool once every group holds exactly
 * three dice (all 18 grouped), so a partially-grouped Pool never leaks scores.
 */
export function poolScores(dice: number[], groups: (number | null)[]): number[] {
  const tiles = poolGroupTotals(dice, groups)
  return tiles.every((t) => t != null) ? (tiles as number[]) : []
}

/** Objective summary of a set of scores: the same metrics for every roll method. */
export interface RollStats {
  /** Number of scores summarised. */
  count: number
  /** Total of the scores. */
  total: number
  /** Average score (always the computed mean, total / count - never a constant). */
  average: number
  /** Sum of the ability modifiers the scores grant. */
  modSum: number
}

/**
 * Summarise a set of rolled scores with the same objective metrics for every
 * method - total, computed average (total / count), and modifier sum - so the
 * numbers mean the same thing whichever way the scores were generated. Returns
 * null when there is nothing to summarise.
 */
export function rollStats(scores: number[]): RollStats | null {
  if (scores.length === 0) return null
  const total = sum(scores)
  return {
    count: scores.length,
    total,
    average: total / scores.length,
    modSum: scores.reduce((m, s) => m + abilityMod(s), 0),
  }
}

/** Pool values still available to assign (pool minus already-assigned bases). */
export function remainingPool(pool: number[], abilities: Abilities): number[] {
  const counts = new Map<number, number>()
  for (const v of pool) counts.set(v, (counts.get(v) ?? 0) + 1)
  for (const key of ABILITIES) {
    const base = abilities[key].base
    if (base != null && counts.has(base)) {
      counts.set(base, counts.get(base)! - 1)
    }
  }
  const out: number[] = []
  for (const [value, count] of counts) {
    for (let i = 0; i < count; i++) out.push(value)
  }
  return out.sort((a, b) => b - a)
}

/** Total ability score = base + racial + other. */
export function totalScore(base: number | null, racial: number, other: number): number {
  return (base ?? 0) + racial + other
}

/**
 * Effective ability totals for rules checks. The per-ability origin bonus
 * (race + background) is supplied by the caller via `racial`.
 */
export function abilityTotals(
  abilities: Abilities,
  method: StatMethod,
  racial: (key: AbilityKey) => number = () => 0,
): Record<AbilityKey, number> {
  const floor = method === 'pointbuy' ? POINT_BUY_MIN : 0
  return Object.fromEntries(
    ABILITIES.map((k) => [
      k,
      (abilities[k].base ?? floor) + racial(k) + abilities[k].other,
    ]),
  ) as Record<AbilityKey, number>
}

/** Fresh abilities set to the point-buy floor (used when switching to point buy). */
export function pointBuyBaseline(): Abilities {
  return Object.fromEntries(
    ABILITIES.map((k) => [k, { base: POINT_BUY_MIN, other: 0 }]),
  ) as Abilities
}

/** Abilities with all bases cleared (used when generating a new pool). */
export function clearedAbilities(existing: Abilities): Abilities {
  return Object.fromEntries(
    ABILITIES.map((k) => [k, { base: null, other: existing[k].other }]),
  ) as Abilities
}
