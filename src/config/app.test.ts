import { describe, expect, it } from 'vitest'
import { appConfig } from './app'

describe('appConfig', () => {
  it('exposes non-empty branding fields', () => {
    expect(appConfig.name).toBeTruthy()
    expect(appConfig.fullName).toBeTruthy()
    expect(appConfig.shortName).toBeTruthy()
    expect(appConfig.description).toBeTruthy()
  })

  it('names the author and the Matrix Dice credit', () => {
    expect(appConfig.author.trim()).not.toBe('')
    expect(appConfig.matrixDiceIdea.trim()).not.toBe('')
  })

  it('points at an https repository url with a label', () => {
    expect(appConfig.repository.url).toMatch(/^https:\/\//)
    expect(appConfig.repository.label).toBeTruthy()
  })

  it('defines the persistence keys consumed elsewhere', () => {
    // These literals are also mirrored in index.html (theme) and must not drift.
    expect(appConfig.storageKeys.theme).toBe('cc-theme')
    expect(appConfig.storageKeys.characters).toBe('cc-characters')
  })

  it('names where the characters are kept, apart from where they were', () => {
    expect(appConfig.stores.characters).toBeTruthy()
    // The marker of the move must not be taken for the earlier characters.
    expect(appConfig.storageKeys.charactersMoved).not.toBe(
      appConfig.storageKeys.characters,
    )
    expect(appConfig.characterLoadWaitMs).toBeGreaterThan(0)
  })
})
