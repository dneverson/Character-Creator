// How the cloud saving is doing, in one line: the same words in the account menu and on
// the Account page.

import { useEffect, useState } from 'react'
import { appConfig } from '../../config/app'
import { useSyncStatus, type SyncState } from '../../cloud/sync'

/** How long ago, in a few words: "just now", "2 minutes ago", "3 hours ago", "2 days ago". */
export function relativeTime(then: number, now: number): string {
  const minutes = Math.floor(Math.max(0, now - then) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.floor(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

/** The line for a sync state; `lastSyncedAt` is when the cloud copy was last current. */
export function syncLine(
  state: SyncState,
  lastSyncedAt: number | null,
  now: number,
): string {
  switch (state) {
    case 'syncing':
      return 'Saving...'
    case 'offline':
      return 'Offline - will save when back online'
    case 'error':
      return 'Could not save - try again'
    case 'idle':
      return lastSyncedAt === null
        ? 'Saved to cloud'
        : `Saved to cloud ${relativeTime(lastSyncedAt, now)}`
  }
}

/** The current time, refreshed every `everyMs` so "2 minutes ago" keeps counting. */
function useNow(everyMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(timer)
  }, [everyMs])
  return now
}

/** The line for how the cloud saving is doing now, kept up to date. */
export function useSyncLine(): string {
  const state = useSyncStatus((status) => status.state)
  const lastSyncedAt = useSyncStatus((status) => status.lastSyncedAt)
  const now = useNow(appConfig.cloud.statusRefreshMs)
  return syncLine(state, lastSyncedAt, Math.max(now, lastSyncedAt ?? 0))
}
