import { describe, expect, it } from 'vitest'
import {
  RollParseError,
  cryptoRng,
  d20Modifier,
  naturalOf,
  parseBonus,
  parseExpression,
  rollD20,
  rollExpression,
  termsText,
  type Rng,
} from './roll'

/** A random source that gives these dice in order. */
function dice(...faces: number[]): Rng {
  const queue = [...faces]
  return () => {
    const face = queue.shift()
    if (face === undefined) throw new Error('more dice rolled than the test gave')
    return face
  }
}

describe('parseExpression', () => {
  it('reads dice, flat numbers and signs, with or without spaces', () => {
    expect(termsText(parseExpression('2d6 + 3'))).toBe('2d6+3')
    expect(termsText(parseExpression('D20-1'))).toBe('1d20-1')
    expect(termsText(parseExpression('-1d4+1d6'))).toBe('-1d4+1d6')
    expect(termsText(parseExpression('7'))).toBe('7')
  })

  it('reads keep highest and keep lowest', () => {
    expect(termsText(parseExpression('4d6kh3'))).toBe('4d6kh3')
    expect(termsText(parseExpression('2d20kl'))).toBe('2d20kl1')
  })

  it.each([
    ['', 'Type a roll'],
    ['abc', 'is not a roll'],
    ['2d6 3', 'is not a roll'],
    ['1d20+', 'is not a roll'],
    ['0d6', '1 to 100 dice'],
    ['101d6', '1 to 100 dice'],
    ['1d1', '2 to 100 sides'],
    ['1d101', '2 to 100 sides'],
    ['2d6kh3', 'Keep between 1 and 2'],
    ['2d6kh0', 'Keep between 1 and 2'],
    ['1+1+1+1+1+1+1+1+1+1+1', 'at most 10 parts'],
  ])('refuses %j in plain words', (text, message) => {
    expect(() => parseExpression(text)).toThrow(RollParseError)
    expect(() => parseExpression(text)).toThrow(message)
  })
})

describe('rollExpression', () => {
  it('adds the dice and the flat numbers and keeps every die', () => {
    const roll = rollExpression('2d6+3', dice(4, 5))
    expect(roll).toMatchObject({
      expression: '2d6+3',
      mode: 'normal',
      modifier: 3,
      total: 12,
      dice: [{ sign: 1, sides: 6, rolls: [4, 5], dropped: [] }],
    })
    expect(roll.critical).toBeUndefined()
  })

  it('subtracts a negative term', () => {
    expect(rollExpression('1d8-1d4-2', dice(6, 3)).total).toBe(1)
  })

  it('drops the lowest dice of a keep highest and the highest of a keep lowest', () => {
    const high = rollExpression('4d6kh3', dice(2, 6, 3, 5))
    expect(high.dice[0].dropped).toEqual([0])
    expect(high.total).toBe(14)
    const low = rollExpression('3d6kl1', dice(4, 2, 6))
    expect(low.dice[0].dropped).toEqual([0, 2])
    expect(low.total).toBe(2)
  })

  it('doubles the dice of a critical, not the flat number', () => {
    const roll = rollExpression('1d8+3', dice(2, 7), true)
    expect(roll.dice[0].rolls).toEqual([2, 7])
    expect(roll.total).toBe(12)
    expect(roll.critical).toBe(true)
  })

  it('doubles the dice a keep rule keeps too', () => {
    const roll = rollExpression('2d6kh1', dice(1, 6, 2, 3), true)
    expect(roll.dice[0].dropped).toEqual([0, 2])
    expect(roll.total).toBe(9)
  })

  it('rolls a flat number with no dice', () => {
    expect(rollExpression('4').dice).toEqual([])
    expect(rollExpression('-4').total).toBe(-4)
  })

  it('rolls real dice with the default source', () => {
    for (let at = 0; at < 50; at++) {
      const roll = rollExpression('3d100')
      for (const die of roll.dice[0].rolls) {
        expect(die).toBeGreaterThanOrEqual(1)
        expect(die).toBeLessThanOrEqual(100)
      }
    }
    expect(cryptoRng(1)).toBe(1)
  })

  it('throws the parse error for an expression that cannot be rolled', () => {
    expect(() => rollExpression('nope')).toThrow(RollParseError)
  })
})

describe('rollD20', () => {
  it('rolls one die and adds the modifier', () => {
    const roll = rollD20(5, 'normal', dice(12))
    expect(roll).toMatchObject({ expression: '1d20+5', total: 17, mode: 'normal' })
    expect(roll.dice[0]).toMatchObject({ rolls: [12], dropped: [] })
    expect(roll.natural).toBeUndefined()
  })

  it('writes a negative modifier with its sign and no modifier at all as the die', () => {
    expect(rollD20(-2, 'normal', dice(10)).expression).toBe('1d20-2')
    expect(rollD20(0, 'normal', dice(10)).expression).toBe('1d20')
  })

  it('keeps the higher of two dice with advantage', () => {
    const roll = rollD20(2, 'advantage', dice(7, 15))
    expect(roll.dice[0]).toMatchObject({ rolls: [7, 15], dropped: [0] })
    expect(roll.total).toBe(17)
    expect(roll.mode).toBe('advantage')
  })

  it('keeps the lower of two dice with disadvantage', () => {
    const roll = rollD20(2, 'disadvantage', dice(7, 15))
    expect(roll.dice[0].dropped).toEqual([1])
    expect(roll.total).toBe(9)
  })

  it('keeps the first of two equal dice', () => {
    expect(rollD20(0, 'advantage', dice(9, 9)).dice[0].dropped).toEqual([1])
  })

  it('flags a natural 20 and a natural 1 of the die that counts', () => {
    expect(rollD20(0, 'normal', dice(20)).natural).toBe(20)
    expect(rollD20(0, 'normal', dice(1)).natural).toBe(1)
    // A natural 1 on the die that is dropped is not the roll's natural 1.
    expect(rollD20(0, 'advantage', dice(1, 12)).natural).toBeUndefined()
    expect(rollD20(0, 'disadvantage', dice(1, 12)).natural).toBe(1)
    expect(rollD20(0, 'advantage', dice(20, 3)).natural).toBe(20)
  })

  it('rolls real dice with the default source', () => {
    const roll = rollD20(0, 'advantage')
    expect(roll.dice[0].rolls).toHaveLength(2)
  })
})

describe('d20Modifier', () => {
  it('is the flat number of one d20, and null for any other roll', () => {
    expect(d20Modifier('d20')).toBe(0)
    expect(d20Modifier('1d20 + 5 - 2')).toBe(3)
    expect(d20Modifier('2d20')).toBeNull()
    expect(d20Modifier('1d20kh1')).toBeNull()
    expect(d20Modifier('1d20+1d4')).toBeNull()
    expect(d20Modifier('1d12')).toBeNull()
    expect(d20Modifier('-1d20')).toBeNull()
    expect(d20Modifier('5')).toBeNull()
  })
})

describe('a situational bonus', () => {
  it('reads numbers and dice, nothing for an empty field, and refuses a keep rule', () => {
    expect(parseBonus('')).toEqual([])
    expect(termsText(parseBonus('+1d4'))).toBe('1d4')
    expect(termsText(parseBonus('-2'))).toBe('-2')
    expect(() => parseBonus('4d6kh3')).toThrow(RollParseError)
    expect(() => parseBonus('banana')).toThrow(RollParseError)
  })

  it('adds to a d20 test as flagged dice and a number, and is kept on the outcome', () => {
    const outcome = rollD20(2, 'advantage', dice(5, 15, 3), parseBonus('+1d4+1'))
    expect(outcome.total).toBe(15 + 2 + 3 + 1)
    expect(outcome.bonus).toBe('+1d4+1')
    expect(outcome.dice[0]).toMatchObject({ rolls: [5, 15], dropped: [0] })
    expect(outcome.dice[1]).toMatchObject({ sides: 4, rolls: [3], bonus: true })
    expect(naturalOf(outcome)).toBe(15)
  })

  it('doubles the dice of a critical, bonus dice too, and never the flat numbers', () => {
    const outcome = rollExpression('1d8+3', dice(3, 6, 2, 5), true, parseBonus('+1d6'))
    expect(outcome.critical).toBe(true)
    expect(outcome.dice[0]).toMatchObject({ rolls: [3, 6], extraFrom: 1 })
    expect(outcome.dice[1]).toMatchObject({ rolls: [2, 5], bonus: true })
    expect(outcome.total).toBe(3 + 6 + 2 + 5 + 3)
  })
})
