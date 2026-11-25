import { describe, expect, it } from 'vitest'
import type { DeviceSettings } from '../storage/deviceSettings'
import { deviceRemovalStore } from './removals'

function memorySettings(): DeviceSettings & { items: Map<string, string> } {
  const items = new Map<string, string>()
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  }
}

describe('deviceRemovalStore', () => {
  it("keeps one account's waiting deletions and gives them back to that account only", () => {
    const settings = memorySettings()
    const store = deviceRemovalStore(settings, 'removals', 'last-user')
    expect(store.load('user')).toEqual({})
    store.save('user', { a: 5 })
    expect(store.load('user')).toEqual({ a: 5 })
    expect(store.load('someone-else')).toEqual({})
  })

  it('forgets the setting once nothing is waiting', () => {
    const settings = memorySettings()
    const store = deviceRemovalStore(settings, 'removals', 'last-user')
    store.save('user', { a: 5 })
    store.save('user', {})
    expect(settings.items.size).toBe(0)
  })

  it('reads nothing from a setting that is not what the app wrote', () => {
    const settings = memorySettings()
    const store = deviceRemovalStore(settings, 'removals', 'last-user')
    for (const text of ['not json', '{"userId":"user","removals":{"a":"x"}}', '[]']) {
      settings.setItem('removals', text)
      expect(store.load('user')).toEqual({})
    }
  })
})

describe('the last signed-in account', () => {
  it('is remembered and forgotten with its deletions', () => {
    const settings = memorySettings()
    const store = deviceRemovalStore(settings, 'removals', 'last-user')
    expect(store.lastUserId()).toBeNull()
    store.rememberUser('user')
    store.save('user', { a: 5 })
    expect(store.lastUserId()).toBe('user')
    store.forgetUser('user')
    expect(store.lastUserId()).toBeNull()
    expect(store.load('user')).toEqual({})
  })
})
