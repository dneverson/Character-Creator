// Dice + ability-score generation. Ported from the legacy diceService.js to
// typed TypeScript, with a real point-buy implementation (the legacy stub only
// returned 8s) and matrix "best line" detection.

/** The six ability keys in canonical order. */
export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
export type AbilityKey = (typeof ABILITIES)[number]

export const ABILITY_NAMES: Record<AbilityKey, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
}

/** Ability modifier for a score: floor(score / 2) - 5. */
export function abilityMod(score: number): number {
  return Math.floor(score / 2) - 5
}

/** Format a modifier with an explicit sign, e.g. +3 / -1 / +0. */
export function formatMod(mod: number): string {
  return `${mod >= 0 ? '+' : ''}${mod}`
}

/**
 * Uniform random integer in [min, max] using crypto, with rejection sampling to
 * avoid modulo bias (matches the legacy approach).
 */
export function randomInt(min: number, max: number): number {
  const range = max - min + 1
  const maxUnbiased = Math.floor(256 / range) * range
  const buf = new Uint8Array(1)
  let value: number
  do {
    crypto.getRandomValues(buf)
    value = buf[0]
  } while (value >= maxUnbiased)
  return min + (value % range)
}

/** Roll `count` dice of `sides` sides. */
export function rollDice(count: number, sides: number): number[] {
  return Array.from({ length: count }, () => randomInt(1, sides))
}

/** Keep the `keep` highest values from a set of rolls. */
export function keepHighest(rolls: number[], keep: number): number[] {
  return [...rolls].sort((a, b) => b - a).slice(0, keep)
}

/**
 * Reroll the single lowest die `times` times, in sequence. Each iteration finds
 * the current lowest die (the first one, on a tie) and replaces it with a fresh
 * roll - even if the new value is worse - then re-evaluates for the next pass.
 * Never rerolls two dice at once. Non-mutating: returns a new array.
 */
export function rerollLowest(rolls: number[], sides: number, times: number): number[] {
  const out = [...rolls]
  for (let t = 0; t < times && out.length > 0; t++) {
    let lowest = 0
    for (let i = 1; i < out.length; i++) if (out[i] < out[lowest]) lowest = i
    out[lowest] = randomInt(1, sides)
  }
  return out
}

export function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0)
}

/**
 * A configurable roll: `dice` d6 rolled, the lowest die rerolled `rerolls` times
 * in sequence, then the highest 3 kept. Replaces the old fixed presets.
 */
export interface RollConfig {
  /** Number of d6 to roll (see ROLL_DICE_MIN/MAX). */
  dice: number
  /** How many times to reroll the current-lowest die (see ROLL_REROLLS_MIN/MAX). */
  rerolls: number
}

export const DEFAULT_ROLL_CONFIG: RollConfig = { dice: 3, rerolls: 0 }

// Ability rolls keep the highest 3, so fewer than 3 dice is never valid.
export const ROLL_DICE_MIN = 3
export const ROLL_DICE_MAX = 9
export const ROLL_REROLLS_MIN = 0
export const ROLL_REROLLS_MAX = 9

/** How many dice are kept from a roll config: the highest 3, or all if fewer. */
export const ROLL_KEEP = 3

/** Compact notation for a roll config, e.g. `r4d6 k3 r1`. */
export function rollConfigLabel(config: RollConfig): string {
  return `r${config.dice}d6 k${ROLL_KEEP} r${config.rerolls}`
}

/** Generate one ability score using the given roll config. */
export function rollOneScore(config: RollConfig): number {
  const rolled = rerollLowest(rollDice(config.dice, 6), 6, config.rerolls)
  return sum(keepHighest(rolled, ROLL_KEEP))
}

/** Generate a pool of six ability scores using the given roll config. */
export function rollScorePool(config: RollConfig): number[] {
  return Array.from({ length: 6 }, () => rollOneScore(config))
}

/** Constrain a value to the inclusive range [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Roll one Gauntlet slot (homebrew): a straight 3d6 sum, less a penalty equal to
 * the number of times the slot has already been rerolled (the initial roll has
 * `rerolls` = 0 and no penalty), clamped to the legal ability range [3, 18].
 */
export function rollGauntletSlot(rerolls: number): number {
  return clamp(sum(rollDice(3, 6)) - rerolls, 3, 18)
}

/**
 * Every 3d6 sum (3..18) with its exact probability, enumerated once from the 216
 * equally likely outcomes. Used to compute honest Gauntlet reroll odds.
 */
function threeD6Distribution(): { sum: number; p: number }[] {
  const counts = new Array(19).fill(0)
  for (let a = 1; a <= 6; a++)
    for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) counts[a + b + c]++
  const out: { sum: number; p: number }[] = []
  for (let s = 3; s <= 18; s++) out.push({ sum: s, p: counts[s] / 216 })
  return out
}

/**
 * Exact probability that rerolling a Gauntlet slot beats its current total. The
 * next reroll carries a penalty of `rerolls + 1` (one more than done so far) and
 * its result is clamp(3d6 - penalty, 3, 18). Enumerating the 3d6 distribution
 * gives the true odds; a return of 0 means improving is mathematically impossible
 * (even the best possible next roll can no longer exceed the current total), so
 * the reroll should be disabled rather than offered as a certain-to-lose bet.
 */
export function gauntletImproveChance(current: number, rerolls: number): number {
  const penalty = rerolls + 1
  return threeD6Distribution().reduce(
    (p, face) => (clamp(face.sum - penalty, 3, 18) > current ? p + face.p : p),
    0,
  )
}

/**
 * The highest score the next reroll of a Gauntlet slot could yield: a perfect 3d6
 * of 18 less the next penalty of `rerolls + 1`, clamped to [3, 18]. This is the
 * same penalty `gauntletImproveChance` uses, so the two agree by construction -
 * a reroll can improve exactly when this ceiling still exceeds the current total.
 */
export function gauntletMaxNext(rerolls: number): number {
  return clamp(18 - (rerolls + 1), 3, 18)
}

/** The 5e standard array. */
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]

// ---- Point buy (real implementation) --------------------------------------

export const POINT_BUY_BUDGET = 27
export const POINT_BUY_MIN = 8
export const POINT_BUY_MAX = 15

const POINT_BUY_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
}

/** Point-buy cost of a single score (0 outside the buyable range). */
export function pointBuyCost(score: number): number {
  return POINT_BUY_COST[score] ?? 0
}

/** Total point-buy cost of a set of scores. */
export function pointBuyTotal(scores: number[]): number {
  return scores.reduce((total, s) => total + pointBuyCost(s), 0)
}

/** Points remaining given a set of point-buy scores. */
export function pointBuyRemaining(scores: number[]): number {
  return POINT_BUY_BUDGET - pointBuyTotal(scores)
}

// ---- Matrix roll (Mikel Jensen's idea) ------------------------------------

export interface MatrixCell {
  sum: number
  mod: number
  row: number
  col: number
  /** True when the cell lies on the highest-summing row/column/diagonal. */
  best: boolean
}

/** Roll an `rows` x `cols` matrix of 3d6 ability scores. */
export function rollMatrix(rows = 6, cols = 6): MatrixCell[][] {
  const grid: MatrixCell[][] = []
  for (let r = 0; r < rows; r++) {
    const line: MatrixCell[] = []
    for (let c = 0; c < cols; c++) {
      const s = sum(rollDice(3, 6))
      line.push({ sum: s, mod: abilityMod(s), row: r, col: c, best: false })
    }
    grid.push(line)
  }
  markBestLines(grid)
  return grid
}

/**
 * Rebuild a matrix from a saved grid of rolled scores: each cell's modifier and
 * best-line marks are derived, so a persisted `number[][]` restores to the same
 * grid `rollMatrix` produced.
 */
export function matrixFromScores(scores: number[][]): MatrixCell[][] {
  const grid: MatrixCell[][] = scores.map((row, r) =>
    row.map((s, c) => ({ sum: s, mod: abilityMod(s), row: r, col: c, best: false })),
  )
  markBestLines(grid)
  return grid
}

/** All straight lines in the grid: every row, every column, and (if square) both diagonals. */
function collectLines(grid: MatrixCell[][]): MatrixCell[][] {
  const rows = grid.length
  if (rows === 0) return []
  const cols = grid[0].length
  const lines: MatrixCell[][] = []
  for (let r = 0; r < rows; r++) lines.push(grid[r])
  for (let c = 0; c < cols; c++) lines.push(grid.map((row) => row[c]))
  if (rows === cols) {
    lines.push(grid.map((row, i) => row[i]))
    lines.push(grid.map((row, i) => row[cols - 1 - i]))
  }
  return lines
}

/**
 * Mark every cell that lies on a highest-summing straight line (any row, any
 * column, or either main diagonal when the grid is square).
 */
export function markBestLines(grid: MatrixCell[][]): void {
  const lines = collectLines(grid)
  if (lines.length === 0) return
  const bestSum = Math.max(...lines.map((line) => sum(line.map((c) => c.sum))))
  for (const line of lines) {
    if (sum(line.map((c) => c.sum)) === bestSum) {
      for (const cell of line) cell.best = true
    }
  }
}

/** The six (or N) scores of the single highest-summing line - used as the assignable pool. */
export function bestLineValues(grid: MatrixCell[][]): number[] {
  const lines = collectLines(grid)
  let best: MatrixCell[] = []
  let bestSum = -Infinity
  for (const line of lines) {
    const total = sum(line.map((c) => c.sum))
    if (total > bestSum) {
      bestSum = total
      best = line
    }
  }
  return best.map((c) => c.sum)
}

/** A selectable straight line in the matrix, carrying its identity, total, and scores. */
export interface MatrixLine {
  /** 'row' | 'col' | 'diag'. */
  kind: 'row' | 'col' | 'diag'
  /** Row/column index; for 'diag', 0 = main (↘), 1 = anti (↗). */
  index: number
  /** Sum of the line's cell scores. */
  sum: number
  /** The line's cell scores, in reading order (used as the assignable pool). */
  values: number[]
}

/**
 * Every straight line the player may claim as their scores: each row, each
 * column, and (for a square grid) both diagonals - with identity, total, and
 * scores so the UI can render selectors and set the pool from a chosen line.
 */
export function matrixLines(grid: MatrixCell[][]): MatrixLine[] {
  const rows = grid.length
  if (rows === 0) return []
  const cols = grid[0].length
  const lines: MatrixLine[] = []
  const toLine = (
    kind: MatrixLine['kind'],
    index: number,
    cells: MatrixCell[],
  ): MatrixLine => {
    const values = cells.map((c) => c.sum)
    return { kind, index, sum: sum(values), values }
  }
  for (let r = 0; r < rows; r++) lines.push(toLine('row', r, grid[r]))
  for (let c = 0; c < cols; c++)
    lines.push(
      toLine(
        'col',
        c,
        grid.map((row) => row[c]),
      ),
    )
  if (rows === cols) {
    lines.push(
      toLine(
        'diag',
        0,
        grid.map((row, i) => row[i]),
      ),
    )
    lines.push(
      toLine(
        'diag',
        1,
        grid.map((row, i) => row[cols - 1 - i]),
      ),
    )
  }
  return lines
}

/** The highest-summing line (first one wins ties) - the sensible default selection. */
export function bestLine(lines: MatrixLine[]): MatrixLine | null {
  let best: MatrixLine | null = null
  for (const line of lines) if (!best || line.sum > best.sum) best = line
  return best
}

/** Whether the cell at (row, col) lies on the given line of a `size`×`size` grid. */
export function cellInLine(
  row: number,
  col: number,
  line: MatrixLine,
  size: number,
): boolean {
  switch (line.kind) {
    case 'row':
      return row === line.index
    case 'col':
      return col === line.index
    case 'diag':
      return line.index === 0 ? row === col : row + col === size - 1
  }
}
