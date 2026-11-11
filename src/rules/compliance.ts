// The RAW-compliance layer. D&D 5e rules are the default, but the app never
// hard-blocks the user: off-standard choices are ALLOWED and surfaced as
// "deviations" with a plain-language reason.

import { ABILITY_NAMES, type AbilityKey } from '../dice/dice'
import type { ClassRef } from '../character/model'
import type { MulticlassRequirements } from '../data/class'

export interface Deviation {
  /** Stable key for de-duplication. */
  id: string
  category: 'multiclass-req' | 'level-cap' | 'off-list' | 'ability-cap'
  message: string
}

/** Standard maximum total character level. Exceeding it is allowed but flagged. */
export const STANDARD_LEVEL_CAP = 20

export type AbilityTotals = Record<AbilityKey, number>

function meetsOne(
  req: Partial<Record<AbilityKey, number>>,
  totals: AbilityTotals,
): boolean {
  return (Object.entries(req) as [AbilityKey, number][]).every(
    ([ability, min]) => totals[ability] >= min,
  )
}

/** Whether ability totals satisfy a (possibly "or"-branched) requirement set. */
export function meetsRequirements(
  req: MulticlassRequirements | undefined,
  totals: AbilityTotals,
): boolean {
  if (!req) return true
  const { or, ...direct } = req
  if (Object.keys(direct).length > 0 && !meetsOne(direct, totals)) return false
  if (or && or.length > 0 && !or.some((option) => meetsOne(option, totals))) return false
  return true
}

function describeRequirements(req: MulticlassRequirements): string {
  const { or, ...direct } = req
  const parts = (Object.entries(direct) as [AbilityKey, number][]).map(
    ([ability, min]) => `${ABILITY_NAMES[ability]} ${min}`,
  )
  if (or && or.length > 0) {
    const orText = or
      .map((option) =>
        (Object.entries(option) as [AbilityKey, number][])
          .map(([ability, min]) => `${ABILITY_NAMES[ability]} ${min}`)
          .join(' and '),
      )
      .join(' or ')
    parts.push(orText)
  }
  return parts.join(', ')
}

/**
 * Check multiclass ability-score prerequisites. In 5e, once you have more than
 * one class you must meet the prerequisites of every class involved.
 */
export function checkMulticlass(
  classes: ClassRef[],
  requirementsBySource: Map<string, MulticlassRequirements | undefined>,
  totals: AbilityTotals,
): Deviation[] {
  if (classes.length <= 1) return []
  const deviations: Deviation[] = []
  for (const cls of classes) {
    const key = `${cls.name}|${cls.source}`
    const req = requirementsBySource.get(key)
    if (req && !meetsRequirements(req, totals)) {
      deviations.push({
        id: `multiclass-req:${key}`,
        category: 'multiclass-req',
        message: `Multiclassing with ${cls.name} normally requires ${describeRequirements(req)}. Your current scores don't meet this - allowed with DM approval.`,
      })
    }
  }
  return deviations
}

/** Flag a total character level above the standard cap. */
export function checkLevelCap(totalLevel: number): Deviation[] {
  if (totalLevel <= STANDARD_LEVEL_CAP) return []
  return [
    {
      id: 'level-cap',
      category: 'level-cap',
      message: `Total level ${totalLevel} exceeds the standard cap of ${STANDARD_LEVEL_CAP}. Allowed for custom builds with DM approval.`,
    },
  ]
}
