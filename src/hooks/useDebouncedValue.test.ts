import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedValue } from './useDebouncedValue'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useDebouncedValue', () => {
  it('starts with the value and follows it once it has stayed put', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 100), {
      initialProps: { v: 'a' },
    })
    expect(result.current).toBe('a')
    rerender({ v: 'ab' })
    act(() => vi.advanceTimersByTime(60))
    rerender({ v: 'abc' })
    act(() => vi.advanceTimersByTime(60))
    expect(result.current).toBe('a')
    act(() => vi.advanceTimersByTime(60))
    expect(result.current).toBe('abc')
  })
})
