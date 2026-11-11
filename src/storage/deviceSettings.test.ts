import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deviceSettings } from './deviceSettings'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('deviceSettings', () => {
  it('reads, writes and removes a setting in localStorage', () => {
    expect(deviceSettings.getItem('k')).toBeNull()
    deviceSettings.setItem('k', 'v')
    expect(localStorage.getItem('k')).toBe('v')
    expect(deviceSettings.getItem('k')).toBe('v')
    deviceSettings.removeItem('k')
    expect(localStorage.getItem('k')).toBeNull()
  })

  it('never throws when the browser refuses localStorage', () => {
    const refuse = () => {
      throw new Error('storage is blocked')
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(refuse)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(refuse)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(refuse)

    expect(deviceSettings.getItem('k')).toBeNull()
    expect(() => deviceSettings.setItem('k', 'v')).not.toThrow()
    expect(() => deviceSettings.removeItem('k')).not.toThrow()
  })
})
