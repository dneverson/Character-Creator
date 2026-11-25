import { describe, expect, it } from 'vitest'
import { relativeTime, syncLine } from './syncLine'

const now = 10_000_000_000

describe('relativeTime', () => {
  it.each([
    [0, 'just now'],
    [59_000, 'just now'],
    [60_000, '1 minute ago'],
    [120_000, '2 minutes ago'],
    [59 * 60_000, '59 minutes ago'],
    [60 * 60_000, '1 hour ago'],
    [5 * 3_600_000, '5 hours ago'],
    [24 * 3_600_000, '1 day ago'],
    [3 * 24 * 3_600_000, '3 days ago'],
  ])('says %d ms ago as "%s"', (ago, text) => {
    expect(relativeTime(now - ago, now)).toBe(text)
  })

  it('treats a time ahead of the clock as just now', () => {
    expect(relativeTime(now + 5000, now)).toBe('just now')
  })
})

describe('syncLine', () => {
  it('has a line for each state', () => {
    expect(syncLine('idle', now - 120_000, now)).toBe('Saved to cloud 2 minutes ago')
    expect(syncLine('idle', null, now)).toBe('Saved to cloud')
    expect(syncLine('syncing', null, now)).toBe('Saving...')
    expect(syncLine('offline', null, now)).toBe('Offline - will save when back online')
    expect(syncLine('error', null, now)).toBe('Could not save - try again')
  })
})
