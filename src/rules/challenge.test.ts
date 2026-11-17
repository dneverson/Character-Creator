import { describe, expect, it } from 'vitest'
import { proficiencyForCr, xpForCr } from './challenge'

describe('challenge rating', () => {
  it('reads the experience points of the printed table', () => {
    expect(xpForCr(0.25)).toBe(50)
    expect(xpForCr(10)).toBe(5900)
    expect(xpForCr(30)).toBe(155000)
    expect(xpForCr(31)).toBeUndefined()
  })

  it('steps the proficiency bonus every four ratings', () => {
    const bonuses = [0, 0.5, 4, 5, 8, 9, 12, 13, 16, 17, 20, 21, 24, 25, 28, 29, 30].map(
      proficiencyForCr,
    )
    expect(bonuses).toEqual([2, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9])
  })
})
