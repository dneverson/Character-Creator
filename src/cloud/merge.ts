// Bringing this device's characters and the cloud's together.
//
// `planSync` is a pure function: given what the device has, what the cloud has and the
// deletions the cloud has not heard of yet, it says what to write on each side. The rules:
//
//  - A character on one side only is copied to the other.
//  - On both sides, the one changed last wins as a whole (the later `updatedAt`; the
//    device's own on a tie). Its history is then joined with the other side's: every
//    entry from either side stays, once, in the order they happened. The history is only
//    ever added to, so an entry made on one device can never be lost to a newer edit
//    made on another.
//  - A deletion is a row with a time. It removes the character on the other side if it
//    is newer than that side's last change; a change made after the deletion keeps the
//    character, and the deletion is undone.

import {
  ensureCharacterDefaults,
  type Character,
  type HistoryEntry,
} from '../character/model'
import type { RemoteRow } from './backend'

export interface SyncPlan {
  /** Characters to store on this device: new from the cloud, or changed by the join. */
  writeLocal: Character[]
  /** Characters deleted in the cloud, to remove from this device. */
  removeLocal: string[]
  /** Rows to send to the cloud. */
  upload: RemoteRow[]
  /** Deletions the cloud now knows of (or that a later change made void). */
  settledRemovals: string[]
}

/** A character as the cloud row for it. */
export function liveRow(character: Character): RemoteRow {
  return {
    id: character.id,
    data: character,
    updatedAt: character.updatedAt,
    deletedAt: null,
  }
}

/** The row that records a deletion. It keeps none of the character. */
export function deletedRow(id: string, at: number): RemoteRow {
  return { id, data: {}, updatedAt: at, deletedAt: at }
}

/** The ids of the entries in a history. */
const idsOf = (history: HistoryEntry[]) => new Set(history.map((entry) => entry.id))

/** The history entries of both lists, once each, in the order they happened. */
export function joinHistory(
  first: HistoryEntry[],
  second: HistoryEntry[],
): HistoryEntry[] {
  const known = idsOf(first)
  // The sort is stable: entries made at the same moment keep the order they came in.
  return [...first, ...second.filter((entry) => !known.has(entry.id))].sort(
    (a, b) => a.at - b.at,
  )
}

/** Whether `history` lacks an entry that `other` has. */
const lacksEntryOf = (history: HistoryEntry[], other: HistoryEntry[]) => {
  const known = idsOf(history)
  return other.some((entry) => !known.has(entry.id))
}

/** What two live copies of one character come to: what to store, and what to send. */
function joinCopies(
  local: Character,
  remote: Character,
): { write: Character | null; upload: Character | null } {
  const remoteWins = remote.updatedAt > local.updatedAt
  const winner = remoteWins ? remote : local
  const joined: Character = {
    ...winner,
    history: joinHistory(winner.history, (remoteWins ? local : remote).history),
  }
  return {
    write: remoteWins || lacksEntryOf(local.history, remote.history) ? joined : null,
    upload:
      local.updatedAt > remote.updatedAt || lacksEntryOf(remote.history, local.history)
        ? joined
        : null,
  }
}

export function planSync(
  local: Character[],
  remote: { id: string; character: Character | null; updatedAt: number }[],
  removals: Record<string, number>,
): SyncPlan {
  const plan: SyncPlan = {
    writeLocal: [],
    removeLocal: [],
    upload: [],
    settledRemovals: [],
  }
  const localById = new Map(local.map((character) => [character.id, character]))
  const remoteById = new Map(remote.map((row) => [row.id, row]))
  const removed = new Map(Object.entries(removals))

  for (const [id, at] of removed) {
    const there = remoteById.get(id)
    const here = localById.get(id)
    // Changed again after it was deleted here, or already deleted in the cloud since:
    // there is nothing to tell the cloud, and the rules below settle the rest.
    const changedAgain =
      (here && here.updatedAt > at) || (there?.character && there.updatedAt > at)
    const alreadyKnown = there && !there.character && there.updatedAt >= at
    plan.settledRemovals.push(id)
    if (changedAgain || alreadyKnown) removed.delete(id)
    else plan.upload.push(deletedRow(id, at))
  }

  const ids = new Set([...localById.keys(), ...remoteById.keys()])
  for (const id of ids) {
    const here = localById.get(id)
    const there = remoteById.get(id)
    if (removed.has(id)) {
      if (here) plan.removeLocal.push(id)
      continue
    }
    if (here && !there) {
      plan.upload.push(liveRow(here))
    } else if (!here && there?.character) {
      plan.writeLocal.push(there.character)
    } else if (here && there && !there.character) {
      // The cloud's record of a deletion against the copy on this device.
      if (there.updatedAt >= here.updatedAt) plan.removeLocal.push(id)
      else plan.upload.push(liveRow(here))
    } else if (here && there?.character) {
      const { write, upload } = joinCopies(here, there.character)
      if (write) plan.writeLocal.push(write)
      if (upload) plan.upload.push(liveRow(upload))
    }
  }
  return plan
}

/** The cloud's rows as characters: a deleted row has none. */
export function readRows(rows: RemoteRow[]) {
  return rows.map((row) => ({
    id: row.id,
    updatedAt: row.updatedAt,
    character:
      row.deletedAt === null
        ? ensureCharacterDefaults({ ...row.data, id: row.id })
        : null,
  }))
}
