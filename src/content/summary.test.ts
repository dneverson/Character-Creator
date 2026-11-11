import { renderHook, act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useContentStatus } from './library'
import { useContentSettings } from './settings'
import { summarizeContent, useContentSummary } from './summary'

const idle = {
  activity: 'idle',
  done: 0,
  total: 0,
  complete: false,
  unreachable: false,
} as const

describe('summarizeContent', () => {
  it('says the free rules are in use when the full content is not wanted', () => {
    expect(summarizeContent(idle, false)).toMatchObject({
      state: 'free',
      label: 'Free rules',
    })
    // Whatever the library last knew about the source does not matter then.
    expect(summarizeContent({ ...idle, unreachable: true }, false).state).toBe('free')
  })

  it('reports an import even before the full content is switched on', () => {
    expect(summarizeContent({ ...idle, activity: 'importing' }, false)).toMatchObject({
      state: 'importing',
      label: 'Importing',
    })
  })

  it('says when the source cannot be reached', () => {
    const summary = summarizeContent({ ...idle, unreachable: true }, true)
    expect(summary.state).toBe('unreachable')
    expect(summary.detail).toMatch(/free rules/)
  })

  it('counts the background download', () => {
    const summary = summarizeContent(
      { ...idle, activity: 'downloading', done: 12, total: 166 },
      true,
    )
    expect(summary).toMatchObject({ state: 'downloading', label: 'Downloading 12/166' })
    expect(summary.detail).toMatch(/12 of 166 files/)
  })

  it('tells stored content from content still fetched as needed', () => {
    const partial = summarizeContent(idle, true)
    const complete = summarizeContent({ ...idle, complete: true }, true)
    expect(partial.state).toBe('full')
    expect(complete.state).toBe('full')
    expect(partial.detail).toMatch(/as you open them/)
    expect(complete.detail).toMatch(/stored in this browser/)
  })
})

describe('useContentSummary', () => {
  it('follows the library and the visitor’s choice', () => {
    useContentStatus.setState({ ...idle })
    const { result } = renderHook(() => useContentSummary())
    expect(result.current.state).toBe('free')

    act(() => useContentSettings.setState({ fullContent: true }))
    expect(result.current.state).toBe('full')

    act(() => useContentStatus.setState({ unreachable: true }))
    expect(result.current.state).toBe('unreachable')
    act(() => useContentStatus.setState({ unreachable: false }))
  })
})
