// The one door to book data. A file comes from one of two places:
//
//   - the full content, which the visitor's browser downloads from the configured
//     source and stores (src/content), when they have it switched on; or
//   - the free rules, the SRD content this site hosts under `<base>data/`.
//
// Loaders ask for a path and never know which of the two answered. If the full
// content is wanted but a file cannot be had from it (source unreachable, file
// not there), the free rules answer instead.

import { contentLibrary } from '../content'
import { contentCache } from '../content/epoch'
import { fullContentWanted } from '../content/settings'

const cleanPath = (path: string) => path.replace(/^\/+/, '')

/** The URL of a file of the free rules, respecting the site's base path. */
export function dataUrl(path: string): string {
  return `${import.meta.env.BASE_URL}data/${cleanPath(path)}`
}

async function fetchFreeRules(key: string): Promise<unknown> {
  const response = await fetch(dataUrl(key))
  if (!response.ok) {
    throw new Error(`Failed to load data "${key}": HTTP ${response.status}`)
  }
  return response.json()
}

async function load(key: string): Promise<unknown> {
  if (fullContentWanted()) {
    try {
      return await contentLibrary.read(key)
    } catch {
      // Not available from the full content; the free rules may have it.
    }
  }
  return fetchFreeRules(key)
}

const cache = contentCache<unknown>()

/**
 * Fetch and parse a JSON data file. The parsed file is kept for the rest of the
 * visit, so concurrent and repeat requests share one load.
 */
export function fetchData<T>(path: string): Promise<T> {
  const key = cleanPath(path)
  return cache.get(key, () => load(key)) as Promise<T>
}

/**
 * Fetch and parse a JSON data file without keeping it. For a large file that is
 * read once to derive something small (a book's text, for its page numbers).
 */
export function fetchDataUncached<T>(path: string): Promise<T> {
  return load(cleanPath(path)) as Promise<T>
}

/** Test-only: clear the in-memory data cache. */
export function _clearDataCache(): void {
  cache.clear()
}
