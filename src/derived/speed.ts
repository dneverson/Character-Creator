// Walking speed as a Quantity: the species' speed and what adds to it (a feat, Fast
// Movement, Unarmored Movement, an item such as Boots of Striding and Springing). The
// other ways of moving a species or an item gives (fly, swim, climb) are notes: they have
// a speed of their own and do not add to the walking one.

import { modeText, speedDistance, walkingSpeed } from '../data/labels'
import { ITEM_SPEED_WHEN, SPEED_RULES, type SpeedRule } from '../rules/speedRules'
import { heldBy, type HeldItem, type Sources } from './sources'
import { quantity, sumLines, type Line, type Quantity } from './types'

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

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** Whether an item's speed is in force: needing attunement, or an action, or neither. */
function itemState(held: HeldItem): Pick<Line, 'status' | 'when' | 'why'> {
  if (!held.active) {
    return { status: 'inactive', why: 'Needs attunement, and you are not attuned.' }
  }
  const when = ITEM_SPEED_WHEN[held.item.key]
  return when ? { status: 'conditional', when } : { status: 'applied' }
}

/**
 * What the equipped items do to the speeds, after the walking speed of the lines so far:
 * a bonus to every speed or to walking, a walking speed that becomes a number unless it is
 * higher, a walking speed multiplied, and a speed of another way of moving (its own number,
 * or equal to the walking speed) as a note.
 */
function itemLines(sources: Sources, before: Line[]): Line[] {
  const lines: Line[] = []
  const walk = () => sumLines([...before, ...lines])
  const changes = sources.items.flatMap((held) =>
    held.item.speed ? [{ held, change: held.item.speed, state: itemState(held) }] : [],
  )
  const base = (held: HeldItem, part: string) => ({
    id: `speed|item|${held.item.key}|${part}`,
    label: held.item.name,
    source: held.source,
  })
  for (const { held, change, state } of changes) {
    const bonus = change.bonus.walk ?? change.bonus['*']
    if (bonus !== undefined) {
      const how = change.bonus.walk === undefined ? 'every speed' : 'walking speed'
      lines.push({
        ...base(held, 'bonus'),
        amount: bonus,
        op: 'add',
        how: `${bonus} ft. to ${how}`,
        ...state,
      })
    }
    const floor = change.static.walk
    if (floor !== undefined) {
      const amount = Math.max(0, floor - walk())
      lines.push({
        ...base(held, 'static'),
        amount,
        op: 'add',
        how: `Becomes ${floor} ft. unless higher`,
        ...(state.status === 'applied' && amount === 0
          ? {
              status: 'inactive',
              why: `Your walking speed is already ${floor} ft. or more.`,
            }
          : state),
      })
    }
  }
  for (const { held, change, state } of changes) {
    const times = change.multiply.walk
    if (times === undefined) continue
    lines.push({
      ...base(held, 'multiply'),
      amount: walk() * (times - 1),
      op: 'add',
      how: `Walking speed times ${times}`,
      ...state,
    })
  }
  for (const { held, change, state } of changes) {
    const modes = new Set(
      [change.static, change.equal, change.multiply].flatMap((part) => Object.keys(part)),
    )
    for (const mode of modes) {
      if (mode === 'walk' || mode === '*') continue
      const equal = change.equal[mode] === 'walk'
      const times = change.multiply[mode]
      const own = change.static[mode] ?? (equal ? walk() : undefined)
      const feet = own === undefined ? undefined : own * (times ?? 1)
      lines.push({
        ...base(held, mode),
        label:
          feet === undefined
            ? `${capital(mode)} speed times ${times}`
            : capital(modeText(mode, feet, undefined)),
        op: 'note',
        ...(equal
          ? {
              how:
                times === undefined
                  ? 'Equal to your walking speed'
                  : `Walking speed times ${times}`,
            }
          : {}),
        ...state,
      })
    }
  }
  return lines
}

/**
 * A character with no species has no speed, so the quantity has no lines: a bonus such as
 * Unarmored Movement adds to the species' walking speed and is nothing on its own.
 */
export function speedQuantity(sources: Sources): Quantity {
  const race = sources.race
  const speed = race?.speed
  if (!race || speed === undefined) return quantity([])
  const source = { kind: 'race' as const, tag: 'race', label: race.name }
  const lines: Line[] = [
    {
      id: 'speed|race',
      label: 'Walking speed',
      source,
      amount: walkingSpeed(speed),
      op: 'base',
      status: 'applied',
    },
  ]
  if (typeof speed === 'object') {
    for (const [mode, value] of Object.entries(speed)) {
      if (mode === 'walk' || mode === 'canHover') continue
      const text = modeText(mode, value, speedDistance(speed.walk))
      if (!text) continue
      lines.push({
        id: `speed|mode|${mode}`,
        label: capital(text),
        source,
        op: 'note',
        status: 'applied',
      })
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
  lines.push(...itemLines(sources, lines))
  return quantity(lines)
}
