// What the app needs from the cloud, and nothing of how it is reached.
//
// The account page, the sync and the tests talk to a `CloudBackend`. The one real
// implementation (supabaseBackend.ts) is loaded only when someone signs in or already
// has a session, so a visitor with no account never downloads or runs any of it.

import type { StoredCharacter } from '../character/model'

/** Who is signed in. The email is shown on the account page and goes nowhere else. */
export interface CloudSession {
  userId: string
  email: string
  /** When the account was made, in milliseconds since the epoch, if the cloud says. */
  createdAt?: number
}

/** One character as the cloud keeps it. A deleted one has `deletedAt` and no content. */
export interface RemoteRow {
  id: string
  data: StoredCharacter
  /** When the row last changed, in milliseconds since the epoch. */
  updatedAt: number
  /** When the character was deleted, or null while it exists. */
  deletedAt: number | null
}

export interface CloudBackend {
  /** The session this browser holds, if any. */
  getSession(): Promise<CloudSession | null>
  /** Told whenever the user signs in or out. Returns the function that stops it. */
  onSessionChange(listener: (session: CloudSession | null) => void): () => void
  /** Finish a sign-in that came back through the emailed link. */
  completeSignIn(code: string): Promise<void>
  /** Finish a sign-in with the 6-digit code from the same email. */
  verifyCode(email: string, code: string): Promise<void>
  /** Email a sign-in link that leads back to `redirectTo`. */
  sendSignInLink(email: string, redirectTo: string): Promise<void>
  signOut(): Promise<void>
  /** Delete the account and every character the cloud holds for it, at once. */
  deleteAccount(): Promise<void>
  fetchRows(): Promise<RemoteRow[]>
  upsertRows(rows: RemoteRow[]): Promise<void>
}

/** The cloud could not be reached: no connection, or the service is down. */
export class CloudOfflineError extends Error {
  constructor() {
    super('The cloud could not be reached.')
    this.name = 'CloudOfflineError'
  }
}

/** The row each character is kept in, with the times as the database writes them. */
export interface RowRecord {
  id: string
  data: StoredCharacter
  updated_at: string
  deleted_at: string | null
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function time(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const at = Date.parse(value)
  return Number.isNaN(at) ? null : at
}

/**
 * The rows an answer from the cloud holds. A row that is not shaped as the app writes
 * it is left out, so one bad row can never stop the others from syncing.
 */
export function parseRows(answer: unknown): RemoteRow[] {
  if (!Array.isArray(answer)) return []
  return answer.flatMap((item: unknown): RemoteRow[] => {
    if (!isObject(item) || typeof item.id !== 'string' || !isObject(item.data)) return []
    const updatedAt = time(item.updated_at)
    if (updatedAt === null) return []
    const deletedAt = item.deleted_at === null ? null : time(item.deleted_at)
    if (item.deleted_at !== null && deletedAt === null) return []
    return [{ id: item.id, data: item.data, updatedAt, deletedAt }]
  })
}

/** A row as it is sent to the database. */
export function toRecord(row: RemoteRow): RowRecord {
  return {
    id: row.id,
    data: row.data,
    updated_at: new Date(row.updatedAt).toISOString(),
    deleted_at: row.deletedAt === null ? null : new Date(row.deletedAt).toISOString(),
  }
}
