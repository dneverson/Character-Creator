import { beforeEach, describe, expect, it } from 'vitest'
import { contentConfig } from '../config/content'
import { downloadPromptOpen, fullContentWanted, useContentSettings } from './settings'

beforeEach(() => {
  localStorage.clear()
  useContentSettings.setState({ fullContent: null, source: { ...contentConfig.source } })
})

describe('content settings', () => {
  it('starts undecided, on the configured source', () => {
    expect(useContentSettings.getState().fullContent).toBeNull()
    expect(useContentSettings.getState().source).toEqual(contentConfig.source)
  })

  it('remembers the choice and the source in localStorage', () => {
    const other = { ...contentConfig.source, dataRepository: 'someone/else' }
    useContentSettings.getState().setFullContent(false)
    useContentSettings.getState().setSource(other)

    const saved = JSON.parse(localStorage.getItem(contentConfig.settingsKey) ?? '{}')
    expect(saved.state).toEqual({ fullContent: false, source: other })
  })
})

describe('fullContentWanted', () => {
  it('follows the download mode until the visitor chooses', () => {
    expect(fullContentWanted(null, 'automatic')).toBe(true)
    expect(fullContentWanted(null, 'prompt')).toBe(false)
  })

  it('follows the visitor once they have chosen', () => {
    expect(fullContentWanted(true, 'prompt')).toBe(true)
    expect(fullContentWanted(false, 'automatic')).toBe(false)
  })

  it('reads the stored choice and the configured mode by default', () => {
    expect(fullContentWanted()).toBe(contentConfig.download === 'automatic')
    useContentSettings.getState().setFullContent(false)
    expect(fullContentWanted()).toBe(false)
  })
})

describe('downloadPromptOpen', () => {
  it('is open only in prompt mode, before a choice is made', () => {
    expect(downloadPromptOpen(null, 'prompt')).toBe(true)
    expect(downloadPromptOpen(null, 'automatic')).toBe(false)
    expect(downloadPromptOpen(true, 'prompt')).toBe(false)
    expect(downloadPromptOpen(false, 'prompt')).toBe(false)
  })

  it('reads the stored choice and the configured mode by default', () => {
    expect(downloadPromptOpen()).toBe(contentConfig.download === 'prompt')
  })
})
