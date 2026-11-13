// Initiative and the passive scores: each a Quantity of the lines it adds up from, so the
// sheet and the PDF show one number and the player can see where it comes from. The rules
// that change them are the rows of rules/combatRules. An item's bonus to ability checks
// (Stone of Good Luck) counts in initiative, every skill and every passive alike.

import { abilityMod, formatMod, type AbilityKey } from '../dice/dice'
import type { SkillRow } from '../character/skills'
import {
  INITIATIVE_RULES,
  PASSIVE_RULES,
  PASSIVE_SKILLS,
  type InitiativeRule,
} from '../rules/combatRules'
import type { AbilityTotals } from './armorClass'
import { itemBonus } from './itemBonus'
import { heldBy, type Sources } from './sources'
import { BASE_SOURCE, quantity, type Line, type Quantity } from './types'

export const INITIATIVE_MANUAL = 'initiative|manual'

const MANUAL_SOURCE = { kind: 'manual', tag: 'manual', label: '' } as const

export interface PassiveRow {
  key: string
  label: string
  score: Quantity
}

export interface CombatNumbers {
  initiative: Quantity
  passives: PassiveRow[]
}

/** Half the proficiency bonus, by the rule's rounding. */
const half = (prof: number, round: 'down' | 'up') =>
  round === 'up' ? Math.ceil(prof / 2) : Math.floor(prof / 2)

/** The rules of a table that the character holds, with where each comes from. */
function held<T extends { holder: InitiativeRule['holder'] }>(
  sources: Sources,
  rules: readonly T[],
) {
  return rules.flatMap((rule) => {
    const found = heldBy(sources, rule.holder)
    return found ? [{ rule, source: found.source }] : []
  })
}

/** A half-proficiency bonus the character holds, before it is judged against the check. */
export interface HalfRule {
  id: string
  label: string
  text: string
  source: Line['source']
  amount: number
}

/**
 * The half-proficiency bonuses (Jack of All Trades, Remarkable Athlete) the character
 * holds that apply to a check of this ability (any ability when none is named): Jack of
 * All Trades to every check, Remarkable Athlete to Strength, Dexterity and Constitution.
 */
export function halfRules(
  sources: Sources,
  prof: number,
  idPrefix: string,
  ability?: AbilityKey,
): HalfRule[] {
  return held(sources, INITIATIVE_RULES).flatMap(({ rule, source }) => {
    const e = rule.effect
    if (e.kind !== 'half') return []
    if (
      e.checks === 'strDexCon' &&
      ability !== undefined &&
      !PHYSICAL.includes(ability)
    ) {
      return []
    }
    return [
      {
        id: `${idPrefix}|${source.tag}|${rule.label}`,
        label: rule.label,
        text: rule.text,
        source,
        amount: half(prof, e.round),
      },
    ]
  })
}

const PHYSICAL: readonly AbilityKey[] = ['str', 'dex', 'con']

/**
 * The half-proficiency bonuses to a check the character is not proficient in: only the
 * larger counts, and none when the proficiency bonus is already added.
 */
export function halfLines(rules: HalfRule[], proficient: boolean): Line[] {
  const best = rules.reduce<number>((max, r) => Math.max(max, r.amount), 0)
  let used = false
  return rules.map((r): Line => {
    const base = {
      id: r.id,
      label: r.label,
      source: r.source,
      amount: r.amount,
      op: 'add' as const,
      text: r.text,
    }
    if (proficient) {
      return {
        ...base,
        status: 'inactive',
        why: 'You already add your proficiency bonus.',
      }
    }
    if (r.amount === best && !used) {
      used = true
      return { ...base, status: 'applied' }
    }
    return { ...base, status: 'inactive', why: 'Half-proficiency bonuses do not stack.' }
  })
}

export function initiative(
  sources: Sources,
  totals: AbilityTotals,
  prof: number,
): Quantity {
  const lines: Line[] = [
    {
      id: 'initiative|dex',
      label: 'Dexterity',
      source: BASE_SOURCE,
      amount: abilityMod(totals.dex),
      op: 'base',
      status: 'applied',
      how: `Dexterity ${formatMod(abilityMod(totals.dex))}`,
    },
  ]
  const rules = held(sources, INITIATIVE_RULES)
  let proficient = false
  const halves: Parameters<typeof halfLines>[0] = []
  for (const { rule, source } of rules) {
    const id = `initiative|${source.tag}|${rule.label}`
    const e = rule.effect
    const base = { id, label: rule.label, source, op: 'add' as const, text: rule.text }
    if (e.kind === 'flat') lines.push({ ...base, amount: e.amount, status: 'applied' })
    else if (e.kind === 'ability') {
      lines.push({ ...base, amount: abilityMod(totals[e.ability]), status: 'applied' })
    } else if (e.kind === 'proficiency') {
      proficient = true
      lines.push({ ...base, amount: prof, status: 'applied' })
    } else if (e.kind === 'half') {
      halves.push({ ...base, amount: half(prof, e.round) })
    } else {
      lines.push({
        ...base,
        op: 'note',
        status: 'conditional',
        when: 'on the roll',
        how: 'Advantage on the roll',
      })
    }
  }
  lines.push(...halfLines(halves, proficient))
  // Initiative is a Dexterity check.
  lines.push(...itemCheckLines(sources, 'initiative'))
  lines.push({
    id: INITIATIVE_MANUAL,
    label: 'Other bonus',
    source: MANUAL_SOURCE,
    op: 'add',
    status: 'applied',
    badge: 'Manual',
    amount: sources.character.manualBonuses?.initiative ?? 0,
  })
  return quantity(lines)
}

/**
 * The bonus of each item the character holds to ability checks, one line per item: an
 * item that needs attunement counts only when attuned.
 */
export function itemCheckLines(sources: Sources, idPrefix: string): Line[] {
  return sources.items.flatMap((held): Line[] => {
    const amount = itemBonus(held.item, 'bonusAbilityCheck')
    if (amount === 0) return []
    const line = {
      id: `${idPrefix}|item|${held.item.key}`,
      label: held.item.name,
      source: held.source,
      amount,
      op: 'add' as const,
      how: `${formatMod(amount)} to ability checks`,
    }
    return [
      held.active
        ? { ...line, status: 'applied' }
        : {
            ...line,
            status: 'inactive',
            why: 'Needs attunement, and you are not attuned.',
          },
    ]
  })
}

export function passives(sources: Sources, rows: SkillRow[], prof: number): PassiveRow[] {
  const rules = held(sources, PASSIVE_RULES)
  return PASSIVE_SKILLS.flatMap((key) => {
    const row = rows.find((r) => r.key === key)
    if (!row) return []
    const lines: Line[] = [
      {
        id: `passive|${key}|base`,
        label: 'Base',
        source: BASE_SOURCE,
        amount: 10,
        op: 'base',
        status: 'applied',
      },
      {
        id: `passive|${key}|skill`,
        label: `${row.label} modifier`,
        source: BASE_SOURCE,
        amount: row.modifier,
        op: 'add',
        status: 'applied',
        how: row.proficient ? 'With proficiency' : 'Without proficiency',
      },
    ]
    for (const { rule, source } of rules) {
      if (!rule.skills.includes(key)) continue
      lines.push({
        id: `passive|${key}|${source.tag}|${rule.label}`,
        label: rule.label,
        source,
        amount: rule.amount,
        op: 'add',
        status: 'applied',
        text: rule.text,
      })
    }
    lines.push(
      ...halfLines(
        halfRules(sources, prof, `passive|${key}`, row.ability),
        row.proficient,
      ),
      ...itemCheckLines(sources, `passive|${key}`),
    )
    return [{ key, label: row.label, score: quantity(lines) }]
  })
}

export function combatNumbers(
  sources: Sources,
  totals: AbilityTotals,
  rows: SkillRow[],
  prof: number,
): CombatNumbers {
  return {
    initiative: initiative(sources, totals, prof),
    passives: passives(sources, rows, prof),
  }
}
