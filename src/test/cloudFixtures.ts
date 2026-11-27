// Stand-ins for the cloud and the device, for the tests of everything that syncs.

import { vi } from 'vitest'
import {
  createCharacter,
  historyEntry,
  type Character,
  type HistoryEntry,
  type StoredCharacter,
} from '../character/model'
import type { CharacterStorage } from '../storage/characters'
import {
  CloudOfflineError,
  CharacterNotInCloudError,
  type CloudBackend,
  type CloudSession,
  type RecordedEvent,
  type RemoteRow,
} from '../cloud/backend'
import { liveRow } from '../cloud/merge'

/** A character changed last at `updatedAt`, with the given history entry times. */
export function character(
  id: string,
  updatedAt: number,
  entryTimes: number[] = [],
  name = id,
): Character {
  return {
    ...createCharacter(name),
    id,
    createdAt: 1,
    updatedAt,
    history: entryTimes.map((at) => historyEntry(at, { type: 'created' })),
  }
}

/** A device storage held in a map. */
export function memoryCharacters(initial: Character[] = []) {
  const records = new Map(initial.map((c) => [c.id, c]))
  const storage = {
    loadAll: vi.fn(async () => [...records.values()]),
    save: vi.fn(async (c: Character) => void records.set(c.id, c)),
    remove: vi.fn(async (id: string) => void records.delete(id)),
  } satisfies CharacterStorage
  return { storage, records }
}

/** A cloud held in a map, that can be switched offline. */
export function fakeBackend(
  initial: RemoteRow[] = [],
  session: CloudSession | null = null,
) {
  const rows = new Map(initial.map((row) => [row.id, row]))
  /** token -> character id, for the links that work. */
  const shares = new Map<string, string>()
  let tokens = 0
  /** character id -> the ledger, by event id, as the server keeps it. */
  const events = new Map<string, Map<string, RecordedEvent>>()
  let clock = 1_000_000
  const state = { offline: false, session }
  const listeners = new Set<(session: CloudSession | null) => void>()
  const check = () => {
    if (state.offline) throw new CloudOfflineError()
  }
  const backend = {
    getSession: vi.fn(async () => state.session),
    onSessionChange: vi.fn((listener: (session: CloudSession | null) => void) => {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    }),
    completeSignIn: vi.fn(async () => {}),
    verifyCode: vi.fn(async () => {}),
    sendSignInLink: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    deleteAccount: vi.fn(async () => {}),
    fetchRows: vi.fn(async () => {
      check()
      return [...rows.values()]
    }),
    upsertRows: vi.fn(async (sent: RemoteRow[]) => {
      check()
      for (const row of sent) {
        rows.set(row.id, row)
        // A deleted character takes its ledger with it.
        if (row.deletedAt !== null) events.delete(row.id)
      }
    }),
    recordEvents: vi.fn(async (characterId: string, entries: HistoryEntry[]) => {
      check()
      const row = rows.get(characterId)
      // The ledger names a character row, as the database's foreign key demands.
      if (!row || row.deletedAt !== null) throw new CharacterNotInCloudError()
      const ledger = events.get(characterId) ?? new Map<string, RecordedEvent>()
      events.set(characterId, ledger)
      for (const entry of entries) {
        // The server's own time, whatever the entry says; a known entry stays as it was.
        if (!ledger.has(entry.id)) {
          ledger.set(entry.id, { eventId: entry.id, recordedAt: (clock += 1), entry })
        }
      }
    }),
    readRecordedEvents: vi.fn(async (characterId: string) => {
      check()
      return [...(events.get(characterId)?.values() ?? [])]
    }),
    createShare: vi.fn(async (characterId: string) => {
      check()
      const row = rows.get(characterId)
      if (!row || row.deletedAt !== null) throw new CharacterNotInCloudError()
      for (const [token, id] of shares) if (id === characterId) return token
      const token = (tokens += 1).toString(16).padStart(32, '0')
      shares.set(token, characterId)
      return token
    }),
    stopShare: vi.fn(async (characterId: string) => {
      check()
      for (const [token, id] of shares) if (id === characterId) shares.delete(token)
    }),
    getShare: vi.fn(async (characterId: string) => {
      check()
      for (const [token, id] of shares) if (id === characterId) return token
      return null
    }),
    readShared: vi.fn(async (token: string): Promise<StoredCharacter | null> => {
      check()
      const id = shares.get(token)
      const row = id === undefined ? undefined : rows.get(id)
      if (!row || row.deletedAt !== null) return null
      const shared = { ...row.data }
      delete shared.history
      return shared
    }),
  } satisfies CloudBackend
  return {
    backend,
    rows,
    shares,
    events,
    state,
    emit: (next: CloudSession | null) => listeners.forEach((listener) => listener(next)),
  }
}

export const remoteOf = (c: Character): RemoteRow => liveRow(c)
