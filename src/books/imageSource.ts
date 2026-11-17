// Where a picture of a book is and what it is called, for the page and the viewer.

import { useState } from 'react'
import { coverUrls } from '../content/covers'
import type { ImageEntry } from '../text/entryContext'

/** The address of a picture's file, trying each host of the image repository in turn. */
export function useImageSource(path: string | undefined) {
  const sources = path ? coverUrls(path) : []
  const [failed, setFailed] = useState(0)
  return {
    /** The address to try now, or undefined when every host has failed. */
    src: sources[failed] as string | undefined,
    /** A new address is a new request. */
    attempt: failed,
    failed: failed >= sources.length,
    onError: () => setFailed((count) => count + 1),
  }
}

/** The path of a picture's file when it is one of the repository's. */
export const pathOf = (image: ImageEntry): string | undefined =>
  image.href?.type === 'internal' ? image.href.path : undefined

/** The words a picture goes by: its title, or the name of the map. */
export const labelOf = (image: ImageEntry): string | undefined =>
  image.title ?? image.mapName
