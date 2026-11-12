// Derived values computed from a character (kept out of components for reuse/testing).

import { ABILITIES, POINT_BUY_MIN, type AbilityKey } from '../dice/dice'
import type { Character } from './model'
import { usesPool } from './stats'

/** Total racial bonus to an ability (fixed race bonus + player choices). */
export function racialBonus(character: Character, key: AbilityKey): number {
  const race = character.race
  if (!race) return 0
  return (race.abilityFixed[key] ?? 0) + (race.abilityChoices[key] ?? 0)
}

/** Ability increase from a 2024 background's assigned spread. */
export function backgroundBonus(character: Character, key: AbilityKey): number {
  return character.background?.abilityChoices[key] ?? 0
}

/**
 * Total "origin" bonus to an ability: race (2014) + background (2024). Mixing
 * both is off-standard but allowed; the totals simply add.
 */
export function originBonus(character: Character, key: AbilityKey): number {
  return racialBonus(character, key) + backgroundBonus(character, key)
}

/** Total level across all classes. */
export function totalLevel(character: Character): number {
  return character.classes.reduce((sum, c) => sum + (c.level || 0), 0)
}

/** One ability score and what makes it up, as the Ability Scores table shows it. */
export interface AbilityBreakdown {
  /** The assigned score; null while a pool score is still to be assigned (it counts 0).
   * Point buy reads a missing base as its floor. */
  base: number | null
  /** Race (2014) and background (2024) increases. */
  origin: number
  /** Feat and Ability Score Improvement increases. */
  feats: number
  other: number
  total: number
}

/**
 * Every ability score broken down: base + origin (race/background) + feat and
 * Ability Score Improvement increases + other.
 */
export function characterAbilityBreakdown(
  character: Character,
  featBonus: Partial<Record<AbilityKey, number>> = {},
): Record<AbilityKey, AbilityBreakdown> {
  const pool = usesPool(character.statMethod)
  return Object.fromEntries(
    ABILITIES.map((key) => {
      const entry = character.abilities[key]
      const base = pool ? entry.base : (entry.base ?? POINT_BUY_MIN)
      const origin = originBonus(character, key)
      const feats = featBonus[key] ?? 0
      const total = (base ?? 0) + origin + feats + entry.other
      return [key, { base, origin, feats, other: entry.other, total }]
    }),
  ) as Record<AbilityKey, AbilityBreakdown>
}

/** Effective ability totals, the `total` of each ability's breakdown. */
export function characterAbilityTotals(
  character: Character,
  featBonus: Partial<Record<AbilityKey, number>> = {},
): Record<AbilityKey, number> {
  const breakdown = characterAbilityBreakdown(character, featBonus)
  return Object.fromEntries(
    ABILITIES.map((key) => [key, breakdown[key].total]),
  ) as Record<AbilityKey, number>
}
