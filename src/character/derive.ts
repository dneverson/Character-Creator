// Derived values computed from a character (kept out of components for reuse/testing).

import type { AbilityKey } from '../dice/dice'
import type { Character } from './model'
import { abilityTotals } from './stats'

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

/**
 * Effective ability totals: base + origin (race/background) + feat and Ability
 * Score Improvement increases + other.
 */
export function characterAbilityTotals(
  character: Character,
  featBonus: Partial<Record<AbilityKey, number>> = {},
): Record<AbilityKey, number> {
  return abilityTotals(
    character.abilities,
    character.statMethod,
    (k) => originBonus(character, k) + (featBonus[k] ?? 0),
  )
}
