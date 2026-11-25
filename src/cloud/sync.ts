// Keeping the cloud copy of the characters up to date while someone is signed in.
//
// The device stays the primary store: the app reads and writes it as always, and this
// engine follows along in the background. It never blocks a save, and a failure (no
// connection, the service down) only changes the status and schedules another try.
//
//  - On sign-in, and again when the connection comes back or a try failed, it reconciles:
//    reads the cloud's rows, joins them with the device's characters (merge.ts), stores
//    the result on the device and sends what the cloud lacks.
//  - A save or a deletion is sent shortly after it, with others that follow it. A
//    deletion is also written down on the device until the cloud has it, so that closing
//    the page while offline does not bring the character back at the next sign-in.

import { create } from 'zustand'
import type { Character } from '../character/model'
import type { CharacterStorage } from '../storage/characters'
import { CloudOfflineError, type CloudBackend, type RemoteRow } from './backend'
import { deletedRow, liveRow, planSync, readRows } from './merge'

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error'

/** How the sync is doing, for the account page. */
export const useSyncStatus = create<{
  state: SyncState
  /** When the cloud copy was last brought up to date, in milliseconds; null before that. */
  lastSyncedAt: number | null
}>()(() => ({ state: 'idle', lastSyncedAt: null }))

/** What reconciling changed on this device, for the app to show. */
export interface RemoteChange {
  upserts: Character[]
  removedIds: string[]
}

/** Deletions the cloud has not heard of yet, kept on the device for one account. */
export interface RemovalStore {
  load(userId: string): Record<string, number>
  save(userId: string, removals: Record<string, number>): void
  /** The account last signed in on this device, if it is still known. */
  lastUserId(): string | null
  /** Note which account is signed in, so a deletion made after it signs out is its own. */
  rememberUser(userId: string): void
  /** Forget an account (it was deleted): its waiting deletions and its place as last. */
  forgetUser(userId: string): void
}

export interface SyncOptions {
  /** The characters on this device. */
  local: CharacterStorage
  removals: RemovalStore
  /** Told when the cloud changed characters on this device. */
  onRemote: (change: RemoteChange) => void
  /** How long saves wait for further saves before they are sent. */
  debounceMs: number
  /** How long after a failed try the next one is made. */
  retryMs: number
  now?: () => number
}

export interface SyncEngine {
  /** Begin syncing for this account, starting with a full reconcile. Never rejects. */
  start(backend: CloudBackend, userId: string): Promise<void>
  /** Stop syncing (signed out). What is on the device stays. */
  stop(): void
  /** A character was saved on this device. */
  noteSave(character: Character): void
  /** A character was removed from this device. */
  noteRemove(id: string): void
  /** An account was deleted: nothing waiting for it will ever be sent. */
  forget(userId: string): void
  /** Reconcile now. Never rejects. */
  syncNow(): Promise<void>
}

export function createSyncEngine(options: SyncOptions): SyncEngine {
  const { local, removals, onRemote, debounceMs, retryMs } = options
  const now = options.now ?? Date.now
  const setState = (state: SyncState) => useSyncStatus.setState({ state })

  let backend: CloudBackend | null = null
  let userId = ''
  let chain: Promise<void> = Promise.resolve()
  let flushTimer: ReturnType<typeof setTimeout> | undefined
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  const pendingSaves = new Map<string, Character>()
  const pendingRemovals = new Map<string, number>()
  // What the cloud just gave this device comes back through the app's own saving; it is
  // recognised here, so it is not sent straight back.
  const received = new WeakSet<Character>()
  const receivedRemovals = new Set<string>()

  const persistRemovals = () => removals.save(userId, Object.fromEntries(pendingRemovals))

  function clearTimers() {
    clearTimeout(flushTimer)
    clearTimeout(retryTimer)
    flushTimer = undefined
    retryTimer = undefined
  }

  /** Run a job one at a time, after the ones before it, for the current account. */
  function run(job: (cloud: CloudBackend) => Promise<void>): Promise<void> {
    const cloud = backend
    if (!cloud) return Promise.resolve()
    chain = chain.then(async () => {
      if (backend !== cloud) return
      setState('syncing')
      try {
        await job(cloud)
        if (backend !== cloud) return
        clearTimeout(retryTimer)
        retryTimer = undefined
        useSyncStatus.setState({ state: 'idle', lastSyncedAt: now() })
      } catch (error) {
        if (backend !== cloud) return
        setState(error instanceof CloudOfflineError ? 'offline' : 'error')
        clearTimeout(retryTimer)
        retryTimer = setTimeout(() => void syncNow(), retryMs)
      }
    })
    return chain
  }

  async function reconcile(cloud: CloudBackend) {
    pendingSaves.clear()
    clearTimeout(flushTimer)
    flushTimer = undefined
    // The device is read after the answer arrives, so an edit made while waiting for the
    // cloud is part of what is joined.
    const rows = await cloud.fetchRows()
    const characters = await local.loadAll()
    const plan = planSync(characters, readRows(rows), Object.fromEntries(pendingRemovals))
    for (const character of plan.writeLocal) {
      received.add(character)
      await local.save(character)
    }
    for (const id of plan.removeLocal) {
      receivedRemovals.add(id)
      await local.remove(id)
    }
    if (plan.upload.length > 0) await cloud.upsertRows(plan.upload)
    for (const id of plan.settledRemovals) pendingRemovals.delete(id)
    if (plan.settledRemovals.length > 0) persistRemovals()
    if (plan.writeLocal.length > 0 || plan.removeLocal.length > 0) {
      onRemote({ upserts: plan.writeLocal, removedIds: plan.removeLocal })
    }
  }

  async function flush(cloud: CloudBackend) {
    const saves = [...pendingSaves.values()]
    const gone = [...pendingRemovals.entries()]
    const rows: RemoteRow[] = [
      ...saves.map(liveRow),
      ...gone.map(([id, at]) => deletedRow(id, at)),
    ]
    if (rows.length === 0) return
    await cloud.upsertRows(rows)
    for (const character of saves) {
      if (pendingSaves.get(character.id) === character) pendingSaves.delete(character.id)
    }
    for (const [id, at] of gone) {
      if (pendingRemovals.get(id) === at) pendingRemovals.delete(id)
    }
    persistRemovals()
  }

  function schedule() {
    clearTimeout(flushTimer)
    flushTimer = setTimeout(() => {
      flushTimer = undefined
      void run(flush)
    }, debounceMs)
  }

  function syncNow(): Promise<void> {
    return run(reconcile)
  }

  const onOnline = () => void syncNow()

  function stop() {
    backend = null
    clearTimers()
    window.removeEventListener('online', onOnline)
    pendingSaves.clear()
    pendingRemovals.clear()
    useSyncStatus.setState({ state: 'idle', lastSyncedAt: null })
  }

  return {
    start(cloud, id) {
      stop()
      backend = cloud
      userId = id
      removals.rememberUser(id)
      for (const [key, at] of Object.entries(removals.load(id)))
        pendingRemovals.set(key, at)
      window.addEventListener('online', onOnline)
      return syncNow()
    },
    stop,
    noteSave(character) {
      if (!backend || received.has(character)) return
      pendingSaves.set(character.id, character)
      // A character that comes back (restored by an undo) is no longer deleted.
      if (pendingRemovals.delete(character.id)) persistRemovals()
      schedule()
    },
    noteRemove(id) {
      if (!backend) {
        // Signed out: the deletion waits for the account that was last signed in here,
        // and is sent when that same account signs in again.
        const last = removals.lastUserId()
        if (last) removals.save(last, { ...removals.load(last), [id]: now() })
        return
      }
      if (receivedRemovals.delete(id)) return
      pendingSaves.delete(id)
      pendingRemovals.set(id, now())
      persistRemovals()
      schedule()
    },
    forget: (id) => removals.forgetUser(id),
    syncNow,
  }
}
