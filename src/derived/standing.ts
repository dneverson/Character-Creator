// The advantage and disadvantage a standing trait gives (rules/standingRules.ts) as note
// lines of the saving throw or skill they are on. A note is never added to the number: it
// says what a roll is rolled with, and in which case.

import type { AbilityKey } from '../dice/dice'
import { holderId, holderName } from '../rules/holder'
import { STANDING_RULES, type StandingRule } from '../rules/standingRules'
import { heldBy, type Sources } from './sources'
import { BASE_SOURCE, type Line, type SourceRef } from './types'

/** A rule of the table the character holds, with where it comes from. */
export interface HeldStanding {
  rule: StandingRule
  index: number
  source: SourceRef
  /** False for an item that needs attunement the character has not made. */
  active: boolean
}

export function heldStanding(sources: Sources): HeldStanding[] {
  return STANDING_RULES.flatMap((rule, index) => {
    const held = heldBy(sources, rule.holder)
    return held
      ? [{ rule, index, source: held.source, active: held.active !== false }]
      : []
  })
}

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

function noteLine(h: HeldStanding, id: string, roll: string): Line {
  const { rule } = h
  return {
    id: `${id}|${holderId(rule.holder)}|${h.index}`,
    label: holderName(rule.holder),
    source: h.source,
    op: 'note',
    how: `${capitalized(rule.edge)} on the ${roll}`,
    status: !h.active ? 'inactive' : rule.when ? 'conditional' : 'applied',
    ...(rule.when ? { when: rule.when } : {}),
    ...(h.active ? {} : { why: 'Needs attunement, and you are not attuned.' }),
  }
}

/** The notes on the saving throws of one ability. */
export function saveNoteLines(
  held: readonly HeldStanding[],
  ability: AbilityKey,
  id: string,
): Line[] {
  return held
    .filter(({ rule }) => 'save' in rule.scope && rule.scope.save.includes(ability))
    .map((h) => noteLine(h, id, 'saving throw'))
}

/** The notes on the checks of one skill. */
export function checkNoteLines(
  held: readonly HeldStanding[],
  skill: string,
  id: string,
): Line[] {
  return held
    .filter(({ rule }) => 'check' in rule.scope && rule.scope.check.includes(skill))
    .map((h) => noteLine(h, id, 'check'))
}

/** The notes on death saving throws, which have no row of their own: the hit points show them. */
export function deathNoteLines(held: readonly HeldStanding[], id: string): Line[] {
  return held
    .filter(({ rule }) => 'death' in rule.scope)
    .map((h) => noteLine(h, id, 'death saving throw'))
}

/**
 * Heavy armor's disadvantage on Stealth: the armor class already works out whether the armor
 * worn hampers it (Medium Armor Master lifts it for medium armor), so this reads that flag.
 */
export function armorStealthLines(armorLines: readonly Line[]): Line[] {
  const flag = armorLines.find((l) => l.id === 'ac|flag|stealth')
  return flag
    ? [
        {
          id: 'skill|stealth|armor',
          label: flag.label,
          source: BASE_SOURCE,
          op: 'note',
          how: 'Disadvantage on the check',
          status: 'applied',
          ...(flag.why ? { text: flag.why } : {}),
        },
      ]
    : []
}
