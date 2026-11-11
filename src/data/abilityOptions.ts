// Ability score increases, as the data grants them.
//
// A race, background or feat lists its increases as blocks, and each block is one
// way to take them: the player picks a block when there are several. A block
// gives some increases outright and lets the player place others ("+2 to one
// ability score and +1 to another"). This is the one reading of those blocks.

import { ABILITIES, ABILITY_NAMES, formatMod, type AbilityKey } from '../dice/dice'

/** Increases by ability. */
export type AbilityIncreases = Partial<Record<AbilityKey, number>>

/** The most an ability score can be raised to, unless an option says otherwise. */
export const ABILITY_SCORE_MAX = 20

/** One way to take a grant's ability score increases. */
export interface AbilityOption {
  /** Increases given outright. */
  fixed: AbilityIncreases
  /** Increases the player places, each on a different ability out of `from`. */
  amounts: number[]
  from: AbilityKey[]
  /** A higher most the score can reach (an epic boon: 30); unset is `ABILITY_SCORE_MAX`. */
  max?: number
  /** A restriction the book prints on the choice, to show beside it. */
  note?: string
}

/** The abilities named in a list from the data, in the usual order. */
function abilityKeys(from: unknown): AbilityKey[] {
  return Array.isArray(from) ? ABILITIES.filter((k) => from.includes(k)) : []
}

interface ChooseBlock {
  from?: unknown
  count?: number
  amount?: number
  entry?: unknown
  weighted?: { from?: unknown; weights?: unknown }
}

function parseOption(raw: unknown): AbilityOption | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const block = raw as Record<string, unknown>
  const fixed: AbilityIncreases = {}
  for (const k of ABILITIES) {
    const value = block[k]
    if (typeof value === 'number') fixed[k] = value
  }

  let from: AbilityKey[] = []
  let amounts: number[] = []
  const choose = block.choose as ChooseBlock | undefined
  if (choose && typeof choose === 'object') {
    if (choose.weighted) {
      // "+2 and +1": the amounts are listed, largest first.
      const weights = choose.weighted.weights
      from = abilityKeys(choose.weighted.from)
      amounts = Array.isArray(weights)
        ? weights.filter((w): w is number => typeof w === 'number')
        : []
    } else {
      // "+1 to two": the same amount, `count` times. No list means any ability.
      from = choose.from === undefined ? [...ABILITIES] : abilityKeys(choose.from)
      amounts = Array.from({ length: choose.count ?? 1 }, () => choose.amount ?? 1)
    }
  }
  // Each placed increase needs an ability of its own.
  amounts = amounts.slice(0, from.length).sort((a, b) => b - a)

  if (Object.keys(fixed).length === 0 && amounts.length === 0) return undefined
  const option: AbilityOption = { fixed, amounts, from }
  if (typeof block.max === 'number') option.max = block.max
  if (typeof choose?.entry === 'string') option.note = choose.entry
  return option
}

/** The ways to take a grant's increases, from its `ability` blocks. */
export function parseAbilityOptions(blocks: unknown[] | undefined): AbilityOption[] {
  return (blocks ?? []).flatMap((block) => parseOption(block) ?? [])
}

/** The placed amounts as runs of the same amount: `[2, 1, 1]` is one +2 and two +1. */
export function amountGroups(option: AbilityOption): { amount: number; count: number }[] {
  const groups: { amount: number; count: number }[] = []
  for (const amount of option.amounts) {
    const last = groups.at(-1)
    if (last?.amount === amount) last.count += 1
    else groups.push({ amount, count: 1 })
  }
  return groups
}

/** " (up to 30)" for an option that lets a score go past the usual most; else nothing. */
const capNote = (option: AbilityOption) =>
  option.max !== undefined && option.max !== ABILITY_SCORE_MAX
    ? ` (up to ${option.max})`
    : ''

/** The abilities given outright, in the usual order. */
const fixedKeys = (option: AbilityOption) =>
  ABILITIES.filter((k) => option.fixed[k] !== undefined)

/** Whether the placed increases may go on any ability the option does not already raise. */
function fromIsTheRest(option: AbilityOption): boolean {
  const fixed = new Set<AbilityKey>(fixedKeys(option))
  return (
    fixed.size > 0 &&
    option.from.length === ABILITIES.length - fixed.size &&
    option.from.every((k) => !fixed.has(k))
  )
}

const NUMBER_WORDS: Record<number, string> = {
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
}
const word = (n: number) => NUMBER_WORDS[n] ?? String(n)

function everyAbilityBy(option: AbilityOption): number | undefined {
  const values = ABILITIES.map((k) => option.fixed[k])
  const first = values[0]
  return first !== undefined && values.every((v) => v === first) ? first : undefined
}

/**
 * An option in a sentence, for the place where the player picks between options:
 * "+2 Charisma, +1 to two other ability scores".
 */
export function describeAbilityOption(option: AbilityOption): string {
  const parts: string[] = []
  const all = everyAbilityBy(option)
  if (all !== undefined) parts.push(`${formatMod(all)} to every ability score`)
  else
    parts.push(
      ...fixedKeys(option).map(
        (k) => `${formatMod(option.fixed[k] ?? 0)} ${ABILITY_NAMES[k]}`,
      ),
    )

  const any = option.from.length === ABILITIES.length
  const rest = fromIsTheRest(option)
  const placed = amountGroups(option).map(({ amount, count }, i) => {
    let target: string
    if (i > 0) target = count === 1 ? 'another' : `${word(count)} others`
    else if (any)
      target = count === 1 ? 'one ability score' : `${word(count)} ability scores`
    else if (rest)
      target =
        count === 1 ? 'one other ability score' : `${word(count)} other ability scores`
    else {
      const names = option.from.map((k) => ABILITY_NAMES[k])
      target = count === 1 ? names.join(' or ') : `${word(count)} of ${names.join(', ')}`
    }
    return `${formatMod(amount)} to ${target}`
  })
  if (placed.length > 0) parts.push(placed.join(' and '))
  return parts.join(', ') + capNote(option)
}

/** An option in a few characters, for a table cell: "CHA +2; +1, +1 to others". */
function summarizeOption(option: AbilityOption): string {
  const parts: string[] = []
  const all = everyAbilityBy(option)
  if (all !== undefined) parts.push(`All ${formatMod(all)}`)
  else {
    const fixed = fixedKeys(option).map(
      (k) => `${k.toUpperCase()} ${formatMod(option.fixed[k] ?? 0)}`,
    )
    if (fixed.length > 0) parts.push(fixed.join(', '))
  }
  if (option.amounts.length > 0) {
    const amounts = option.amounts.map(formatMod).join(', ')
    const target =
      option.from.length === ABILITIES.length
        ? 'any'
        : fromIsTheRest(option)
          ? 'others'
          : option.from
              .map((k) => k.toUpperCase())
              .join(option.amounts.length === 1 ? ' or ' : ', ')
    parts.push(`${amounts} to ${target}`)
  }
  return parts.join('; ') + capNote(option)
}

/** Every way to take a grant's increases, short enough for a table cell. */
export function summarizeAbilityOptions(options: AbilityOption[]): string {
  // Options that only place increases, all on the same abilities, name those
  // abilities once: "INT, WIS, CHA: +2, +1 or +1, +1, +1".
  const [first] = options
  const names = (o: AbilityOption) => o.from.map((k) => k.toUpperCase()).join(', ')
  if (
    options.length > 1 &&
    options.every(
      (o) =>
        Object.keys(o.fixed).length === 0 &&
        o.amounts.length > 0 &&
        names(o) === names(first),
    )
  ) {
    const target = first.from.length === ABILITIES.length ? 'any' : names(first)
    return `${target}: ${options.map((o) => o.amounts.map(formatMod).join(', ') + capNote(o)).join(' or ')}`
  }
  return options.map(summarizeOption).join(' / ')
}

/**
 * The player's placed increases that the option allows: an ability it offers, at
 * an amount it gives, and no more of an amount than it gives.
 */
export function validChoices(
  option: AbilityOption,
  choices: AbilityIncreases,
): AbilityIncreases {
  const left = new Map(amountGroups(option).map((g) => [g.amount, g.count]))
  const valid: AbilityIncreases = {}
  for (const k of option.from) {
    const amount = choices[k]
    const room = amount === undefined ? 0 : (left.get(amount) ?? 0)
    if (amount === undefined || room === 0) continue
    valid[k] = amount
    left.set(amount, room - 1)
  }
  return valid
}

/** Every increase an option gives for the player's placed choices, fixed ones included. */
export function optionIncreases(
  option: AbilityOption,
  choices: AbilityIncreases,
): AbilityIncreases {
  const placed = validChoices(option, choices)
  const total: AbilityIncreases = {}
  for (const k of ABILITIES) {
    const sum = (option.fixed[k] ?? 0) + (placed[k] ?? 0)
    if (option.fixed[k] !== undefined || placed[k] !== undefined) total[k] = sum
  }
  return total
}

/** How many of an option's placed increases are still to be placed. */
export function increasesLeft(option: AbilityOption, choices: AbilityIncreases): number {
  return option.amounts.length - Object.keys(validChoices(option, choices)).length
}

/**
 * Put an increase of `amount` on an ability, or take it back off when it is
 * already there. An ability holds one placed increase, so placing a second moves
 * it. When every increase of that amount is placed, a single one moves to the new
 * ability; with several, one must be taken off first (nothing changes).
 */
export function toggleIncrease(
  option: AbilityOption,
  choices: AbilityIncreases,
  amount: number,
  ability: AbilityKey,
): AbilityIncreases {
  const next = validChoices(option, choices)
  if (next[ability] === amount) {
    delete next[ability]
    return next
  }
  if (!option.from.includes(ability)) return next
  const room = option.amounts.filter((a) => a === amount).length
  const holders = option.from.filter((k) => next[k] === amount)
  if (holders.length >= room) {
    if (room !== 1) return next
    delete next[holders[0]]
  }
  next[ability] = amount
  return next
}
