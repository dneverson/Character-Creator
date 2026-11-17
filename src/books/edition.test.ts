import { describe, expect, it } from 'vitest'
import { editionOf } from './edition'

describe('editionOf', () => {
  it('sets what was published from the 2024 core rules on in the 2024 look', () => {
    expect(editionOf({ published: '2024-09-17' })).toBe('2024')
    expect(editionOf({ published: '2025-11-11' })).toBe('2024')
  })

  it('sets the older ones, and those with no date, in the 2014 look', () => {
    expect(editionOf({ published: '2024-08-27' })).toBe('2014')
    expect(editionOf({ published: '2014-08-19' })).toBe('2014')
    expect(editionOf({})).toBe('2014')
  })
})
