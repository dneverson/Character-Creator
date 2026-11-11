import { describe, expect, it } from 'vitest'
import {
  abilityMod,
  bestLine,
  bestLineValues,
  cellInLine,
  clamp,
  formatMod,
  gauntletImproveChance,
  gauntletMaxNext,
  keepHighest,
  markBestLines,
  matrixLines,
  pointBuyCost,
  pointBuyRemaining,
  pointBuyTotal,
  randomInt,
  rerollLowest,
  rollConfigLabel,
  rollGauntletSlot,
  rollMatrix,
  rollOneScore,
  rollScorePool,
  STANDARD_ARRAY,
  sum,
  type MatrixCell,
  type RollConfig,
} from './dice'

describe('abilityMod', () => {
  it('matches the 5e table', () => {
    expect(abilityMod(1)).toBe(-5)
    expect(abilityMod(8)).toBe(-1)
    expect(abilityMod(10)).toBe(0)
    expect(abilityMod(11)).toBe(0)
    expect(abilityMod(15)).toBe(2)
    expect(abilityMod(20)).toBe(5)
    expect(abilityMod(30)).toBe(10)
  })
})

describe('formatMod', () => {
  it('adds an explicit sign', () => {
    expect(formatMod(3)).toBe('+3')
    expect(formatMod(0)).toBe('+0')
    expect(formatMod(-1)).toBe('-1')
  })
})

describe('randomInt', () => {
  it('always stays within range', () => {
    for (let i = 0; i < 500; i++) {
      const v = randomInt(1, 6)
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(6)
    }
  })
})

describe('keepHighest', () => {
  it('keeps the top N and does not mutate input', () => {
    const rolls = [2, 5, 3, 6]
    expect(keepHighest(rolls, 3)).toEqual([6, 5, 3])
    expect(rolls).toEqual([2, 5, 3, 6])
  })
})

describe('rerollLowest', () => {
  it('rerolls only the single lowest die, in range, without mutating input', () => {
    const input = [1, 4, 3, 6]
    const out = rerollLowest(input, 6, 1)
    expect(out).toHaveLength(4)
    for (const v of out) {
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(6)
    }
    // Only index 0 (the lone lowest) may change; the others are untouched.
    expect(out.slice(1)).toEqual([4, 3, 6])
    expect(input).toEqual([1, 4, 3, 6])
  })

  it('rerolls the first of tied lowest dice, one at a time', () => {
    const out = rerollLowest([2, 2, 5], 6, 1)
    // The first 2 is the chosen lowest; the second 2 and the 5 stay put.
    expect(out[1]).toBe(2)
    expect(out[2]).toBe(5)
  })

  it('performs the requested number of sequential rerolls', () => {
    // With every die identical, each pass rerolls index 0 (first lowest) in turn.
    const out = rerollLowest([1, 1, 1], 6, 3)
    expect(out).toHaveLength(3)
    for (const v of out) {
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(6)
    }
  })

  it('returns a copy unchanged when asked for zero rerolls', () => {
    expect(rerollLowest([3, 4, 5], 6, 0)).toEqual([3, 4, 5])
  })
})

describe('rollScorePool', () => {
  it('produces six scores in the plausible 3..18 range for r4d6 k3 r0', () => {
    const pool = rollScorePool({ dice: 4, rerolls: 0 })
    expect(pool).toHaveLength(6)
    for (const s of pool) {
      expect(s).toBeGreaterThanOrEqual(3)
      expect(s).toBeLessThanOrEqual(18)
    }
  })
})

describe('point buy', () => {
  it('standard array is not a legal point-buy set (sanity of tables)', () => {
    expect(STANDARD_ARRAY).toEqual([15, 14, 13, 12, 10, 8])
  })

  it('all-8s costs 0 and leaves the full budget', () => {
    const scores = [8, 8, 8, 8, 8, 8]
    expect(pointBuyTotal(scores)).toBe(0)
    expect(pointBuyRemaining(scores)).toBe(27)
  })

  it('a common 15/15/15/8/8/8 spread costs exactly 27', () => {
    const scores = [15, 15, 15, 8, 8, 8]
    expect(pointBuyTotal(scores)).toBe(27)
    expect(pointBuyRemaining(scores)).toBe(0)
  })

  it('charges the non-linear 13->14->15 jump', () => {
    expect(pointBuyTotal([13])).toBe(5)
    expect(pointBuyTotal([14])).toBe(7)
    expect(pointBuyTotal([15])).toBe(9)
  })

  it('costs 0 for scores outside the buyable range', () => {
    expect(pointBuyCost(7)).toBe(0)
    expect(pointBuyCost(16)).toBe(0)
    expect(pointBuyCost(8)).toBe(0)
    expect(pointBuyCost(9)).toBe(1)
  })
})

describe('rollConfigLabel', () => {
  it('renders the compact rNd6 k3 rK notation', () => {
    expect(rollConfigLabel({ dice: 4, rerolls: 1 })).toBe('r4d6 k3 r1')
    expect(rollConfigLabel({ dice: 3, rerolls: 0 })).toBe('r3d6 k3 r0')
  })
})

describe('rollOneScore', () => {
  it('stays within each config’s achievable range (keep the highest min(3, dice))', () => {
    const configs: RollConfig[] = [
      { dice: 4, rerolls: 0 },
      { dice: 4, rerolls: 1 },
      { dice: 3, rerolls: 0 },
      { dice: 3, rerolls: 1 },
      { dice: 1, rerolls: 0 },
      { dice: 9, rerolls: 9 },
    ]
    for (const config of configs) {
      const keep = Math.min(3, config.dice)
      for (let i = 0; i < 50; i++) {
        const v = rollOneScore(config)
        expect(v).toBeGreaterThanOrEqual(keep) // each kept die is at least 1
        expect(v).toBeLessThanOrEqual(6 * keep) // each kept die is at most 6
      }
    }
  })
})

describe('rollMatrix', () => {
  it('builds a rows x cols grid of valid 3d6 cells and marks best lines', () => {
    const grid = rollMatrix(6, 6)
    expect(grid).toHaveLength(6)
    expect(grid[0]).toHaveLength(6)
    for (const row of grid) {
      for (const cell of row) {
        expect(cell.sum).toBeGreaterThanOrEqual(3)
        expect(cell.sum).toBeLessThanOrEqual(18)
        expect(cell.mod).toBe(abilityMod(cell.sum))
      }
    }
    // At least one cell must lie on a best line.
    expect(grid.flat().some((c) => c.best)).toBe(true)
  })
})

describe('bestLineValues', () => {
  it('returns the values of the single highest-summing line', () => {
    // Square 2x2 so diagonals are considered; the main diagonal sums highest.
    const grid: MatrixCell[][] = [
      [
        { sum: 18, mod: 4, row: 0, col: 0, best: false },
        { sum: 3, mod: -4, row: 0, col: 1, best: false },
      ],
      [
        { sum: 3, mod: -4, row: 1, col: 0, best: false },
        { sum: 18, mod: 4, row: 1, col: 1, best: false },
      ],
    ]
    expect(bestLineValues(grid)).toEqual([18, 18]) // top-left to bottom-right diagonal
  })

  it('returns an empty pool for an empty grid', () => {
    expect(bestLineValues([])).toEqual([])
    markBestLines([]) // guard: no lines, no throw
  })
})

describe('markBestLines', () => {
  it('marks the highest-summing line in a fixed grid', () => {
    // 2x2 grid: bottom row sums highest.
    const grid: MatrixCell[][] = [
      [
        { sum: 3, mod: -4, row: 0, col: 0, best: false },
        { sum: 3, mod: -4, row: 0, col: 1, best: false },
      ],
      [
        { sum: 18, mod: 4, row: 1, col: 0, best: false },
        { sum: 18, mod: 4, row: 1, col: 1, best: false },
      ],
    ]
    markBestLines(grid)
    expect(grid[1][0].best).toBe(true)
    expect(grid[1][1].best).toBe(true)
    expect(grid[0][0].best).toBe(false)
  })
})

describe('matrixLines', () => {
  // 2x2 grid → 2 rows, 2 columns, 2 diagonals.
  const grid: MatrixCell[][] = [
    [
      { sum: 3, mod: -4, row: 0, col: 0, best: false },
      { sum: 4, mod: -3, row: 0, col: 1, best: false },
    ],
    [
      { sum: 5, mod: -3, row: 1, col: 0, best: false },
      { sum: 6, mod: -2, row: 1, col: 1, best: false },
    ],
  ]

  it('enumerates every row, column, and diagonal with identity, sum, and values', () => {
    const lines = matrixLines(grid)
    expect(lines).toEqual([
      { kind: 'row', index: 0, sum: 7, values: [3, 4] },
      { kind: 'row', index: 1, sum: 11, values: [5, 6] },
      { kind: 'col', index: 0, sum: 8, values: [3, 5] },
      { kind: 'col', index: 1, sum: 10, values: [4, 6] },
      { kind: 'diag', index: 0, sum: 9, values: [3, 6] },
      { kind: 'diag', index: 1, sum: 9, values: [4, 5] },
    ])
  })

  it('omits diagonals for a non-square grid', () => {
    const wide: MatrixCell[][] = [
      [
        { sum: 3, mod: -4, row: 0, col: 0, best: false },
        { sum: 4, mod: -3, row: 0, col: 1, best: false },
        { sum: 5, mod: -3, row: 0, col: 2, best: false },
      ],
    ]
    expect(matrixLines(wide).map((l) => l.kind)).toEqual(['row', 'col', 'col', 'col'])
  })

  it('returns nothing for an empty grid', () => {
    expect(matrixLines([])).toEqual([])
  })
})

describe('bestLine', () => {
  it('returns the highest-summing line, first winning ties', () => {
    const lines = matrixLines([
      [
        { sum: 3, mod: -4, row: 0, col: 0, best: false },
        { sum: 4, mod: -3, row: 0, col: 1, best: false },
      ],
      [
        { sum: 5, mod: -3, row: 1, col: 0, best: false },
        { sum: 6, mod: -2, row: 1, col: 1, best: false },
      ],
    ])
    expect(bestLine(lines)).toEqual({ kind: 'row', index: 1, sum: 11, values: [5, 6] })
  })

  it('returns null with no lines', () => {
    expect(bestLine([])).toBeNull()
  })
})

describe('cellInLine', () => {
  const row: ReturnType<typeof matrixLines>[number] = {
    kind: 'row',
    index: 1,
    sum: 0,
    values: [],
  }
  const col: ReturnType<typeof matrixLines>[number] = {
    kind: 'col',
    index: 2,
    sum: 0,
    values: [],
  }
  const mainDiag: ReturnType<typeof matrixLines>[number] = {
    kind: 'diag',
    index: 0,
    sum: 0,
    values: [],
  }
  const antiDiag: ReturnType<typeof matrixLines>[number] = {
    kind: 'diag',
    index: 1,
    sum: 0,
    values: [],
  }

  it('matches cells on a row', () => {
    expect(cellInLine(1, 3, row, 6)).toBe(true)
    expect(cellInLine(2, 3, row, 6)).toBe(false)
  })

  it('matches cells on a column', () => {
    expect(cellInLine(4, 2, col, 6)).toBe(true)
    expect(cellInLine(4, 1, col, 6)).toBe(false)
  })

  it('matches cells on the main and anti diagonals', () => {
    expect(cellInLine(3, 3, mainDiag, 6)).toBe(true)
    expect(cellInLine(3, 2, mainDiag, 6)).toBe(false)
    expect(cellInLine(2, 3, antiDiag, 6)).toBe(true) // 2 + 3 = 5 = size - 1
    expect(cellInLine(2, 2, antiDiag, 6)).toBe(false)
  })
})

describe('sum', () => {
  it('adds an array', () => {
    expect(sum([1, 2, 3])).toBe(6)
    expect(sum([])).toBe(0)
  })
})

describe('clamp', () => {
  it('bounds a value to the inclusive range', () => {
    expect(clamp(5, 3, 18)).toBe(5)
    expect(clamp(1, 3, 18)).toBe(3)
    expect(clamp(25, 3, 18)).toBe(18)
    expect(clamp(3, 3, 18)).toBe(3)
    expect(clamp(18, 3, 18)).toBe(18)
  })
})

describe('rollGauntletSlot', () => {
  it('stays in 3..18 and never exceeds the reroll penalty ceiling', () => {
    for (let rerolls = 0; rerolls <= 5; rerolls++) {
      for (let i = 0; i < 100; i++) {
        const v = rollGauntletSlot(rerolls)
        expect(v).toBeGreaterThanOrEqual(3)
        // 3d6 tops out at 18, so a penalised roll cannot beat 18 - rerolls.
        expect(v).toBeLessThanOrEqual(18 - rerolls)
      }
    }
  })

  it('clamps to the floor of 3 once the penalty swamps the roll', () => {
    // 3d6 - 20 is at most -2, so every result clamps up to the 3 floor.
    for (let i = 0; i < 50; i++) {
      expect(rollGauntletSlot(20)).toBe(3)
    }
  })
})

describe('gauntletImproveChance', () => {
  it('is 0 when even the best next roll cannot beat the current total', () => {
    // Fresh roll (rerolls=0): next carries a -1 penalty, so its ceiling is 17.
    expect(gauntletImproveChance(17, 0)).toBe(0)
    expect(gauntletImproveChance(18, 0)).toBe(0)
  })

  it('follows the disable boundary rerolls >= 17 - current', () => {
    // current=10: the next reroll can no longer beat it once rerolls reaches 7.
    expect(gauntletImproveChance(10, 7)).toBe(0)
    expect(gauntletImproveChance(10, 6)).toBeGreaterThan(0)
  })

  it('matches the exact 3d6 odds for a low fresh total', () => {
    // current=3, penalty=1: beating 3 needs clamp(3d6-1,3,18) > 3, i.e. 3d6 >= 5.
    // P(3d6 >= 5) = 1 - P(3) - P(4) = 1 - 1/216 - 3/216 = 212/216.
    expect(gauntletImproveChance(3, 0)).toBeCloseTo(212 / 216, 10)
  })

  it('always returns a probability in [0, 1]', () => {
    for (let current = 3; current <= 18; current++) {
      for (let rerolls = 0; rerolls <= 6; rerolls++) {
        const p = gauntletImproveChance(current, rerolls)
        expect(p).toBeGreaterThanOrEqual(0)
        expect(p).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('gauntletMaxNext', () => {
  it('is a perfect 18 less the next penalty of rerolls + 1', () => {
    expect(gauntletMaxNext(0)).toBe(17)
    expect(gauntletMaxNext(8)).toBe(9)
  })

  it('never falls below the ability floor of 3', () => {
    expect(gauntletMaxNext(15)).toBe(3)
    expect(gauntletMaxNext(20)).toBe(3)
  })

  it('agrees with gauntletImproveChance: a reroll can improve iff its ceiling beats the total', () => {
    for (let current = 3; current <= 18; current++) {
      for (let rerolls = 0; rerolls <= 16; rerolls++) {
        const canImprove = gauntletImproveChance(current, rerolls) > 0
        expect(canImprove).toBe(gauntletMaxNext(rerolls) > current)
      }
    }
  })
})
