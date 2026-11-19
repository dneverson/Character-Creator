import { describe, expect, it } from 'vitest'
import { damageExpression, damageText } from './attackText'

describe('damageExpression', () => {
  it('is the die and its bonus, ready to roll', () => {
    expect(damageExpression('1d8', 3)).toBe('1d8 + 3')
    expect(damageExpression('2d6', -1)).toBe('2d6 - 1')
    expect(damageExpression('1d8', 0)).toBe('1d8')
  })

  it('is the bonus alone when the weapon has no die to roll', () => {
    expect(damageExpression('', 4)).toBe('4')
    expect(damageExpression('-', 2)).toBe('2')
  })

  it('reads the same as the damage the sheet shows', () => {
    expect(damageExpression('1d6', 2)).toBe(damageText('1d6', 2))
  })
})
