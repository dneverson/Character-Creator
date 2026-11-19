// The dice roller: expressions like "2d6+3" or "4d6kh3", and the d20 test with advantage
// or disadvantage. Every result carries each die it rolled, so the sheet can show how a
// total came to be. The random source is a parameter, so a test can supply the dice.

import { appConfig } from '../config/app'
import { randomInt } from './dice'

/** Gives a roll of one die: a whole number from 1 to `sides`. */
export type Rng = (sides: number) => number

/** The random source of the app: the browser's crypto, without bias (see `randomInt`). */
export const cryptoRng: Rng = (sides) => randomInt(1, sides)

export type RollMode = 'normal' | 'advantage' | 'disadvantage'

/** One term of an expression: a number of dice, or a flat number. */
export type Term =
  | {
      kind: 'dice'
      sign: 1 | -1
      count: number
      sides: number
      /** Keep only the highest ("kh3") or lowest ("kl1") of the dice rolled. */
      keep?: { which: 'highest' | 'lowest'; count: number }
    }
  | { kind: 'flat'; sign: 1 | -1; value: number }

/** The dice of one dice term as rolled. */
export interface DiceRolled {
  sign: 1 | -1
  sides: number
  /** Every die rolled, in order. */
  rolls: number[]
  /** The places in `rolls` of the dice that do not count (the lower die of an advantage). */
  dropped: number[]
  /** These dice are the situational bonus, not the expression itself ("+1d4" of Bless). */
  bonus?: true
  /**
   * For the damage of a critical hit: the dice from this place on are the extra ones the
   * critical added, so the result can show and label them.
   */
  extraFrom?: number
  /** Damage: what kind of damage these dice are ("fire"); absent when untyped. */
  type?: string
}

/** What a roll came to, with every die that went into it. */
export interface RollOutcome {
  /** The expression rolled, in its plain form ("1d20+5"). */
  expression: string
  mode: RollMode
  dice: DiceRolled[]
  /** The flat numbers of the expression added up, with their signs. */
  modifier: number
  total: number
  /** The situational bonus that went into the roll, as typed plainly: "+1d4", "-1". */
  bonus?: string
  /** The number the kept d20 showed, when it was a natural 20 or a natural 1. */
  natural?: 20 | 1
  /** The dice were doubled: damage from a critical hit. */
  critical?: true
  /** Damage of several types: what each type came to, in the order rolled. */
  typed?: { type: string; total: number }[]
}

/** An expression that cannot be rolled; the message says why in plain words. */
export class RollParseError extends Error {}

const TERM = /^([+-])?(?:(\d*)d(\d+)(?:k([hl])(\d*))?|(\d+))$/

/** What an expression looks like, for the message that says one is not a roll. */
const EXAMPLE = '2d6+3'

function parseTerm(text: string, example: string): Term {
  const found = TERM.exec(text)
  if (!found) throw new RollParseError(`"${text}" is not a roll. Try ${example}.`)
  const [, sign, count, sides, which, keepCount, flat] = found
  const signed = sign === '-' ? -1 : 1
  if (flat !== undefined) return { kind: 'flat', sign: signed, value: Number(flat) }
  const { maxCount, maxSides } = appConfig.dice
  const n = count === '' ? 1 : Number(count)
  const faces = Number(sides)
  if (n < 1 || n > maxCount) {
    throw new RollParseError(`Roll 1 to ${maxCount} dice at a time.`)
  }
  if (faces < 2 || faces > maxSides) {
    throw new RollParseError(`A die has 2 to ${maxSides} sides.`)
  }
  const kept = keepCount === '' || keepCount === undefined ? 1 : Number(keepCount)
  if (which !== undefined && (kept < 1 || kept > n)) {
    throw new RollParseError(`Keep between 1 and ${n} of the dice.`)
  }
  return {
    kind: 'dice',
    sign: signed,
    count: n,
    sides: faces,
    ...(which !== undefined && {
      keep: {
        which: which === 'h' ? ('highest' as const) : ('lowest' as const),
        count: kept,
      },
    }),
  }
}

/**
 * The terms of an expression ("2d6 + 3", "d20-1", "4d6kh3"), or a `RollParseError`.
 * `example` is the roll the message offers when the text is not one.
 */
export function parseExpression(text: string, example = EXAMPLE): Term[] {
  const plain = text
    .trim()
    .toLowerCase()
    .replace(/\s*([+-])\s*/g, '$1')
  if (plain === '') throw new RollParseError(`Type a roll, for example ${example}.`)
  if (/\s/.test(plain))
    throw new RollParseError(`"${text.trim()}" is not a roll. Try ${example}.`)
  const pieces = plain.split(/(?=[+-])/)
  if (pieces.length > appConfig.dice.maxTerms) {
    throw new RollParseError(`Use at most ${appConfig.dice.maxTerms} parts in one roll.`)
  }
  return pieces.map((piece) => parseTerm(piece, example))
}

/** What the player may type as a situational bonus, in the message that corrects it. */
const BONUS_EXAMPLE = '+2 or +1d4'

/**
 * The terms of a situational bonus ("+2", "-1", "+1d4"); none when nothing is typed. A
 * bonus is flat numbers and plain dice, so a keep rule ("kh") is not one.
 */
export function parseBonus(text: string): Term[] {
  if (text.trim() === '') return []
  const terms = parseExpression(text, BONUS_EXAMPLE)
  if (terms.some((term) => term.kind === 'dice' && term.keep)) {
    throw new RollParseError(`A bonus is a number or dice, like ${BONUS_EXAMPLE}.`)
  }
  return terms
}

/** An expression written out plainly: "2d6+3", "4d6kh3-1". */
export function termsText(terms: readonly Term[]): string {
  return terms
    .map((term, at) => {
      const sign = term.sign === -1 ? '-' : at === 0 ? '' : '+'
      if (term.kind === 'flat') return `${sign}${term.value}`
      const keep = term.keep
        ? `k${term.keep.which === 'highest' ? 'h' : 'l'}${term.keep.count}`
        : ''
      return `${sign}${term.count}d${term.sides}${keep}`
    })
    .join('')
}

/** The places of the dice a keep rule leaves out: all but the highest or lowest few. */
function droppedBy(
  rolls: number[],
  keep: { which: 'highest' | 'lowest'; count: number },
) {
  const order = rolls
    .map((value, at) => ({ value, at }))
    .sort((a, b) => (keep.which === 'highest' ? b.value - a.value : a.value - b.value))
  return order
    .slice(keep.count)
    .map((die) => die.at)
    .sort((a, b) => a - b)
}

function rollTerm(
  term: Term & { kind: 'dice' },
  rng: Rng,
  doubled: boolean,
  bonus: boolean,
): DiceRolled {
  const factor = doubled ? 2 : 1
  const rolls = Array.from({ length: term.count * factor }, () => rng(term.sides))
  const dropped = term.keep
    ? droppedBy(rolls, { ...term.keep, count: term.keep.count * factor })
    : []
  return {
    sign: term.sign,
    sides: term.sides,
    rolls,
    dropped,
    ...(bonus && { bonus: true as const }),
    ...(doubled && { extraFrom: term.count }),
  }
}

/** The bonus as text with its sign: "+1d4", "-1". */
const bonusText = (bonus: readonly Term[]) => {
  const text = termsText(bonus)
  return text.startsWith('-') ? text : `+${text}`
}

/** What the dice and the flat numbers add up to. */
function outcomeOf(
  terms: readonly Term[],
  dice: DiceRolled[],
  extra: Partial<RollOutcome> & { mode: RollMode },
): RollOutcome {
  const modifier = terms.reduce(
    (sum, term) => (term.kind === 'flat' ? sum + term.sign * term.value : sum),
    0,
  )
  const counted = dice.reduce(
    (sum, group) =>
      sum +
      group.sign *
        group.rolls.reduce((s, die, at) => (group.dropped.includes(at) ? s : s + die), 0),
    0,
  )
  return {
    expression: termsText(terms),
    dice,
    modifier,
    total: counted + modifier,
    ...extra,
  }
}

/** The number the d20 of a d20 test showed (the kept one), without any bonus. */
export function naturalOf(outcome: RollOutcome): number {
  const [d20] = outcome.dice
  return d20.rolls.find((_, at) => !d20.dropped.includes(at)) ?? 0
}

/**
 * Rolls an expression, and the situational `bonus` with it. With `critical` the dice are
 * doubled, the bonus dice too, and the flat numbers are not (the rule for the damage of a
 * critical hit in both editions).
 */
export function rollExpression(
  text: string,
  rng: Rng = cryptoRng,
  critical = false,
  bonus: readonly Term[] = [],
): RollOutcome {
  const terms = parseExpression(text)
  const rollAll = (list: readonly Term[], isBonus: boolean) =>
    list.flatMap((term) =>
      term.kind === 'dice' ? [rollTerm(term, rng, critical, isBonus)] : [],
    )
  return outcomeOf(
    [...terms, ...bonus],
    [...rollAll(terms, false), ...rollAll(bonus, true)],
    {
      mode: 'normal',
      ...(bonus.length > 0 && { bonus: bonusText(bonus) }),
      ...(critical && { critical: true as const }),
    },
  )
}

/**
 * The flat number of an expression that is one d20 and nothing else but flat numbers
 * ("d20+5"), so it can be rolled as a d20 test; null for any other expression.
 */
export function d20Modifier(text: string): number | null {
  const terms = parseExpression(text)
  const [head, ...rest] = terms
  if (head.kind !== 'dice' || head.sign !== 1 || head.sides !== 20 || head.count !== 1) {
    return null
  }
  if (head.keep) return null
  return rest.every((term) => term.kind === 'flat')
    ? rest.reduce(
        (sum, term) => sum + (term.kind === 'flat' ? term.sign * term.value : 0),
        0,
      )
    : null
}

/**
 * A d20 test: one d20, the modifier and the situational `bonus`. With advantage or
 * disadvantage two d20 are rolled and the higher or the lower counts (the first of two
 * equal dice).
 */
export function rollD20(
  modifier: number,
  mode: RollMode = 'normal',
  rng: Rng = cryptoRng,
  bonus: readonly Term[] = [],
): RollOutcome {
  const rolls = Array.from({ length: mode === 'normal' ? 1 : 2 }, () => rng(20))
  const kept =
    mode === 'disadvantage'
      ? rolls.indexOf(Math.min(...rolls))
      : rolls.indexOf(Math.max(...rolls))
  const dropped = rolls.flatMap((_, at) => (at === kept ? [] : [at]))
  const natural = rolls[kept] === 20 ? 20 : rolls[kept] === 1 ? 1 : undefined
  const terms: Term[] = [{ kind: 'dice', sign: 1, count: 1, sides: 20 }]
  if (modifier !== 0) {
    terms.push({ kind: 'flat', sign: modifier < 0 ? -1 : 1, value: Math.abs(modifier) })
  }
  const bonusDice = bonus.flatMap((term) =>
    term.kind === 'dice' ? [rollTerm(term, rng, false, true)] : [],
  )
  return outcomeOf(
    [...terms, ...bonus],
    [{ sign: 1, sides: 20, rolls, dropped }, ...bonusDice],
    {
      mode,
      ...(bonus.length > 0 && { bonus: bonusText(bonus) }),
      ...(natural && { natural }),
    },
  )
}

/** One part of a damage roll: its dice and flat numbers, and the type of damage. */
export interface RollPiece {
  expression: string
  /** "fire", "healing"; "" when untyped. */
  type: string
}

/**
 * Rolls the parts of one damage or healing roll, each with its own type, as one outcome:
 * every die carries its type and `typed` says what each type came to. The situational
 * `bonus` goes with the first part. With `critical` the dice of every part are doubled.
 */
export function rollPieces(
  pieces: readonly RollPiece[],
  rng: Rng = cryptoRng,
  critical = false,
  bonus: readonly Term[] = [],
): RollOutcome {
  const rolled = pieces.map((piece, at) => ({
    piece,
    outcome: rollExpression(piece.expression, rng, critical, at === 0 ? bonus : []),
  }))
  const typed = rolled.some(({ piece }) => piece.type !== '')
  return {
    expression: rolled.map(({ outcome }) => outcome.expression).join('+'),
    mode: 'normal',
    dice: rolled.flatMap(({ piece, outcome }) =>
      outcome.dice.map((group) => (piece.type ? { ...group, type: piece.type } : group)),
    ),
    modifier: rolled.reduce((sum, { outcome }) => sum + outcome.modifier, 0),
    total: rolled.reduce((sum, { outcome }) => sum + outcome.total, 0),
    ...(bonus.length > 0 && { bonus: bonusText(bonus) }),
    ...(critical && { critical: true as const }),
    ...(typed && {
      typed: rolled.map(({ piece, outcome }) => ({
        type: piece.type,
        total: outcome.total,
      })),
    }),
  }
}
