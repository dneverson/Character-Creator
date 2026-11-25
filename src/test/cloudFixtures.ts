// Stand-ins for the cloud and the device, for the tests of everything that syncs.

import { vi } from 'vitest'
import { createCharacter, historyEntry, type Character } from '../character/model'
import type { CharacterStorage } from '../storage/characters'
import {
  CloudOfflineError,
  type CloudBackend,
  type CloudSession,
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
      for (const row of sent) rows.set(row.id, row)
    }),
  } satisfies CloudBackend
  return {
    backend,
    rows,
    state,
    emit: (next: CloudSession | null) => listeners.forEach((listener) => listener(next)),
  }
}

export const remoteOf = (c: Character): RemoteRow => liveRow(c)
