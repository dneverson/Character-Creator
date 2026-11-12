// Walking speed as a Quantity: the species' speed and what adds to it (a feat, Fast
// Movement, Unarmored Movement). The other ways of moving a species has (fly, swim,
// climb) are notes: they have a speed of their own and do not add to the walking one.

import { modeText, speedDistance, walkingSpeed } from '../data/labels'
import { SPEED_RULES, type SpeedRule } from '../rules/speedRules'
import { heldBy, type Sources } from './sources'
import { quantity, type Line, type Quantity } from './types'

/** The bonus a rule gives at this class level (0 before its first step). */
function amountAt(rule: SpeedRule, classLevel: number): number {
  if (typeof rule.amount === 'number') return rule.amount
  return rule.amount.reduce(
    (best, [level, feet]) => (classLevel >= level ? feet : best),
    0,
  )
}

/** What the character wears that the rule does not allow, when anything. */
function worn(sources: Sources, limit: SpeedRule['without']): string | undefined {
  if (!limit) return undefined
  for (const { item } of sources.items) {
    const kind = item.armor?.class
    if (limit === 'heavyArmor' && kind === 'heavy') return 'heavy armor'
    if (limit === 'anyArmor' && kind) return kind === 'shield' ? 'a shield' : 'armor'
  }
  return undefined
}

/** A character with no species has no speed, so the quantity has no lines. */
export function speedQuantity(sources: Sources): Quantity {
  const lines: Line[] = []
  const race = sources.race
  const speed = race?.speed
  if (race && speed !== undefined) {
    const source = { kind: 'race' as const, tag: 'race', label: race.name }
    lines.push({
      id: 'speed|race',
      label: 'Walking speed',
      source,
      amount: walkingSpeed(speed),
      op: 'base',
      status: 'applied',
    })
    if (typeof speed === 'object') {
      for (const [mode, value] of Object.entries(speed)) {
        if (mode === 'walk' || mode === 'canHover') continue
        const text = modeText(mode, value, speedDistance(speed.walk))
        if (!text) continue
        lines.push({
          id: `speed|mode|${mode}`,
          label: text.charAt(0).toUpperCase() + text.slice(1),
          source,
          op: 'note',
          status: 'applied',
        })
      }
    }
  }
  for (const rule of SPEED_RULES) {
    const held = heldBy(sources, rule.holder)
    if (!held) continue
    const base = {
      id: `speed|${held.source.tag}|${rule.label}`,
      label: rule.label,
      source: held.source,
      op: 'add' as const,
      text: rule.text,
      amount: amountAt(rule, held.classLevel ?? 0),
    }
    const blocked = worn(sources, rule.without)
    lines.push(
      blocked
        ? { ...base, status: 'inactive', why: `You are wearing ${blocked}.` }
        : { ...base, status: 'applied' },
    )
  }
  return quantity(lines)
}
