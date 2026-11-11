import { useEffect, useState } from 'react'
import { coverLibrary } from '.'
import { useContentStatus } from './library'

/** Where a cover thumbnail stands: still coming, ready to show, or not to be had. */
export type CoverThumb =
  { status: 'loading' } | { status: 'ready'; url: string } | { status: 'unavailable' }

const LOADING: CoverThumb = { status: 'loading' }
const UNAVAILABLE: CoverThumb = { status: 'unavailable' }

/**
 * The thumbnail of a cover, by its path in the image repository. Loading starts
 * once `wanted` is true, so a long table only fetches the covers of the rows on
 * screen; a thumbnail already loaded on this page is returned at once.
 */
export function useCoverThumb(path: string | null, wanted = true): CoverThumb {
  const epoch = useContentStatus((status) => status.epoch)
  const key = `${epoch}:${path}`
  const [result, setResult] = useState<{ key: string; thumb: CoverThumb } | null>(null)

  useEffect(() => {
    if (!path || !wanted) return
    let active = true
    coverLibrary.load(path).then(
      (url) => {
        if (active) setResult({ key, thumb: { status: 'ready', url } })
      },
      () => {
        if (active) setResult({ key, thumb: UNAVAILABLE })
      },
    )
    return () => {
      active = false
    }
  }, [path, wanted, key])

  if (!path) return UNAVAILABLE
  if (result?.key === key) return result.thumb
  const ready = coverLibrary.peek(path)
  return ready ? { status: 'ready', url: ready } : LOADING
}
