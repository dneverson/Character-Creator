// A small asynchronous key-value store, and the choice of where it keeps its data.
// Everything the app stores in the browser beyond a few settings goes through this
// interface, so the backing technology can change without touching its users.

import { idbStore } from './idb'

/** An asynchronous key-value store. Values must survive a structured clone. */
export interface KeyValueStore<V> {
  get(key: string): Promise<V | undefined>
  set(key: string, value: V): Promise<void>
  delete(key: string): Promise<void>
  keys(): Promise<string[]>
  clear(): Promise<void>
}

/** A store that lives only as long as the page. */
export function memoryStore<V>(): KeyValueStore<V> {
  const entries = new Map<string, V>()
  return {
    get: async (key) => entries.get(key),
    set: async (key, value) => {
      entries.set(key, value)
    },
    delete: async (key) => {
      entries.delete(key)
    },
    keys: async () => [...entries.keys()],
    clear: async () => {
      entries.clear()
    },
  }
}

/**
 * Wrap a store so that its first failure switches every later call to a memory
 * store. A browser can refuse persistent storage at any time (private windows, a
 * full disk, a blocked database); the app then keeps working for the session
 * instead of failing each read and write. `onFallback` is told once, when the
 * switch happens, so its caller can say that nothing is being kept.
 */
export function withMemoryFallback<V>(
  primary: KeyValueStore<V>,
  onFallback?: () => void,
): KeyValueStore<V> {
  let active = primary
  function run<R>(operation: (store: KeyValueStore<V>) => Promise<R>): Promise<R> {
    // Only the primary can reject (the memory store never does), so a failure
    // here always means: stop using the primary. Calls that fail together share
    // the one memory store the first of them switched to.
    return operation(active).catch(() => {
      if (active === primary) {
        active = memoryStore<V>()
        onFallback?.()
      }
      return operation(active)
    })
  }
  return {
    get: (key) => run((store) => store.get(key)),
    set: (key, value) => run((store) => store.set(key, value)),
    delete: (key) => run((store) => store.delete(key)),
    keys: () => run((store) => store.keys()),
    clear: () => run((store) => store.clear()),
  }
}

/**
 * Open the named store: persistent in the browser's database when there is one,
 * otherwise (and after any storage failure) in memory. `onUnavailable` is told
 * once if the store is, or becomes, memory only.
 */
export function openStore<V>(name: string, onUnavailable?: () => void): KeyValueStore<V> {
  if (typeof indexedDB === 'undefined') {
    onUnavailable?.()
    return memoryStore<V>()
  }
  return withMemoryFallback(idbStore<V>(name), onUnavailable)
}
