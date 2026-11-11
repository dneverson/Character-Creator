import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { coverLibrary } from '.'
import { useContentStatus } from './library'
import { useCoverThumb } from './useCoverThumb'

vi.mock('.', () => ({ coverLibrary: { load: vi.fn(), peek: vi.fn() } }))
const load = vi.mocked(coverLibrary.load)
const peek = vi.mocked(coverLibrary.peek)

const PHB = 'covers/PHB.webp'

beforeEach(() => {
  load.mockReset()
  peek.mockReset()
  useContentStatus.setState({ epoch: 0 })
})

describe('useCoverThumb', () => {
  it('is loading, then ready with the thumbnail URL', async () => {
    load.mockResolvedValue('blob:phb')
    const { result } = renderHook(() => useCoverThumb(PHB))

    expect(result.current).toEqual({ status: 'loading' })
    await waitFor(() =>
      expect(result.current).toEqual({ status: 'ready', url: 'blob:phb' }),
    )
    expect(load).toHaveBeenCalledWith(PHB)
  })

  it('is unavailable when the cover cannot be had', async () => {
    load.mockRejectedValue(new Error('gone'))
    const { result } = renderHook(() => useCoverThumb(PHB))
    await waitFor(() => expect(result.current).toEqual({ status: 'unavailable' }))
  })

  it('is unavailable, without asking, for a book with no cover', () => {
    const { result } = renderHook(() => useCoverThumb(null))
    expect(result.current).toEqual({ status: 'unavailable' })
    expect(load).not.toHaveBeenCalled()
  })

  it('waits until the thumbnail is wanted', async () => {
    load.mockResolvedValue('blob:phb')
    const { result, rerender } = renderHook(({ wanted }) => useCoverThumb(PHB, wanted), {
      initialProps: { wanted: false },
    })
    expect(result.current).toEqual({ status: 'loading' })
    expect(load).not.toHaveBeenCalled()

    rerender({ wanted: true })
    await waitFor(() => expect(result.current.status).toBe('ready'))
  })

  it('shows a thumbnail already loaded on this page at once', () => {
    peek.mockReturnValue('blob:held')
    const { result } = renderHook(() => useCoverThumb(PHB, false))
    expect(result.current).toEqual({ status: 'ready', url: 'blob:held' })
  })

  it('loads again when the content changes wholesale', async () => {
    load.mockResolvedValueOnce('blob:first').mockResolvedValueOnce('blob:second')
    const { result } = renderHook(() => useCoverThumb(PHB))
    await waitFor(() =>
      expect(result.current).toEqual({ status: 'ready', url: 'blob:first' }),
    )

    act(() => useContentStatus.setState({ epoch: 1 }))
    expect(result.current).toEqual({ status: 'loading' })
    await waitFor(() =>
      expect(result.current).toEqual({ status: 'ready', url: 'blob:second' }),
    )
  })

  it('ignores an answer that arrives after unmount', async () => {
    let resolve!: (url: string) => void
    load.mockReturnValue(new Promise((r) => (resolve = r)))
    const { result, unmount } = renderHook(() => useCoverThumb(PHB))

    unmount()
    resolve('blob:late')
    await Promise.resolve()
    expect(result.current).toEqual({ status: 'loading' })
  })
})
