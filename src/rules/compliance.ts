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

/** Abilities whose score is still to be assigned: a check cannot count them as met. */
export type UnsetAbilities = ReadonlySet<AbilityKey>

const NONE_UNSET: UnsetAbilities = new Set()

type Scores = Partial<Record<AbilityKey, number>>

const entriesOf = (req: Scores) => Object.entries(req) as [AbilityKey, number][]

function meetsOne(req: Scores, totals: AbilityTotals, unset: UnsetAbilities): boolean {
  return entriesOf(req).every(
    ([ability, min]) => !unset.has(ability) && totals[ability] >= min,
  )
}

const meetsOr = (
  or: Scores[] | undefined,
  totals: AbilityTotals,
  unset: UnsetAbilities,
) => !or || or.length === 0 || or.some((option) => meetsOne(option, totals, unset))

/** Whether ability totals satisfy a (possibly "or"-branched) requirement set. */
export function meetsRequirements(
  req: MulticlassRequirements | undefined,
  totals: AbilityTotals,
  unset: UnsetAbilities = NONE_UNSET,
): boolean {
  if (!req) return true
  const { or, ...direct } = req
  return meetsOne(direct, totals, unset) && meetsOr(or, totals, unset)
}

const scoresText = (req: Scores) =>
  entriesOf(req)
    .map(([ability, min]) => `${ABILITY_NAMES[ability]} ${min}`)
    .join(' and ')

function describeRequirements(req: MulticlassRequirements): string {
  const { or, ...direct } = req
  const parts = entriesOf(direct).length > 0 ? [scoresText(direct)] : []
  if (or && or.length > 0) parts.push(or.map(scoresText).join(' or '))
  return parts.join(', ')
}

/** What the character has in the abilities a requirement falls short on. */
function describeShortfall(
  req: MulticlassRequirements,
  totals: AbilityTotals,
  unset: UnsetAbilities,
): string {
  const { or, ...direct } = req
  const named = new Set(
    [...entriesOf(direct), ...(or ?? []).flatMap(entriesOf)].map(([a]) => a),
  )
  const short = new Set(
    entriesOf(direct)
      .filter(([ability, min]) => !meetsOne({ [ability]: min }, totals, unset))
      .map(([ability]) => ability),
  )
  if (!meetsOr(or, totals, unset)) {
    for (const [ability] of (or ?? []).flatMap(entriesOf)) short.add(ability)
  }
  const set = [...short].filter((a) => !unset.has(a))
  const notSet = [...short].filter((a) => unset.has(a))
  const parts: string[] = []
  if (set.length > 0) {
    // A requirement on one ability reads plainly with its value alone ("you have 12").
    const values =
      named.size === 1
        ? String(totals[set[0]])
        : set.map((a) => `${ABILITY_NAMES[a]} ${totals[a]}`).join(' and ')
    parts.push(`you have ${values}`)
  }
  if (notSet.length > 0) {
    const names = notSet.map((a) => ABILITY_NAMES[a]).join(' and ')
    parts.push(`${names} ${notSet.length > 1 ? 'are' : 'is'} not set yet`)
  }
  return parts.join('; ')
}

/**
 * Check multiclass ability-score prerequisites. In 5e, once you have more than
 * one class you must meet the prerequisites of every class involved. An ability
 * still to be assigned (`unset`) does not count as met, and the flag says so.
 */
export function checkMulticlass(
  classes: ClassRef[],
  requirementsBySource: Map<string, MulticlassRequirements | undefined>,
  totals: AbilityTotals,
  unset: UnsetAbilities = NONE_UNSET,
): Deviation[] {
  if (classes.length <= 1) return []
  const deviations: Deviation[] = []
  for (const cls of classes) {
    const key = `${cls.name}|${cls.source}`
    const req = requirementsBySource.get(key)
    if (req && !meetsRequirements(req, totals, unset)) {
      deviations.push({
        id: `multiclass-req:${key}`,
        category: 'multiclass-req',
        message: `${cls.name} needs ${describeRequirements(req)} to multiclass, ${describeShortfall(req, totals, unset)} - allowed with DM approval.`,
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
