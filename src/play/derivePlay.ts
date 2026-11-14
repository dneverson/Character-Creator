// The play state read against the build: the current hit points, the hit dice and the slots
// that are left. The play state keeps what was spent, never what is left, so a change of the
// build (a lower maximum, a new level, a lost slot level) needs no code of its own: a spent
// count above the new total reads as all spent, and the stored number stays as it was.

import type { PlayState } from '../character/model'
import type { DerivedSheet } from '../derived'
import { BASE_SOURCE, quantity, type Line, type Quantity } from '../derived/types'
import { DEATH_SAVE_LIMIT } from './actions'

export interface Pool {
  total: number
  /** Spent, never more than the total. */
  spent: number
  left: number
}

export interface HitDicePool extends Pool {
  faces: number
  /** The key in the play state: "d8". */
  die: string
}

export interface SlotPool extends Pool {
  /** The spell level, 1 to 9. */
  level: number
}

/** A limited-use counter's uses: what the derived sheet allows, less what was spent. */
export interface UsePool extends Pool {
  /** The resource's id: the key of `PlayState.uses`. */
  id: string
}

export interface PactPool extends Pool {
  /** The level every Pact Magic slot is cast at. */
  level: number
}

/** `conscious` above 0 hit points; at 0 `dying`, `stable` after three saves, `dead` after three failures. */
export type DeathState = 'conscious' | 'dying' | 'stable' | 'dead'

export interface DerivedPlay {
  /** The hit points now: the maximum less the damage taken, from 0 up. */
  currentHp: Quantity
  maxHp: number
  hitDice: HitDicePool[]
  /** Only the spell levels the character has slots of. */
  slots: SlotPool[]
  pact?: PactPool
  /** The limited-use counters with a maximum; an unlimited one keeps no count. */
  uses: UsePool[]
  deathState: DeathState
}

const pool = (total: number, spentRaw: number): Pool => {
  const spent = Math.max(0, Math.min(spentRaw, total))
  return { total, spent, left: total - spent }
}

export function derivePlay(
  sheet: Pick<DerivedSheet, 'hp' | 'hitDice' | 'slots' | 'resources'>,
  play: PlayState,
): DerivedPlay {
  const maxHp = Math.max(0, sheet.hp.value)
  const taken = Math.min(play.damage, maxHp)
  const lines: Line[] = [
    {
      id: 'hp|current|max',
      label: 'Maximum',
      source: BASE_SOURCE,
      op: 'base',
      status: 'applied',
      amount: maxHp,
    },
    {
      id: 'hp|current|damage',
      label: 'Damage taken',
      source: BASE_SOURCE,
      op: 'add',
      status: 'applied',
      amount: -taken,
    },
    ...(play.tempHp > 0
      ? [
          {
            id: 'hp|current|temp',
            label: 'Temporary hit points',
            source: BASE_SOURCE,
            op: 'note',
            status: 'applied',
            how: `${play.tempHp} more, taken first and not counted here`,
          } satisfies Line,
        ]
      : []),
  ]
  const currentHp = quantity(lines)
  const { successes, failures } = play.deathSaves
  const deathState: DeathState =
    failures >= DEATH_SAVE_LIMIT
      ? 'dead'
      : currentHp.value > 0
        ? 'conscious'
        : successes >= DEATH_SAVE_LIMIT
          ? 'stable'
          : 'dying'
  return {
    currentHp,
    maxHp,
    hitDice: sheet.hitDice.map((d) => {
      const die = `d${d.faces}`
      return { faces: d.faces, die, ...pool(d.count.value, play.hitDiceSpent[die] ?? 0) }
    }),
    slots: sheet.slots.standard.flatMap((total, index) =>
      total > 0
        ? [{ level: index + 1, ...pool(total, play.slotsSpent[index] ?? 0) }]
        : [],
    ),
    pact: sheet.slots.pact && {
      level: sheet.slots.pact.level,
      ...pool(sheet.slots.pact.slots, play.pactSpent),
    },
    uses: sheet.resources.flatMap((r) =>
      r.max === undefined ? [] : [{ id: r.id, ...pool(r.max, play.uses[r.id] ?? 0) }],
    ),
    deathState,
  }
}
