// What the player does in play, as pure functions on the play state. Each one returns the
// new state and never blocks: a value the rules would not give is clamped to what is
// possible, and a player can always set a value by hand.

import type { PlayState } from '../character/model'

/** The most exhaustion levels there are in either edition (the sixth is death). */
export const MAX_EXHAUSTION = 6
/** Successes or failures of a death saving throw needed to settle it. */
export const DEATH_SAVE_LIMIT = 3

const between = (n: number, low: number, high: number) =>
  Math.max(low, Math.min(high, Math.trunc(n)))

/** Hit points lost, never past the maximum (a stored value can outlast a lowered maximum). */
const lost = (play: PlayState, max: number) => Math.min(play.damage, Math.max(0, max))

/**
 * Damage taken: temporary hit points go first, then real ones. At 0 hit points each hit is
 * a failed death save, and damage left over from the drop that is the maximum or more kills
 * outright (both editions).
 */
export function damage(play: PlayState, amount: number, max: number): PlayState {
  const hit = Math.max(0, Math.trunc(amount))
  if (hit === 0) return play
  const absorbed = Math.min(play.tempHp, hit)
  const through = hit - absorbed
  const next: PlayState = { ...play, tempHp: play.tempHp - absorbed }
  if (through === 0) return next
  const before = lost(play, max)
  const total = before + through
  next.damage = Math.min(total, Math.max(0, max))
  const failures = play.deathSaves.failures
  if (before >= max) {
    next.deathSaves = {
      ...play.deathSaves,
      failures: Math.min(DEATH_SAVE_LIMIT, failures + 1),
    }
  } else if (total - max >= max) {
    next.deathSaves = { ...play.deathSaves, failures: DEATH_SAVE_LIMIT }
  }
  return next
}

/** Healing: it restores real hit points only, and a character brought up from 0 is no longer dying. */
export function heal(play: PlayState, amount: number, max: number): PlayState {
  const healed = Math.max(0, Math.trunc(amount))
  if (healed === 0) return play
  const before = lost(play, max)
  const next: PlayState = { ...play, damage: Math.max(0, before - healed) }
  if (before >= max && next.damage < max) {
    next.deathSaves = { successes: 0, failures: 0 }
  }
  return next
}

/** Temporary hit points gained: they do not add up, so the higher of the two is kept. */
export function gainTemp(play: PlayState, amount: number): PlayState {
  return { ...play, tempHp: Math.max(play.tempHp, Math.max(0, Math.trunc(amount))) }
}

/** Temporary hit points set by hand. */
export function setTempHp(play: PlayState, amount: number): PlayState {
  return { ...play, tempHp: Math.max(0, Math.trunc(amount)) }
}

export type DeathSave = keyof PlayState['deathSaves']

/** Marks the n-th death save (1 to 3); marking the last one marked takes it back. */
export function toggleDeathSave(
  play: PlayState,
  kind: DeathSave,
  nth: number,
): PlayState {
  const marked = play.deathSaves[kind]
  const count = marked === nth ? nth - 1 : between(nth, 0, DEATH_SAVE_LIMIT)
  return { ...play, deathSaves: { ...play.deathSaves, [kind]: count } }
}

/** One spell slot of this level (1 to 9) spent; `total` is what the build gives. */
export function spendSlot(play: PlayState, level: number, total: number): PlayState {
  return setSlotsSpent(play, level, spentOf(play, level, total) + 1, total)
}

/** One spell slot of this level back. */
export function restoreSlot(play: PlayState, level: number, total: number): PlayState {
  return setSlotsSpent(play, level, spentOf(play, level, total) - 1, total)
}

const spentOf = (play: PlayState, level: number, total: number) =>
  between(play.slotsSpent[level - 1] ?? 0, 0, total)

/** The slots spent of one level, set to a count (kept between none and `total`). */
export function setSlotsSpent(
  play: PlayState,
  level: number,
  spent: number,
  total: number,
): PlayState {
  const slots = Array.from({ length: Math.max(level, play.slotsSpent.length) }, (_, i) =>
    i === level - 1 ? between(spent, 0, total) : (play.slotsSpent[i] ?? 0),
  )
  return { ...play, slotsSpent: slots }
}

/** One Pact Magic slot spent; `total` is what the build gives. */
export function spendPact(play: PlayState, total: number): PlayState {
  return { ...play, pactSpent: between(between(play.pactSpent, 0, total) + 1, 0, total) }
}

export function restorePact(play: PlayState, total: number): PlayState {
  return { ...play, pactSpent: between(between(play.pactSpent, 0, total) - 1, 0, total) }
}

/** One hit die of this size ("d8") spent; `total` is how many the build gives. */
export function spendHitDie(play: PlayState, die: string, total: number): PlayState {
  return setHitDiceSpent(play, die, hitDiceSpentOf(play, die, total) + 1, total)
}

export function restoreHitDie(play: PlayState, die: string, total: number): PlayState {
  return setHitDiceSpent(play, die, hitDiceSpentOf(play, die, total) - 1, total)
}

const hitDiceSpentOf = (play: PlayState, die: string, total: number) =>
  between(play.hitDiceSpent[die] ?? 0, 0, total)

export function setHitDiceSpent(
  play: PlayState,
  die: string,
  spent: number,
  total: number,
): PlayState {
  return {
    ...play,
    hitDiceSpent: { ...play.hitDiceSpent, [die]: between(spent, 0, total) },
  }
}

/** A condition put on, or taken off when the character already has it. */
export function toggleCondition(play: PlayState, name: string): PlayState {
  const has = play.conditions.includes(name)
  return {
    ...play,
    conditions: has
      ? play.conditions.filter((c) => c !== name)
      : [...play.conditions, name],
  }
}

/** Exhaustion raised or lowered by a step, between none and the sixth level. */
export function stepExhaustion(play: PlayState, step: number): PlayState {
  return { ...play, exhaustion: between(play.exhaustion + step, 0, MAX_EXHAUSTION) }
}

export function toggleInspiration(play: PlayState): PlayState {
  return { ...play, inspiration: !play.inspiration }
}

/** The spell concentrated on; null ends it. Starting another ends the one before. */
export function setConcentration(
  play: PlayState,
  spell: PlayState['concentration'],
): PlayState {
  return { ...play, concentration: spell }
}
