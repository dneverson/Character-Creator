// Initiative and the passive scores: each a Quantity of the lines it adds up from, so the
// sheet and the PDF show one number and the player can see where it comes from. The rules
// that change them are the rows of rules/combatRules. An item's bonus to ability checks
// (Stone of Good Luck) counts in initiative, every skill and every passive alike.

import { abilityMod, formatMod, type AbilityKey } from '../dice/dice'
import type { SkillRow } from '../character/skills'
import type { Edition } from '../data/edition'
import {
  INITIATIVE_RULES,
  PASSIVE_EDGE,
  PASSIVE_EDGE_RULES,
  PASSIVE_RULES,
  PASSIVE_SKILLS,
  type InitiativeRule,
  type PassiveSkill,
} from '../rules/combatRules'
import type { AbilityTotals } from './armorClass'
import { itemBonus } from './itemBonus'
import { heldBy, type Sources } from './sources'
import { BASE_SOURCE, quantity, type Line, type Quantity } from './types'

export const INITIATIVE_MANUAL = 'initiative|manual'

const MANUAL_SOURCE = { kind: 'manual', tag: 'manual', label: '' } as const

export interface PassiveRow {
  key: PassiveSkill
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

const ONCE = 'Advantage or disadvantage counts once, however many give it.'
const CANCEL = 'Advantage and disadvantage cancel each other out.'

/** Whether a line of a passive score is advantage or disadvantage on its checks. */
export const isEdgeLine = (line: Line) => line.id.includes('|edge|')

/**
 * The passive score's lines with its advantage and disadvantage settled as for a roll: one
 * of a kind counts, the others show as not counted, and one of each cancels both. Run again
 * whenever a line of advantage or disadvantage is added (a condition in play).
 */
export function settleEdges(lines: readonly Line[]): Line[] {
  const restored = lines.map((l): Line => {
    if (!isEdgeLine(l) || (l.why !== ONCE && l.why !== CANCEL)) return l
    const { why: _why, ...rest } = l
    return { ...rest, status: 'applied' }
  })
  const counted = restored.filter((l) => isEdgeLine(l) && l.status === 'applied')
  const both =
    counted.some((l) => (l.amount ?? 0) > 0) && counted.some((l) => (l.amount ?? 0) < 0)
  const first = new Set(
    both
      ? []
      : [
          counted.find((l) => (l.amount ?? 0) > 0),
          counted.find((l) => (l.amount ?? 0) < 0),
        ],
  )
  return restored.map((l): Line => {
    if (!counted.includes(l) || first.has(l)) return l
    return { ...l, status: 'inactive', why: both ? CANCEL : ONCE }
  })
}

/** A line of advantage (+5) or disadvantage (-5) on the checks of a passive score. */
export function edgeLine(
  edition: Edition,
  key: PassiveSkill,
  edge: 'advantage' | 'disadvantage',
  line: Pick<Line, 'label' | 'source' | 'text' | 'status' | 'when' | 'why'>,
): Line {
  const rule = PASSIVE_EDGE[edition]
  return {
    ...line,
    id: `passive|${key}|edge|${line.source.tag}|${line.label}`,
    amount: edge === 'advantage' ? rule.amount : -rule.amount,
    op: 'add',
    how: `${edge === 'advantage' ? 'Advantage' : 'Disadvantage'} on the check. ${rule.text}`,
  }
}

/** The advantage and disadvantage on the checks of a passive score the character has. */
function edgeLines(sources: Sources, key: PassiveSkill, edition: Edition): Line[] {
  return PASSIVE_EDGE_RULES.flatMap((rule): Line[] => {
    const found = rule.skills.includes(key) ? heldBy(sources, rule.holder) : undefined
    if (!found) return []
    const state: Pick<Line, 'status' | 'when' | 'why'> =
      found.active === false
        ? { status: 'inactive', why: 'Needs attunement, and you are not attuned.' }
        : rule.when
          ? { status: 'conditional', when: rule.when }
          : { status: 'applied' }
    return [
      edgeLine(edition, key, rule.edge, {
        label: rule.label,
        source: found.source,
        text: rule.text,
        ...state,
      }),
    ]
  })
}

export function passives(
  sources: Sources,
  rows: SkillRow[],
  prof: number,
  edition: Edition,
): PassiveRow[] {
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
      ...edgeLines(sources, key, edition),
    )
    return [{ key, label: row.label, score: quantity(settleEdges(lines)) }]
  })
}

export function combatNumbers(
  sources: Sources,
  totals: AbilityTotals,
  rows: SkillRow[],
  prof: number,
  edition: Edition,
): CombatNumbers {
  return {
    initiative: initiative(sources, totals, prof),
    passives: passives(sources, rows, prof, edition),
  }
}
