// What the roll window is asked to roll: a d20 test (a check, a save, an attack, a death
// save) or a free roll, with the tables that say how its number adds up. Each place on the
// sheet that rolls builds one of these from the same quantity it already shows.

import type { PlayState, RollPart } from '../../character/model'
import type { Quantity } from '../../derived/types'
import type { RollOutcome } from '../../dice/roll'
import { tablesOf } from '../derived/breakdownTables'
import type { BreakdownSpec } from '../derived/DerivedNumber'
import type { BreakdownTable } from './SheetDetail'

/** Changes the play state with what a roll came to (a death save marks itself). */
export type PlayEffect = (play: PlayState, outcome: RollOutcome) => PlayState

/** The damage an attack rolls, apart from its to-hit. */
export interface DamageSpec {
  name: string
  /** The dice and the flat bonus: "1d8+3". */
  expression: string
  /** How the damage bonus adds up. */
  tables: BreakdownTable[]
  parts: RollPart[]
}

export interface RollSpec {
  /** A d20 test, or the dice a player typed. */
  kind: 'test' | 'free'
  /** What is rolled, as the window and the log name it: "Stealth check". */
  label: string
  /** The flat number a d20 test adds. */
  modifier: number
  /** How the modifier adds up (the same tables the info buttons open). */
  tables: BreakdownTable[]
  parts: RollPart[]
  damage?: DamageSpec
  effect?: PlayEffect
  /** A free roll: the dice typed. */
  expression?: string
  /** A free roll that is one d20 and flat numbers rolls as a d20 test: the flat number. */
  d20?: number
}

/** The lines of a quantity that are summed into it, as the parts of a roll. */
export function partsOf(quantity: Quantity): RollPart[] {
  return quantity.lines.flatMap((line) =>
    line.status === 'applied' &&
    line.amount !== undefined &&
    (line.op === 'base' || line.op === 'add')
      ? [{ label: line.label, amount: line.amount }]
      : [],
  )
}

/** The roll of a d20 test whose modifier is the number of this breakdown. */
export function testRoll(
  label: string,
  spec: BreakdownSpec,
  rest: Partial<RollSpec> = {},
): RollSpec {
  return {
    kind: 'test',
    label,
    modifier: spec.quantity.value,
    tables: tablesOf(spec),
    parts: partsOf(spec.quantity),
    ...rest,
  }
}
