// The deletions made while signed in that the cloud has not heard of yet, kept in a
// device setting (one account's at a time) so a closed page does not lose them.

import type { DeviceSettings } from '../storage/deviceSettings'
import type { RemovalStore } from './sync'

function isTimes(value: unknown): value is Record<string, number> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every((at) => typeof at === 'number')
  )
}

export function deviceRemovalStore(
  settings: DeviceSettings,
  key: string,
  lastUserKey: string,
): RemovalStore {
  return {
    lastUserId: () => settings.getItem(lastUserKey),
    rememberUser: (userId) => settings.setItem(lastUserKey, userId),
    forgetUser(userId) {
      if (settings.getItem(lastUserKey) === userId) settings.removeItem(lastUserKey)
      this.save(userId, {})
    },
    load(userId) {
      const text = settings.getItem(key)
      if (text === null) return {}
      try {
        const saved: unknown = JSON.parse(text)
        if (
          typeof saved === 'object' &&
          saved !== null &&
          'userId' in saved &&
          saved.userId === userId &&
          'removals' in saved &&
          isTimes(saved.removals)
        ) {
          return saved.removals
        }
      } catch {
        // Not what the app wrote: there is nothing waiting.
      }
      return {}
    },
    save(userId, removals) {
      if (Object.keys(removals).length === 0) settings.removeItem(key)
      else settings.setItem(key, JSON.stringify({ userId, removals }))
    },
  }
}
