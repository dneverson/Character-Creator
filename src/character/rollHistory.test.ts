import { describe, expect, it } from 'vitest'
import { edited } from './history'
import {
  createCharacter,
  type Character,
  type MatrixRollRecord,
  type RollRecord,
} from './model'
import {
  ROLL_HISTORY_LIMIT,
  activeRoll,
  newRoll,
  rollAction,
  rollRecords,
  withCursor,
} from './rollHistory'

const statRoll = (scores: number[]) =>
  newRoll({
    stream: 'ability',
    kind: 'stat-pool',
    config: { dice: 4, rerolls: 0 },
    scores,
  })
const hitRoll = (rolls: number[]) => newRoll({ stream: 'hitDie', kind: 'hit-die', rolls })

/** A character with each roll recorded in turn, as the editor records them. */
const withRolls = (rolls: RollRecord[], character: Character = createCharacter()) =>
  rolls.reduce((c, roll) => edited(c, {}, rollAction(roll)), character)

describe('newRoll', () => {
  it('gives a roll its own id and the time it was made', () => {
    const a = statRoll([15, 14])
    const b = statRoll([15, 14])
    expect(a).toMatchObject({ stream: 'ability', kind: 'stat-pool', scores: [15, 14] })
    expect(a.id).not.toBe(b.id)
    expect(a.at).toEqual(expect.any(Number))
  })
})

describe('a recorded roll', () => {
  it('is in the history and is the roll in use in its stream', () => {
    const roll = statRoll([15, 14])
    const c = withRolls([roll])
    expect(rollRecords(c.history, 'ability')).toEqual([roll])
    expect(c.rollCursors.ability).toBe(roll.id)
    expect(activeRoll(c, 'ability')).toBe(roll)
  })

  it('keeps streams independent', () => {
    const stat = statRoll([10])
    const hit = hitRoll([8])
    const c = withRolls([stat, hit])
    expect(c.rollCursors).toEqual({ ability: stat.id, hitDie: hit.id })
    expect(rollRecords(c.history, 'ability')).toEqual([stat])
    expect(rollRecords(c.history, 'hitDie')).toEqual([hit])
    expect(activeRoll(createCharacter(), 'hitDie')).toBeNull()
  })

  it('keeps the rolls on story tables in their own stream, each roll a record', () => {
    const tableRoll = (values: number[], rows: number[]) =>
      newRoll({
        stream: 'story',
        kind: 'table',
        background: 'Acolyte|PHB',
        table: 'personality trait',
        die: 8,
        values,
        rows,
      })
    const first = tableRoll([3, 3, 5], [2, 4])
    // A reroll is a roll of its own, so the rolls on a table can be counted.
    const reroll = tableRoll([1, 7], [0, 6])
    const stat = statRoll([12])
    const c = withRolls([first, stat, reroll])
    expect(rollRecords(c.history, 'story')).toEqual([first, reroll])
    expect(rollRecords(c.history, 'ability')).toEqual([stat])
    expect(c.rollCursors.story).toBe(reroll.id)
  })

  it('does not remove earlier rolls', () => {
    const a = statRoll([10])
    const b = statRoll([12])
    const c = withRolls([a, b])
    expect(rollRecords(c.history, 'ability').map((r) => r.id)).toEqual([a.id, b.id])
  })

  it('offers the latest of a stream to browse, and keeps every roll in the history', () => {
    const hit = hitRoll([5])
    const first = statRoll([1])
    const more = Array.from({ length: ROLL_HISTORY_LIMIT }, (_, i) => statRoll([i]))
    const c = withRolls([hit, first, ...more])

    const ability = rollRecords(c.history, 'ability')
    expect(ability).toHaveLength(ROLL_HISTORY_LIMIT)
    // The very first ability roll is past the browser's reach, not gone.
    expect(ability.map((r) => r.id)).not.toContain(first.id)
    expect(
      c.history.some((e) => e.action?.type === 'roll' && e.action.roll.id === first.id),
    ).toBe(true)
    expect(rollRecords(c.history, 'hitDie')).toEqual([hit])
  })
})

describe('withCursor', () => {
  it('points a stream at an earlier roll without touching rolls or other streams', () => {
    const a = statRoll([10])
    const b = statRoll([12])
    const hit = hitRoll([6])
    const c = withRolls([a, b, hit])
    const browsed = edited(c, { rollCursors: withCursor(c, 'ability', a.id) })

    expect(browsed.rollCursors).toEqual({ ability: a.id, hitDie: hit.id })
    expect(activeRoll(browsed, 'ability')).toBe(a)
    // Looking at an earlier roll is not something done to the character.
    expect(browsed.history).toBe(c.history)
  })

  it('points a stream at no roll when given null', () => {
    const a = statRoll([10])
    const c = withRolls([a])
    const cleared = { ...c, rollCursors: withCursor(c, 'ability', null) }
    expect(cleared.rollCursors.ability).toBeNull()
    expect(activeRoll(cleared, 'ability')).toBeNull()
    expect(rollRecords(cleared.history, 'ability')).toEqual([a])
  })

  it('finds no roll in use when the cursor names one that is not recorded', () => {
    const c = { ...createCharacter(), rollCursors: { ability: 'gone' } }
    expect(activeRoll(c, 'ability')).toBeNull()
  })
})

describe('a roll refined after it was made', () => {
  const matrix: MatrixRollRecord = {
    id: 'm1',
    at: 1,
    stream: 'ability',
    kind: 'matrix',
    scores: [[10]],
    line: null,
  }
  const picked: MatrixRollRecord = { ...matrix, line: { kind: 'row', index: 0 } }

  it('shows once, in its first place, as it stands now', () => {
    const later = statRoll([9])
    const c = withRolls([matrix, later, picked])
    expect(rollRecords(c.history, 'ability')).toEqual([picked, later])
    expect(activeRoll(c, 'ability')).toBe(picked)
  })

  it('keeps every step in the history', () => {
    const c = withRolls([matrix, picked])
    const steps = c.history.flatMap((e) =>
      e.action?.type === 'roll' ? [e.action.roll] : [],
    )
    expect(steps).toEqual([matrix, picked])
  })
})
