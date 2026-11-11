import { describe, expect, it } from 'vitest'
import { scoreColorClass } from './scoreColor'

describe('scoreColorClass', () => {
  it('marks a perfect 18 (or higher) as gold', () => {
    expect(scoreColorClass(18)).toBe('score-perfect')
    expect(scoreColorClass(20)).toBe('score-perfect')
  })

  it('colours high scores green', () => {
    expect(scoreColorClass(16)).toBe('text-success')
    expect(scoreColorClass(17)).toBe('text-success')
  })

  it('colours low scores red', () => {
    expect(scoreColorClass(9)).toBe('text-danger')
    expect(scoreColorClass(3)).toBe('text-danger')
  })

  it('colours mid-range scores blue', () => {
    expect(scoreColorClass(10)).toBe('text-primary')
    expect(scoreColorClass(15)).toBe('text-primary')
  })
})
