import { describe, expect, it } from 'vitest'
import type { DeviceSettings } from '../storage/deviceSettings'
import { deviceSentEventsStore } from './sentEvents'

function memorySettings(): DeviceSettings & { items: Map<string, string> } {
  const items = new Map<string, string>()
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  }
}

describe('deviceSentEventsStore', () => {
  it("keeps one account's note and gives it back to that account only", () => {
    const store = deviceSentEventsStore(memorySettings(), 'sent')
    expect(store.load('user')).toEqual({})
    store.save('user', { a: ['e1', 'e2'] })
    expect(store.load('user')).toEqual({ a: ['e1', 'e2'] })
    expect(store.load('someone-else')).toEqual({})
  })

  it('forgets the setting once nothing is noted', () => {
    const settings = memorySettings()
    const store = deviceSentEventsStore(settings, 'sent')
    store.save('user', { a: ['e1'] })
    store.save('user', {})
    expect(settings.items.size).toBe(0)
  })

  it('reads nothing from a setting that is not what the app wrote', () => {
    const settings = memorySettings()
    const store = deviceSentEventsStore(settings, 'sent')
    settings.items.set('sent', 'not json')
    expect(store.load('user')).toEqual({})
    settings.items.set('sent', JSON.stringify({ userId: 'user', sent: { a: [1] } }))
    expect(store.load('user')).toEqual({})
    settings.items.set('sent', JSON.stringify({ userId: 'user', sent: null }))
    expect(store.load('user')).toEqual({})
  })

  it("forgets a deleted account's note, and leaves another account's", () => {
    const settings = memorySettings()
    const store = deviceSentEventsStore(settings, 'sent')
    store.save('user', { a: ['e1'] })
    store.forgetUser('other')
    expect(store.load('user')).toEqual({ a: ['e1'] })
    store.forgetUser('user')
    expect(settings.items.size).toBe(0)
  })
})
