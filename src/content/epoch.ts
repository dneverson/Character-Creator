// The content epoch: a number that changes whenever every file may have changed
// at once (see `ContentStatus.epoch`). Anything that holds loaded book data keys
// it on this number, so nothing from the previous content is served afterwards.

import { useContentStatus } from './library'

export function contentEpoch(): number {
  return useContentStatus.getState().epoch
}

/**
 * A cache of loaded content by key. Each value is loaded once and shared by every
 * caller; the cache empties itself when the content changes wholesale, and a
 * failed load is not kept, so a later call tries again.
 */
export function contentCache<T>() {
  let epoch = contentEpoch()
  const entries = new Map<string, Promise<T>>()
  return {
    get(key: string, load: () => Promise<T>): Promise<T> {
      if (epoch !== contentEpoch()) {
        entries.clear()
        epoch = contentEpoch()
      }
      let pending = entries.get(key)
      if (!pending) {
        const request = load()
        request.catch(() => {
          if (entries.get(key) === request) entries.delete(key)
        })
        entries.set(key, request)
        pending = request
      }
      return pending
    },
    clear: () => entries.clear(),
  }
}

/** A memoized loader, with a way to drop what it holds (used by tests). */
export type MemoizedLoader<T> = (() => Promise<T>) & { clear: () => void }

/**
 * Wrap a loader so its result is computed once and reused until the content
 * changes wholesale. For loaders that turn several files into one prepared list.
 */
export function memoizeContent<T>(load: () => Promise<T>): MemoizedLoader<T> {
  const cache = contentCache<T>()
  return Object.assign(() => cache.get('', load), { clear: cache.clear })
}
