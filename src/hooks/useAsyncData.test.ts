import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useContentStatus } from '../content/library'
import { useAsyncData } from './useAsyncData'

describe('useAsyncData', () => {
  it('exposes resolved data and clears loading', async () => {
    const loader = () => Promise.resolve(42)
    const { result } = renderHook(() => useAsyncData(loader))

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBe(42)
    expect(result.current.error).toBeNull()
  })

  it('surfaces an Error rejection as-is', async () => {
    const boom = new Error('boom')
    const loader = () => Promise.reject(boom)
    const { result } = renderHook(() => useAsyncData(loader))

    await waitFor(() => expect(result.current.error).toBe(boom))
    expect(result.current.data).toBeNull()
  })

  it('wraps a non-Error rejection in an Error', async () => {
    const loader = () => Promise.reject('nope')
    const { result } = renderHook(() => useAsyncData(loader))

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error))
    expect(result.current.error?.message).toBe('nope')
  })

  it('ignores a result that resolves after unmount', async () => {
    let resolve!: (v: number) => void
    const loader = () => new Promise<number>((r) => (resolve = r))
    const { result, unmount } = renderHook(() => useAsyncData(loader))

    unmount()
    resolve(7)
    await Promise.resolve()
    // State was never updated after unmount; it stays in its initial shape.
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(true)
  })

  it('loads again when the book content changes wholesale', async () => {
    const loader = vi.fn(() => Promise.resolve(useContentStatus.getState().epoch))
    const { result } = renderHook(() => useAsyncData(loader))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const before = result.current.data as number

    act(() => useContentStatus.setState({ epoch: before + 1 }))
    await waitFor(() => expect(result.current.data).toBe(before + 1))
    expect(loader).toHaveBeenCalledTimes(2)
  })
})
