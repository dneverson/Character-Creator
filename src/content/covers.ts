// Book covers. The full image is shown straight from the content source; table
// rows show a small thumbnail that the browser makes once from that image and
// keeps in its storage, so a grid of covers costs a few KB per row after the
// first visit instead of a few hundred.

import { contentConfig } from '../config/content'
import type { KeyValueStore } from '../storage/keyValue'
import { useContentSettings } from './settings'
import { fetchFromSource } from './source'

/** The URLs of a full cover image, one per host, in the order to try them. */
export function coverUrls(path: string): string[] {
  const { imageRepository, ref } = useContentSettings.getState().source
  return contentConfig.hosts.map((host) => host(imageRepository, ref, path))
}

/** The path of every cover the books file names, without duplicates. */
export function coverPaths(booksFile: unknown): string[] {
  const books = (booksFile as { book?: unknown } | null)?.book
  if (!Array.isArray(books)) return []
  const paths = new Set<string>()
  for (const book of books as { cover?: { type?: unknown; path?: unknown } }[]) {
    const cover = book?.cover
    if (cover?.type === 'internal' && typeof cover.path === 'string' && cover.path) {
      paths.add(cover.path)
    }
  }
  return [...paths]
}

/** The path of a cover inside the image repository, from its path in a picked folder. */
export function importedCoverPath(relativePath: string): string | null {
  const match = /(?:^|\/)(covers\/[^/]+\.webp)$/i.exec(relativePath)
  return match ? match[1] : null
}

export interface CoverLibraryOptions {
  thumbs: KeyValueStore<Blob>
  /** Scale an image down to the given width. */
  shrink: (image: Blob, width: number) => Promise<Blob>
}

export type CoverLibrary = ReturnType<typeof createCoverLibrary>

export function createCoverLibrary({ thumbs, shrink }: CoverLibraryOptions) {
  // Thumbnails ready to show, as object URLs that live as long as the page.
  const urls = new Map<string, string>()
  const loading = new Map<string, Promise<string>>()
  // Clearing the covers starts a new generation; a thumbnail still being made for
  // the old one is shown to whoever asked but is not kept.
  let generation = 0
  let prefetchRun = 0

  async function make(path: string, priority: RequestPriority): Promise<Blob | null> {
    const { source } = useContentSettings.getState()
    const response = await fetchFromSource(
      source.imageRepository,
      source.ref,
      path,
      priority,
    )
    const image = await response.blob()
    try {
      return await shrink(image, contentConfig.coverThumbWidth)
    } catch {
      // This browser cannot scale images itself.
      return null
    }
  }

  /**
   * The URL of a cover's thumbnail: from storage, or made now from the full image.
   * In a browser that cannot make thumbnails it is the full image's own URL.
   * Rejects when the cover cannot be had at all.
   */
  function load(path: string, priority: RequestPriority = 'high'): Promise<string> {
    const ready = urls.get(path)
    if (ready) return Promise.resolve(ready)
    const pending = loading.get(path)
    if (pending) return pending

    const startedIn = generation
    const task = (async () => {
      let thumb = await thumbs.get(path)
      if (!thumb) {
        thumb = (await make(path, priority)) ?? undefined
        if (!thumb) return coverUrls(path)[0]
        if (startedIn === generation) await thumbs.set(path, thumb)
      }
      const url = URL.createObjectURL(thumb)
      if (startedIn === generation) urls.set(path, url)
      return url
    })().finally(() => loading.delete(path))
    loading.set(path, task)
    return task
  }

  return {
    load,

    /** The thumbnail URL of a cover already loaded on this page, if any. */
    peek: (path: string): string | undefined => urls.get(path),

    /**
     * Make and store the thumbnails that are not stored yet, a few at a time, in
     * the background. A cover that cannot be had is skipped.
     */
    async prefetch(paths: string[]): Promise<void> {
      const run = ++prefetchRun
      const stored = new Set(await thumbs.keys())
      const wanted = paths.filter((path) => !stored.has(path))
      let next = 0
      async function worker() {
        while (next < wanted.length && run === prefetchRun) {
          await load(wanted[next++], 'low').catch(() => undefined)
        }
      }
      await Promise.all(
        Array.from({ length: contentConfig.backgroundConcurrency }, worker),
      )
    },

    /**
     * Store thumbnails for the cover images among files the visitor picked on
     * their own device. Returns how many were stored.
     */
    async importFiles(picked: File[]): Promise<number> {
      let count = 0
      for (const file of picked) {
        const path = importedCoverPath(file.webkitRelativePath || file.name)
        if (!path) continue
        try {
          await thumbs.set(path, await shrink(file, contentConfig.coverThumbWidth))
          count++
        } catch {
          // Not an image this browser can read: leave it out and carry on.
        }
      }
      return count
    },

    /** Stop the background work. Thumbnails already stored are kept. */
    stop() {
      prefetchRun++
    },

    /** Stop the background work and delete every stored thumbnail. */
    async clear(): Promise<void> {
      prefetchRun++
      generation++
      for (const url of urls.values()) URL.revokeObjectURL(url)
      urls.clear()
      await thumbs.clear()
    },
  }
}
