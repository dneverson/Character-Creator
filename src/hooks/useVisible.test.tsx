import { act, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useVisible } from './useVisible'

function Probe() {
  const ref = useRef<HTMLDivElement>(null)
  const visible = useVisible(ref)
  return <div ref={ref}>{visible ? 'seen' : 'not seen'}</div>
}

/** A stand-in observer the test drives by hand. */
function installObserver() {
  const observers: {
    report: (isIntersecting: boolean) => void
    observed: Element[]
    disconnected: boolean
  }[] = []
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      private readonly entry = {
        report: (isIntersecting: boolean) =>
          this.callback([{ isIntersecting } as IntersectionObserverEntry]),
        observed: [] as Element[],
        disconnected: false,
      }
      private readonly callback: (entries: IntersectionObserverEntry[]) => void
      constructor(callback: (entries: IntersectionObserverEntry[]) => void) {
        this.callback = callback
        observers.push(this.entry)
      }
      observe(element: Element) {
        this.entry.observed.push(element)
      }
      disconnect() {
        this.entry.disconnected = true
      }
    },
  )
  return observers
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useVisible', () => {
  it('reports everything as visible where the browser cannot observe', () => {
    render(<Probe />)
    expect(screen.getByText('seen')).toBeInTheDocument()
  })

  it('turns true the first time the element is on screen, and stays true', () => {
    const observers = installObserver()
    render(<Probe />)
    expect(screen.getByText('not seen')).toBeInTheDocument()
    expect(observers[0].observed).toEqual([screen.getByText('not seen')])

    act(() => observers[0].report(false))
    expect(screen.getByText('not seen')).toBeInTheDocument()

    act(() => observers[0].report(true))
    expect(screen.getByText('seen')).toBeInTheDocument()
    // Nothing left to watch for.
    expect(observers[0].disconnected).toBe(true)
    expect(observers).toHaveLength(1)
  })

  it('stops observing on unmount', () => {
    const observers = installObserver()
    const { unmount } = render(<Probe />)
    unmount()
    expect(observers[0].disconnected).toBe(true)
  })
})
