import { describe, expect, it } from 'vitest'
import { formatDateParts, formatTimestamp } from './date'

describe('formatDateParts', () => {
  it('formats a full date as YYYY/MM/DD', () => {
    expect(formatDateParts('2014-08-19')).toBe('2014/08/19')
  })

  it('formats a year+month as YYYY/MM', () => {
    expect(formatDateParts('2014-08')).toBe('2014/08')
  })

  it('formats a year-only value as YYYY', () => {
    expect(formatDateParts('2020')).toBe('2020')
  })

  it('trims surrounding whitespace', () => {
    expect(formatDateParts(' 2014-08-19 ')).toBe('2014/08/19')
  })

  it('returns null for an empty or missing value', () => {
    expect(formatDateParts(undefined)).toBeNull()
    expect(formatDateParts('')).toBeNull()
  })

  it('passes an unrecognised shape through unchanged', () => {
    expect(formatDateParts('August 2014')).toBe('August 2014')
  })
})

describe('formatTimestamp', () => {
  it('formats a timestamp as YYYY/MM/DD HH:MM AM/PM with padding', () => {
    // Local time; construct the instant from local components so the assertion
    // is timezone-independent.
    const ms = new Date(2014, 11, 9, 15, 5).getTime() // 2014-12-09 15:05 local
    expect(formatTimestamp(ms)).toBe('2014/12/09 03:05 PM')
  })

  it('renders midnight as 12 AM and noon as 12 PM', () => {
    expect(formatTimestamp(new Date(2020, 0, 1, 0, 0).getTime())).toBe(
      '2020/01/01 12:00 AM',
    )
    expect(formatTimestamp(new Date(2020, 0, 1, 12, 30).getTime())).toBe(
      '2020/01/01 12:30 PM',
    )
  })
})
