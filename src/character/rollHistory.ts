// The player's roll browser: back and forward through the rolls of a stream
// without losing any of them.
//
// The rolls are not kept apart. They are entries of the character's history (see
// history.ts), and these helpers read them back out of it. A roll that is refined
// after it was made (a matrix line picked, a gauntlet slot rerolled, a pool
// regrouped) is recorded again under the same id, so the history keeps every
// step while the browser shows each roll once, as it stands now.

import type {
  Character,
  HistoryAction,
  HistoryEntry,
  RollCursors,
  RollRecord,
  RollStream,
} from './model'

/**
 * A distributive Omit so the discriminated RollRecord union keeps every member
 * (a plain Omit over a union collapses to only the shared keys).
 */
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never

/** A roll about to be made: everything but its id and time, which `newRoll` gives it. */
export type NewRoll = DistributiveOmit<RollRecord, 'id' | 'at'>

/**
 * Most recent rolls of a stream the browser offers. The history itself keeps
 * every roll; this only bounds the list the player steps through.
 */
export const ROLL_HISTORY_LIMIT = 50

/** A roll made now. Called from an event handler, never during render. */
export function newRoll(roll: NewRoll): RollRecord {
  return { ...roll, id: crypto.randomUUID(), at: Date.now() }
}

/** The action that records a roll, new or refined, with an edit. */
export function rollAction(roll: RollRecord): HistoryAction {
  return { type: 'roll', roll }
}

/**
 * The rolls of one stream, oldest first, each as it stands now: its place is
 * that of the first time it was recorded, its content that of the last.
 */
export function rollRecords(
  history: readonly HistoryEntry[],
  stream: RollStream,
): RollRecord[] {
  const latest = new Map<string, RollRecord>()
  for (const { action } of history) {
    if (action?.type === 'roll' && action.roll.stream === stream) {
      latest.set(action.roll.id, action.roll)
    }
  }
  return [...latest.values()].slice(-ROLL_HISTORY_LIMIT)
}

/** The roll in use in a stream, as it stands now, or null when there is none. */
export function activeRoll(character: Character, stream: RollStream): RollRecord | null {
  const id = character.rollCursors[stream] ?? null
  if (!id) return null
  for (let at = character.history.length - 1; at >= 0; at--) {
    const action = character.history[at].action
    if (action?.type === 'roll' && action.roll.id === id) return action.roll
  }
  return null
}

/**
 * The roll cursors with one stream pointed at a roll (when the player applies
 * one they browsed to), or at none with `null` (a fresh pool that has not yet
 * earned its entry). Recording a roll points its stream at it by itself.
 */
export function withCursor(
  character: Character,
  stream: RollStream,
  id: string | null,
): RollCursors {
  return { ...character.rollCursors, [stream]: id }
}
