// The IndexedDB backing for a KeyValueStore: one database per store name, holding
// a single object store. Keeping each store in its own database means no store's
// layout change ever needs a coordinated version upgrade with another.
//
// This file is the only code that talks to IndexedDB. The unit test environment
// has no IndexedDB, so it is exercised in a real browser by `pnpm verify:content`.

import type { KeyValueStore } from './keyValue'

const OBJECT_STORE = 'entries'

export function idbStore<V>(name: string): KeyValueStore<V> {
  let opening: Promise<IDBDatabase> | undefined

  function open(): Promise<IDBDatabase> {
    opening ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, 1)
      request.onupgradeneeded = () => {
        request.result.createObjectStore(OBJECT_STORE)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error(`Database "${name}" is blocked`))
    })
    return opening
  }

  async function run<R>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<R>,
  ): Promise<R> {
    const database = await open()
    return new Promise<R>((resolve, reject) => {
      const transaction = database.transaction(OBJECT_STORE, mode)
      const request = operation(transaction.objectStore(OBJECT_STORE))
      // Resolve on commit, not on the request, so a write is durable once awaited.
      transaction.oncomplete = () => resolve(request.result)
      transaction.onerror = () => reject(transaction.error ?? request.error)
      transaction.onabort = () => reject(transaction.error ?? request.error)
    })
  }

  return {
    get: (key) => run<V | undefined>('readonly', (store) => store.get(key)),
    set: async (key, value) => {
      await run('readwrite', (store) => store.put(value, key))
    },
    delete: async (key) => {
      await run('readwrite', (store) => store.delete(key))
    },
    keys: async () => {
      const keys = await run('readonly', (store) => store.getAllKeys())
      return keys.map(String)
    },
    clear: async () => {
      await run('readwrite', (store) => store.clear())
    },
  }
}
