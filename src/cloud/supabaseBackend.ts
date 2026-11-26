// The cloud as Supabase provides it: the one `CloudBackend` the app ships. It is loaded
// with `import()` (see index.ts), so the library is not part of the first download.
//
// Sign-in uses the PKCE flow and reads no address itself (`detectSessionInUrl: false`):
// the app owns the address bar and hands over the emailed code (see redirect.ts). Nothing
// here logs or keeps tokens, emails or sessions anywhere but the library's own storage.

import { createClient, type Session } from '@supabase/supabase-js'
import { appConfig } from '../config/app'
import {
  CharacterNotInCloudError,
  CloudOfflineError,
  parseRows,
  parseShared,
  parseToken,
  toRecord,
  type CloudBackend,
  type CloudSession,
} from './backend'

/** The database's codes for a missing referenced row and for a value that must be unique. */
const FOREIGN_KEY_VIOLATION = '23503'
const UNIQUE_VIOLATION = '23505'

/** Rows sent in one request: a character with a portrait is large. */
const ROWS_PER_REQUEST = 20

function sessionOf(session: Session | null): CloudSession | null {
  if (!session) return null
  const created = Date.parse(session.user.created_at)
  return {
    userId: session.user.id,
    email: session.user.email ?? '',
    ...(Number.isNaN(created) ? {} : { createdAt: created }),
  }
}

/** Stop with an error that says only whether the cloud could be reached. */
function fail(error: { message: string }): never {
  if (!navigator.onLine || /failed to fetch|network|load failed/i.test(error.message)) {
    throw new CloudOfflineError()
  }
  throw new Error('The cloud refused the request.')
}

export function createSupabaseBackend(): CloudBackend {
  const client = createClient(appConfig.cloud.url, appConfig.cloud.publishableKey, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
    },
  })

  /** The token a character is shared under, or null. */
  async function shareOf(characterId: string): Promise<string | null> {
    const { data, error } = await client
      .from('character_shares')
      .select('token')
      .eq('character_id', characterId)
      .maybeSingle()
    if (error) fail(error)
    return parseToken(data)
  }

  return {
    async getSession() {
      const { data, error } = await client.auth.getSession()
      if (error) fail(error)
      return sessionOf(data.session)
    },
    onSessionChange(listener) {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        // The library asks for no calls back into it from inside this callback.
        setTimeout(() => listener(sessionOf(session)), 0)
      })
      return () => data.subscription.unsubscribe()
    },
    async completeSignIn(code) {
      const { error } = await client.auth.exchangeCodeForSession(code)
      if (error) fail(error)
    },
    async verifyCode(email, code) {
      const { error } = await client.auth.verifyOtp({ email, token: code, type: 'email' })
      if (error) fail(error)
    },
    async sendSignInLink(email, redirectTo) {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      })
      if (error) fail(error)
    },
    async signOut() {
      const { error } = await client.auth.signOut()
      if (error) fail(error)
    },
    async deleteAccount() {
      const { error } = await client.rpc('delete_my_account')
      if (error) fail(error)
      // The account is gone, so there is no session on the server to end.
      await client.auth.signOut({ scope: 'local' })
    },
    async fetchRows() {
      const { data, error } = await client
        .from('characters')
        .select('id, data, updated_at, deleted_at')
      if (error) fail(error)
      return parseRows(data)
    },
    async upsertRows(rows) {
      for (let at = 0; at < rows.length; at += ROWS_PER_REQUEST) {
        const records = rows.slice(at, at + ROWS_PER_REQUEST).map(toRecord)
        const { error } = await client
          .from('characters')
          .upsert(records, { onConflict: 'user_id,id' })
        if (error) fail(error)
      }
    },
    async createShare(characterId) {
      const { data, error } = await client
        .from('character_shares')
        .insert({ character_id: characterId })
        .select('token')
        .single()
      if (error?.code === FOREIGN_KEY_VIOLATION) throw new CharacterNotInCloudError()
      if (error?.code === UNIQUE_VIOLATION) {
        // Shared already (from another tab or device): that link is the one to show.
        const existing = await shareOf(characterId)
        if (existing !== null) return existing
      }
      if (error) fail(error)
      const token = parseToken(data)
      if (token === null) throw new Error('The cloud refused the request.')
      return token
    },
    async stopShare(characterId) {
      const { error } = await client
        .from('character_shares')
        .delete()
        .eq('character_id', characterId)
      if (error) fail(error)
    },
    getShare: shareOf,
    async readShared(token) {
      const { data, error } = await client.rpc('get_shared_character', {
        p_token: token,
      })
      if (error) fail(error)
      return parseShared(data)
    },
  }
}
