import { describe, expect, it } from 'vitest'
import { GAP, landingOffset, readingLine, TOLERANCE } from './readingLine'

describe('the reading line', () => {
  it('has a heading the reader went to above it, whatever the height of the bar', () => {
    for (const bar of [0, 45, 90, 137]) {
      expect(landingOffset(bar)).toBeLessThanOrEqual(readingLine(bar))
      expect(landingOffset(bar)).toBe(bar + GAP)
    }
  })

  it('does not count the next heading, one line of text below the one gone to', () => {
    const bar = 45
    const nextHeading = landingOffset(bar) + 24
    expect(nextHeading).toBeGreaterThan(readingLine(bar))
    expect(readingLine(bar) - landingOffset(bar)).toBe(TOLERANCE)
  })
})
