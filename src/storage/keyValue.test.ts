import { describe, expect, it, vi } from 'vitest'
import {
  memoryStore,
  openStore,
  withMemoryFallback,
  type KeyValueStore,
} from './keyValue'

describe('memoryStore', () => {
  it('stores, lists, deletes and clears values', async () => {
    const store = memoryStore<number>()
    expect(await store.get('a')).toBeUndefined()

    await store.set('a', 1)
    await store.set('b', 2)
    expect(await store.get('a')).toBe(1)
    expect((await store.keys()).sort()).toEqual(['a', 'b'])

    await store.delete('a')
    expect(await store.get('a')).toBeUndefined()

    await store.clear()
    expect(await store.keys()).toEqual([])
  })
})

/** A store whose every operation rejects, as a blocked browser database does. */
function brokenStore<V>(): KeyValueStore<V> {
  const fail = () => Promise.reject(new Error('storage is blocked'))
  return { get: fail, set: fail, delete: fail, keys: fail, clear: fail }
}

describe('withMemoryFallback', () => {
  it('uses the primary store while it works', async () => {
    const primary = memoryStore<string>()
    const store = withMemoryFallback(primary)
    await store.set('k', 'v')
    expect(await primary.get('k')).toBe('v')
    expect(await store.get('k')).toBe('v')
    expect(await store.keys()).toEqual(['k'])
    await store.delete('k')
    expect(await primary.get('k')).toBeUndefined()
    await store.set('k', 'v')
    await store.clear()
    expect(await primary.keys()).toEqual([])
  })

  it('keeps working in memory after the primary store fails', async () => {
    const store = withMemoryFallback(brokenStore<string>())
    // The failing call itself is answered from the memory store.
    await store.set('k', 'v')
    expect(await store.get('k')).toBe('v')
    expect(await store.keys()).toEqual(['k'])
    await store.delete('k')
    expect(await store.get('k')).toBeUndefined()
    await store.clear()
    expect(await store.keys()).toEqual([])
  })

  it('says once that it fell back, and keeps what failed together', async () => {
    const onFallback = vi.fn()
    const store = withMemoryFallback(brokenStore<string>(), onFallback)
    expect(onFallback).not.toHaveBeenCalled()

    // Two writes fail at the same moment: both land in the one memory store.
    await Promise.all([store.set('a', '1'), store.set('b', '2')])
    expect((await store.keys()).sort()).toEqual(['a', 'b'])
    expect(onFallback).toHaveBeenCalledTimes(1)
  })
})

describe('openStore', () => {
  it('falls back to memory where the browser database does not exist', async () => {
    // The unit test environment has no IndexedDB.
    const onUnavailable = vi.fn()
    const store = openStore<number>('test-store', onUnavailable)
    expect(onUnavailable).toHaveBeenCalledTimes(1)
    await store.set('n', 7)
    expect(await store.get('n')).toBe(7)
    // Nobody has to listen.
    expect(await openStore<number>('quiet-store').get('n')).toBeUndefined()
  })
})
