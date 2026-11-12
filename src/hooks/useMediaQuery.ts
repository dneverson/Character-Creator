import { useCallback, useSyncExternalStore } from 'react'

/**
 * Whether a CSS media query matches now, and again whenever that changes. A browser
 * without `matchMedia` reports that it does not match.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (typeof window.matchMedia !== 'function') return () => undefined
      const list = window.matchMedia(query)
      list.addEventListener('change', notify)
      return () => list.removeEventListener('change', notify)
    },
    [query],
  )
  const read = () =>
    typeof window.matchMedia === 'function' && window.matchMedia(query).matches
  return useSyncExternalStore(subscribe, read, () => false)
}
