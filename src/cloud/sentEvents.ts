// The history entries already sent to the server's ledger, kept in a device setting (one
// account's at a time) so a long history is not sent again at every sync. The note is only
// a saving: without it the entries are sent once more and the ledger ignores the repeats.

import type { DeviceSettings } from '../storage/deviceSettings'
import type { SentEventsStore } from './sync'

function isSent(value: unknown): value is Record<string, string[]> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every(
      (ids) => Array.isArray(ids) && ids.every((id) => typeof id === 'string'),
    )
  )
}

export function deviceSentEventsStore(
  settings: DeviceSettings,
  key: string,
): SentEventsStore {
  const load: SentEventsStore['load'] = (userId) => {
    const text = settings.getItem(key)
    if (text === null) return {}
    try {
      const saved: unknown = JSON.parse(text)
      if (
        typeof saved === 'object' &&
        saved !== null &&
        'userId' in saved &&
        saved.userId === userId &&
        'sent' in saved &&
        isSent(saved.sent)
      ) {
        return saved.sent
      }
    } catch {
      // Not what the app wrote: nothing counts as sent.
    }
    return {}
  }
  return {
    load,
    save(userId, sent) {
      if (Object.keys(sent).length === 0) settings.removeItem(key)
      else settings.setItem(key, JSON.stringify({ userId, sent }))
    },
    forgetUser(userId) {
      if (Object.keys(load(userId)).length > 0) settings.removeItem(key)
    },
  }
}
