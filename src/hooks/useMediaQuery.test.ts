import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useMediaQuery } from './useMediaQuery'

const original = window.matchMedia

function setMatchMedia(value: typeof window.matchMedia | undefined) {
  Object.defineProperty(window, 'matchMedia', {
    value,
    configurable: true,
    writable: true,
  })
}

afterEach(() => setMatchMedia(original))

describe('useMediaQuery', () => {
  it('follows the query as the window changes', () => {
    let matches = false
    const listeners = new Set<EventListenerOrEventListenerObject>()
    setMatchMedia(
      (query: string): MediaQueryList =>
        ({
          get matches() {
            return matches
          },
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
          addEventListener: (_type: string, fn: EventListenerOrEventListenerObject) => {
            listeners.add(fn)
          },
          removeEventListener: (
            _type: string,
            fn: EventListenerOrEventListenerObject,
          ) => {
            listeners.delete(fn)
          },
        }) as MediaQueryList,
    )
    const { result, unmount } = renderHook(() => useMediaQuery('(max-width: 767px)'))
    expect(result.current).toBe(false)
    matches = true
    act(() =>
      listeners.forEach((fn) => typeof fn === 'function' && fn(new Event('change'))),
    )
    expect(result.current).toBe(true)
    unmount()
    expect(listeners.size).toBe(0)
  })

  it('reports no match in a browser without matchMedia', () => {
    setMatchMedia(undefined)
    const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'))
    expect(result.current).toBe(false)
  })
})
