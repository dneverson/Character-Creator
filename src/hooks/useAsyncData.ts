import { useEffect, useState } from 'react'
import { useContentStatus } from '../content/library'

export interface AsyncData<T> {
  data: T | null
  error: Error | null
  loading: boolean
}

/**
 * Run an async loader on mount and whenever the loader identity changes,
 * tracking loading/error/data and ignoring results after unmount.
 *
 * Pass a stable loader: a module-level function, or one wrapped in `useCallback`
 * when it depends on props/state. State is only updated from the async result,
 * so on a loader change the previous data remains visible until the new data
 * arrives (no loading flash on refetch).
 *
 * The loader also runs again when the book content changes wholesale (the full
 * content is switched on or off, imported, or its source changes), so every
 * section shows the content now in use without a page reload.
 */
export function useAsyncData<T>(loader: () => Promise<T>): AsyncData<T> {
  const [state, setState] = useState<AsyncData<T>>({
    data: null,
    error: null,
    loading: true,
  })

  const contentEpoch = useContentStatus((status) => status.epoch)

  useEffect(() => {
    let active = true
    loader()
      .then((data) => {
        if (active) setState({ data, error: null, loading: false })
      })
      .catch((error: unknown) => {
        if (active)
          setState({
            data: null,
            error: error instanceof Error ? error : new Error(String(error)),
            loading: false,
          })
      })
    return () => {
      active = false
    }
  }, [loader, contentEpoch])

  return state
}
