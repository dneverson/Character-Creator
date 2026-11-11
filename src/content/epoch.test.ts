import { beforeEach, describe, expect, it, vi } from 'vitest'
import { contentCache, contentEpoch, memoizeContent } from './epoch'
import { useContentStatus } from './library'

beforeEach(() => {
  useContentStatus.setState({ epoch: 0 })
})

describe('contentEpoch', () => {
  it('reads the current epoch', () => {
    expect(contentEpoch()).toBe(0)
    useContentStatus.setState({ epoch: 3 })
    expect(contentEpoch()).toBe(3)
  })
})

describe('contentCache', () => {
  it('loads each key once and shares the result', async () => {
    const cache = contentCache<string>()
    const load = vi.fn((key: string) => Promise.resolve(`value of ${key}`))

    const first = cache.get('a', () => load('a'))
    expect(cache.get('a', () => load('a'))).toBe(first)
    expect(await first).toBe('value of a')
    expect(await cache.get('b', () => load('b'))).toBe('value of b')
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('empties itself when the content changes wholesale', async () => {
    const cache = contentCache<number>()
    const load = vi.fn(() => Promise.resolve(contentEpoch()))

    expect(await cache.get('a', load)).toBe(0)
    useContentStatus.setState({ epoch: 1 })
    expect(await cache.get('a', load)).toBe(1)
    expect(await cache.get('a', load)).toBe(1)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('does not keep a failure, and leaves a newer load of the same key alone', async () => {
    const cache = contentCache<string>()
    let fail: (reason: Error) => void = () => undefined
    const failing = new Promise<string>((_, reject) => {
      fail = reject
    })

    const stale = cache.get('a', () => failing)
    // The content changes while the first load is still running; the key is
    // loaded afresh, and the late failure of the old load must not evict it.
    useContentStatus.setState({ epoch: 1 })
    const fresh = cache.get('a', () => Promise.resolve('fresh'))
    fail(new Error('offline'))
    await expect(stale).rejects.toThrow('offline')

    const load = vi.fn(() => Promise.resolve('again'))
    expect(cache.get('a', load)).toBe(fresh)
    expect(load).not.toHaveBeenCalled()

    // A failure of the load that is held is dropped, so the next call retries.
    await expect(cache.get('b', () => Promise.reject(new Error('gone')))).rejects.toThrow(
      'gone',
    )
    expect(await cache.get('b', load)).toBe('again')
  })

  it('drops everything on clear', async () => {
    const cache = contentCache<string>()
    const load = vi.fn(() => Promise.resolve('value'))

    await cache.get('a', load)
    cache.clear()
    await cache.get('a', load)
    expect(load).toHaveBeenCalledTimes(2)
  })
})

describe('memoizeContent', () => {
  it('computes once and hands every caller the same result', async () => {
    const load = vi.fn(() => Promise.resolve(['a']))
    const memoized = memoizeContent(load)

    expect(await memoized()).toEqual(['a'])
    expect(memoized()).toBe(memoized())
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('computes again after the content changes wholesale', async () => {
    const load = vi.fn(() => Promise.resolve(contentEpoch()))
    const memoized = memoizeContent(load)

    expect(await memoized()).toBe(0)
    useContentStatus.setState({ epoch: 1 })
    expect(await memoized()).toBe(1)
    expect(await memoized()).toBe(1)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('does not keep a failure', async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue('ok')
    const memoized = memoizeContent(load)

    await expect(memoized()).rejects.toThrow('offline')
    await expect(memoized()).resolves.toBe('ok')
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('drops what it holds on clear', async () => {
    const load = vi.fn(() => Promise.resolve('value'))
    const memoized = memoizeContent(load)

    await memoized()
    memoized.clear()
    await memoized()
    expect(load).toHaveBeenCalledTimes(2)
  })
})
