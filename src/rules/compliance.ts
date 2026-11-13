// The RAW-compliance layer. D&D 5e rules are the default, but the app never
// hard-blocks the user: off-standard choices are ALLOWED and surfaced as
// "deviations" with a plain-language reason.

import { ABILITIES, ABILITY_NAMES, formatMod, type AbilityKey } from '../dice/dice'
import type { Character, ClassRef } from '../character/model'
import {
  ABILITY_SCORE_MAX,
  describeAbilityOption,
  validChoices,
  type AbilityIncreases,
  type AbilityOption,
} from '../data/abilityOptions'
import type { PlayableBackground } from '../data/background'
import type { MulticlassRequirements } from '../data/class'
import type { PlayableRace } from '../data/race'

export interface Deviation {
  /** Stable key for de-duplication. */
  id: string
  category:
    'multiclass-req' | 'level-cap' | 'off-list' | 'ability-cap' | 'origin-increase'
  message: string
  /** The ability scores it is about, when it is about some (an origin increase). */
  abilities?: AbilityKey[]
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

/** The ability totals a class was taken with, and the character level it was taken at. */
export interface ClassEntryScores {
  characterLevel: number
  totals: AbilityTotals
}

/** What the character has in the abilities a requirement falls short on. */
function describeShortfall(
  req: MulticlassRequirements,
  { totals, characterLevel }: ClassEntryScores,
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
    parts.push(`you have ${values} at character level ${characterLevel}`)
  }
  if (notSet.length > 0) {
    const names = notSet.map((a) => ABILITY_NAMES[a]).join(' and ')
    parts.push(`${names} ${notSet.length > 1 ? 'are' : 'is'} not set yet`)
  }
  return parts.join('; ')
}

/**
 * Check multiclass ability-score prerequisites. In both editions a new class needs the
 * prerequisites of the new class and of the current ones, met when the new class is
 * taken; later increases do not count. `entries` holds, per class index, the scores
 * that class was taken with. A class is checked when it is taken, and the first class
 * when the second one is. An ability still to be assigned (`unset`) does not count as
 * met, and the flag says so.
 */
export function checkMulticlass(
  classes: ClassRef[],
  requirementsBySource: Map<string, MulticlassRequirements | undefined>,
  entries: readonly ClassEntryScores[],
  unset: UnsetAbilities = NONE_UNSET,
): Deviation[] {
  if (classes.length <= 1) return []
  const deviations: Deviation[] = []
  classes.forEach((cls, i) => {
    const key = `${cls.name}|${cls.source}`
    const req = requirementsBySource.get(key)
    const at = entries[Math.max(i, 1)]
    if (req && !meetsRequirements(req, at.totals, unset)) {
      deviations.push({
        id: `multiclass-req:${key}`,
        category: 'multiclass-req',
        message: `${cls.name} needs ${describeRequirements(req)} to multiclass, ${describeShortfall(req, at, unset)} - allowed with DM approval.`,
      })
    }
  })
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

/** Increases in words: "+2 Constitution, +1 Strength"; "none" when there are none. */
function increasesText(increases: AbilityIncreases): string {
  const parts = ABILITIES.filter((k) => (increases[k] ?? 0) !== 0).map(
    (k) => `${formatMod(increases[k] ?? 0)} ${ABILITY_NAMES[k]}`,
  )
  return parts.length > 0 ? parts.join(', ') : 'none'
}

/** One origin's increases as entered: the given ones and the placed ones. */
interface OriginEntry {
  name: string
  options: AbilityOption[]
  optionIndex: number | undefined
  /** The increases stored as given outright; undefined when the origin keeps none apart. */
  fixed: AbilityIncreases | undefined
  choices: AbilityIncreases
}

/** The abilities where the entered increases are not what the origin's option allows. */
function offAbilities(entry: OriginEntry): { option?: AbilityOption; off: AbilityKey[] } {
  const option = entry.options[entry.optionIndex ?? 0] ?? entry.options[0]
  const valid = option ? validChoices(option, entry.choices) : {}
  const off = ABILITIES.filter((k) => {
    const placed = entry.choices[k] ?? 0
    if (placed !== 0 && valid[k] !== placed) return true
    return entry.fixed !== undefined && (entry.fixed[k] ?? 0) !== (option?.fixed[k] ?? 0)
  })
  return { option, off }
}

function checkOrigin(id: string, entry: OriginEntry): Deviation[] {
  const { option, off } = offAbilities(entry)
  if (off.length === 0) return []
  const entered: AbilityIncreases = {}
  for (const k of ABILITIES) {
    const sum = (entry.fixed?.[k] ?? 0) + (entry.choices[k] ?? 0)
    if (sum !== 0) entered[k] = sum
  }
  const allowed = option
    ? `allows ${describeAbilityOption(option)}`
    : 'gives no ability score increases'
  return [
    {
      id,
      category: 'origin-increase',
      message: `${entry.name} ${allowed}; you entered ${increasesText(entered)} - allowed with DM approval.`,
      abilities: off,
    },
  ]
}

/**
 * Check the ability score increases of the species and the background against what each
 * allows: the increases given outright, the ones the player places ("choose N from"), and,
 * for a 2024 background, that none raises a score above 20 (the 2024 Player's Handbook,
 * Choose a Background; the rule is not in the data). An off increase still counts.
 */
export function checkOriginIncreases(
  character: Character,
  race: PlayableRace | undefined,
  background: PlayableBackground | undefined,
): Deviation[] {
  const deviations: Deviation[] = []
  const raceRef = character.race
  if (race && raceRef) {
    deviations.push(
      ...checkOrigin('origin-increase:race', {
        name: race.name,
        options: race.abilityOptions,
        optionIndex: raceRef.abilityOption,
        fixed: raceRef.abilityFixed,
        choices: raceRef.abilityChoices,
      }),
    )
  }
  const bgRef = character.background
  if (background && bgRef) {
    deviations.push(
      ...checkOrigin('origin-increase:background', {
        name: background.name,
        options: background.abilityOptions,
        optionIndex: bgRef.abilityOption,
        fixed: undefined,
        choices: bgRef.abilityChoices,
      }),
    )
    if (background.edition === 'one') {
      const over = ABILITIES.filter((k) => {
        const base = character.abilities[k].base
        const raised = bgRef.abilityChoices[k] ?? 0
        return base !== null && raised > 0 && base + raised > ABILITY_SCORE_MAX
      })
      if (over.length > 0) {
        const scores = over
          .map((k) => {
            const base = character.abilities[k].base ?? 0
            const raised = bgRef.abilityChoices[k] ?? 0
            return `${ABILITY_NAMES[k]} would be ${base + raised} (${base} ${formatMod(raised)})`
          })
          .join(', ')
        deviations.push({
          id: 'ability-cap:background',
          category: 'ability-cap',
          message: `${background.name}'s increases cannot raise a score above ${ABILITY_SCORE_MAX}; ${scores} - allowed with DM approval.`,
          abilities: over,
        })
      }
    }
  }
  return deviations
}
