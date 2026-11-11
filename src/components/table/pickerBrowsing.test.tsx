import { act, renderHook } from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest'
import { usePickerBrowsing } from './pickerBrowsing'

let scroll: MockInstance<Element['scrollIntoView']>
beforeEach(() => {
  scroll = vi.spyOn(Element.prototype, 'scrollIntoView')
})
afterEach(() => scroll.mockRestore())

describe('usePickerBrowsing', () => {
  it('is shut by default and opened and shut by the picker itself', () => {
    const { result } = renderHook(() => usePickerBrowsing({}))
    expect(result.current.browsing).toBe(false)
    act(() => result.current.setBrowsing(true))
    expect(result.current.browsing).toBe(true)
    act(() => result.current.setBrowsing(false))
    expect(result.current.browsing).toBe(false)
  })

  it('starts open when asked to', () => {
    const { result } = renderHook(() => usePickerBrowsing({ initiallyOpen: true }))
    expect(result.current.browsing).toBe(true)
    act(() => result.current.setBrowsing(false))
    expect(result.current.browsing).toBe(false)
  })

  it('is open whenever the picker is idle', () => {
    const { result, rerender } = renderHook(
      ({ idle }) => usePickerBrowsing({ openWhenIdle: idle }),
      { initialProps: { idle: true } },
    )
    expect(result.current.browsing).toBe(true)
    rerender({ idle: false })
    expect(result.current.browsing).toBe(false)
    act(() => result.current.setBrowsing(true))
    expect(result.current.browsing).toBe(true)
  })

  it('leaves the decision to the section when it passes browsing', () => {
    const onBrowsingChange = vi.fn()
    const { result, rerender } = renderHook(
      ({ browsing }) =>
        usePickerBrowsing({ browsing, onBrowsingChange, openWhenIdle: true }),
      { initialProps: { browsing: false } },
    )
    expect(result.current.browsing).toBe(false)
    act(() => result.current.setBrowsing(true))
    expect(onBrowsingChange).toHaveBeenCalledWith(true)
    expect(result.current.browsing).toBe(false)
    rerender({ browsing: true })
    expect(result.current.browsing).toBe(true)
  })

  it('does not need a listener for the section to decide', () => {
    const { result } = renderHook(() => usePickerBrowsing({ browsing: true }))
    act(() => result.current.setBrowsing(false))
    expect(result.current.browsing).toBe(true)
  })

  it('scrolls the summary into view once the table shuts, not before', () => {
    const { result, rerender } = renderHook(
      ({ browsing }) => usePickerBrowsing({ browsing }),
      { initialProps: { browsing: true } },
    )
    const summary = document.createElement('div')
    result.current.summary.current = summary
    expect(scroll).not.toHaveBeenCalled()
    rerender({ browsing: false })
    expect(scroll).toHaveBeenCalledTimes(1)
    expect(scroll.mock.contexts[0]).toBe(summary)
    rerender({ browsing: false })
    expect(scroll).toHaveBeenCalledTimes(1)
  })
})
