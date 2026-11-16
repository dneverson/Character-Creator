// The speeds as Quantities. Walking: the species' speed and what adds to it (a feat, Fast
// Movement, Unarmored Movement, an item such as Boots of Striding and Springing) or takes
// from it (armor too heavy for the character's Strength). Each other way of moving (fly,
// swim, climb, burrow) is a speed of its own, from the species, an item, or a feature,
// feat or option of rules/speedRules; one equal to the walking speed follows the final
// walking speed, so what changes walking (play effects too) changes it once, there.

import { totalLevel } from '../character/derive'
import type { Edition } from '../data/edition'
import { walkingSpeed, type SpeedValue } from '../data/labels'
import {
  ARMOR_STRENGTH,
  ARMOR_STRENGTH_EXEMPT,
  ITEM_SPEED_WHEN,
  MOVE_MODES,
  MOVE_RULES,
  RACE_MOVE_LIMITS,
  SPEED_RULES,
  type MoveMode,
  type SpeedLimit,
  type SpeedRule,
} from '../rules/speedRules'
import { heldOptionEffects, speedEffectLines } from './optionEffects'
import { heldBy, type HeldItem, type Sources } from './sources'
import { quantity, sumLines, type Line, type Quantity, type SourceRef } from './types'

/** A speed of a way of moving other than walking. */
export interface SpeedRow {
  mode: MoveMode
  /** "Fly", what the breakdown names it by. */
  label: string
  speed: Quantity
  /** The speed in use lets the character hover. */
  hover: boolean
  /** The speed in use is the walking speed (times a number), which already has every change. */
  equalsWalk: boolean
  /** The lines equal to the walking speed, with the multiple: worked out again in play. */
  follows: Readonly<Record<string, number>>
  /** The lines whose speed lets the character hover. */
  hovers: readonly string[]
}

const SLOWER = 'A faster speed of this kind is used.'
const IN_WALK = 'Already in the walking speed this speed equals.'
const NONE = 'You have no speed of this kind in force.'

/** The bonus a rule gives at this class level (0 before its first step). */
function amountAt(rule: SpeedRule, classLevel: number): number {
  if (typeof rule.amount === 'number') return rule.amount
  return rule.amount.reduce(
    (best, [level, feet]) => (classLevel >= level ? feet : best),
    0,
  )
}

/** What the character wears that the rule does not allow, when anything. */
function worn(sources: Sources, limit: SpeedLimit | undefined): string | undefined {
  if (!limit) return undefined
  for (const { item } of sources.items) {
    const kind = item.armor?.class
    if (limit === 'heavyArmor' && kind === 'heavy') return 'heavy armor'
    if (limit === 'mediumOrHeavyArmor' && (kind === 'medium' || kind === 'heavy')) {
      return `${kind} armor`
    }
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

const speedItems = (sources: Sources) =>
  sources.items.flatMap((held) =>
    held.item.speed ? [{ held, change: held.item.speed, state: itemState(held) }] : [],
  )

const itemBase = (held: HeldItem, part: string) => ({
  id: `speed|item|${held.item.key}|${part}`,
  label: held.item.name,
  source: held.source,
})

/**
 * What the equipped items do to the walking speed, after the lines so far: a bonus to
 * every speed or to walking, a walking speed that becomes a number unless it is higher, and
 * a walking speed multiplied.
 */
function itemLines(sources: Sources, before: Line[]): Line[] {
  const lines: Line[] = []
  const walk = () => sumLines([...before, ...lines])
  const changes = speedItems(sources)
  for (const { held, change, state } of changes) {
    const bonus = change.bonus.walk ?? change.bonus['*']
    if (bonus !== undefined) {
      const how = change.bonus.walk === undefined ? 'every speed' : 'walking speed'
      lines.push({
        ...itemBase(held, 'bonus'),
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
        ...itemBase(held, 'static'),
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
      ...itemBase(held, 'multiply'),
      amount: walk() * (times - 1),
      op: 'add',
      how: `Walking speed times ${times}`,
      ...state,
    })
  }
  return lines
}

/**
 * The slowdown of each worn armor whose Strength requirement the character's Strength
 * score does not meet, or what spares the character it. Flagged by the rules, never
 * blocked: the armor stays worn.
 */
function armorStrengthLines(
  sources: Sources,
  strength: number,
  edition: Edition,
): Line[] {
  const rule = ARMOR_STRENGTH[edition]
  const exempt = ARMOR_STRENGTH_EXEMPT.find((row) => {
    if (!heldBy(sources, row.holder)) return false
    const holder = row.holder
    return (
      !('item' in holder) ||
      sources.items.some((i) => i.item.key === holder.item && i.active)
    )
  })
  return sources.items.flatMap((held): Line[] => {
    const need = held.item.armor?.strength
    if (need === undefined || held.item.armor?.class === 'shield' || strength >= need) {
      return []
    }
    const line = {
      id: `speed|armor-strength|${held.item.key}`,
      label: held.item.name,
      source: held.source,
      amount: -rule.feet,
      op: 'add' as const,
      how: `Needs Strength ${need}, you have ${strength}`,
      text: rule.text,
    }
    return [
      exempt
        ? { ...line, status: 'inactive', why: exempt.text }
        : { ...line, status: 'applied' },
    ]
  })
}

/**
 * A character with no species has no speed, so the quantity has no lines: a bonus such as
 * Unarmored Movement adds to the species' walking speed and is nothing on its own.
 */
export function speedQuantity(
  sources: Sources,
  strength: number,
  edition: Edition,
): Quantity {
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
  lines.push(...speedEffectLines(sources, heldOptionEffects(sources)))
  lines.push(...armorStrengthLines(sources, strength, edition))
  lines.push(...itemLines(sources, lines))
  return quantity(lines)
}

const restored = (line: Line): Line =>
  line.why === SLOWER || line.why === IN_WALK || line.why === NONE
    ? { ...line, status: 'applied', why: undefined }
    : line

/**
 * The speed of one way of moving from every line that gives or changes it: the lines equal
 * to the walking speed take `walk` (times their multiple), the fastest speed in force is
 * used, and what adds to a speed (a bonus to every speed, the armor slowdown) counts only on
 * a speed of its own number: one equal to the walking speed has it already. Play effects
 * call it again with the walking speed they leave.
 */
export function moveRow(
  mode: MoveMode,
  given: readonly Line[],
  follows: Readonly<Record<string, number>>,
  hovers: readonly string[],
  walk: number,
): SpeedRow {
  const lines = given.map((l) =>
    restored(l.id in follows ? { ...l, amount: walk * follows[l.id] } : l),
  )
  const best = Math.max(
    ...lines
      .filter((l) => l.op === 'base' && l.status === 'applied')
      .map((l) => l.amount ?? 0),
  )
  const chosen = lines.find(
    (l) => l.op === 'base' && l.status === 'applied' && l.amount === best,
  )
  const equalsWalk = chosen !== undefined && chosen.id in follows
  const picked = lines.map((l): Line => {
    if (l.status !== 'applied' || l === chosen) return l
    if (l.op === 'base') return { ...l, status: 'inactive', why: SLOWER }
    if (l.op !== 'add') return l
    if (!chosen) return { ...l, status: 'inactive', why: NONE }
    return equalsWalk ? { ...l, status: 'inactive', why: IN_WALK } : l
  })
  return {
    mode,
    label: capital(mode),
    speed: quantity(picked),
    hover: chosen !== undefined && hovers.includes(chosen.id),
    equalsWalk,
    follows,
    hovers,
  }
}

/** A speed of the species' data: its own number, or equal to walking (`true`). */
function raceMove(value: SpeedValue): { feet?: number; when?: string } | undefined {
  if (value === true) return {}
  if (typeof value === 'number') return value > 0 ? { feet: value } : undefined
  if (typeof value === 'object' && 'number' in value) {
    return { feet: value.number, ...(value.condition ? { when: value.condition } : {}) }
  }
  return undefined
}

const WALK_HOW = (times: number) =>
  times === 1 ? 'Equal to your walking speed' : `Walking speed times ${times}`

/**
 * The speeds of the other ways of moving, each from the species, the items and the rules
 * that give or change it, after the walking speed (`walk`) they may equal.
 */
export function moveSpeeds(
  sources: Sources,
  walk: Quantity,
  strength: number,
  edition: Edition,
): SpeedRow[] {
  const race = sources.race
  if (!race || race.speed === undefined) return []
  const given = new Map<MoveMode, Line[]>(MOVE_MODES.map((m) => [m, []]))
  const follows: Record<string, number> = {}
  const hovers: string[] = []
  const add = (mode: MoveMode, line: Line, times?: number, hover?: boolean) => {
    given.get(mode)?.push(line)
    if (times !== undefined) follows[line.id] = times
    if (hover) hovers.push(line.id)
  }
  const isMode = (mode: string): mode is MoveMode =>
    (MOVE_MODES as readonly string[]).includes(mode)

  const raceSource: SourceRef = { kind: 'race', tag: 'race', label: race.name }
  if (typeof race.speed === 'object') {
    const hover = race.speed.canHover === true
    for (const [mode, value] of Object.entries(race.speed)) {
      const move = isMode(mode) ? raceMove(value) : undefined
      if (!move || !isMode(mode)) continue
      const limit = RACE_MOVE_LIMITS.find(
        (l) => l.mode === mode && heldBy(sources, l.holder),
      )
      const blocked = worn(sources, limit?.without)
      const line: Line = {
        id: `speed|${mode}|race`,
        label: race.name,
        source: raceSource,
        amount: move.feet ?? 0,
        op: 'base',
        ...(move.feet === undefined ? { how: WALK_HOW(1) } : {}),
        ...(limit ? { text: limit.text } : {}),
        ...(blocked
          ? { status: 'inactive', why: `You are wearing ${blocked}.` }
          : move.when
            ? { status: 'conditional', when: move.when }
            : { status: 'applied' }),
      }
      add(mode, line, move.feet === undefined ? 1 : undefined, mode === 'fly' && hover)
    }
  }

  for (const { held, change, state } of speedItems(sources)) {
    for (const mode of MOVE_MODES) {
      const equal = change.equal[mode] === 'walk'
      const times = change.multiply[mode]
      const own = change.static[mode]
      const base = { ...itemBase(held, mode), ...state }
      if (own === undefined && !equal) {
        if (times !== undefined) {
          add(mode, {
            ...base,
            label: `${capital(mode)} speed times ${times}`,
            op: 'note',
          })
        }
        continue
      }
      add(
        mode,
        {
          ...base,
          op: 'base',
          amount: (own ?? 0) * (times ?? 1),
          ...(equal ? { how: WALK_HOW(times ?? 1) } : {}),
        },
        equal ? (times ?? 1) : undefined,
      )
    }
    const bonus = change.bonus['*']
    if (bonus === undefined) continue
    for (const mode of MOVE_MODES) {
      add(mode, {
        ...itemBase(held, `${mode}|bonus`),
        amount: bonus,
        op: 'add',
        how: `${bonus} ft. to every speed`,
        ...state,
      })
    }
  }

  const level = totalLevel(sources.character)
  for (const rule of MOVE_RULES) {
    const held = heldBy(sources, rule.holder)
    if (!held || (held.classLevel ?? level) < (rule.fromLevel ?? 0)) continue
    const blocked = worn(sources, rule.without)
    const amount = rule.amount
    const bonus = typeof amount === 'object'
    const line: Line = {
      id: `speed|${rule.mode}|${held.source.tag}|${rule.label}`,
      label: rule.label,
      source: held.source,
      text: rule.text,
      op: bonus ? 'add' : 'base',
      amount: bonus ? amount.bonus : amount === 'walk' ? 0 : amount,
      ...(amount === 'walk' ? { how: WALK_HOW(rule.times ?? 1) } : {}),
      ...(blocked
        ? { status: 'inactive', why: `You are wearing ${blocked}.` }
        : rule.when
          ? { status: 'conditional', when: rule.when }
          : { status: 'applied' }),
    }
    add(rule.mode, line, amount === 'walk' ? (rule.times ?? 1) : undefined, rule.hover)
  }

  // Armor too heavy for the character slows every speed, as it slows walking.
  const slowdown = armorStrengthLines(sources, strength, edition)
  return MOVE_MODES.flatMap((mode) => {
    const lines = given.get(mode) ?? []
    if (!lines.some((l) => l.op === 'base' || l.op === 'note')) return []
    const all = [
      ...lines,
      ...slowdown.map((l) => ({ ...l, id: l.id.replace('speed|', `speed|${mode}|`) })),
    ]
    return [moveRow(mode, all, follows, hovers, walk.value)]
  })
}
