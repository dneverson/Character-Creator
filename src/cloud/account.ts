// The account: who is signed in, the steps of signing in, and what signing in starts.
//
// Signing in is by a 6-digit code, emailed together with a link that does the same
// thing on the device that opens it. The cloud library is loaded only when it is needed:
// when someone asks for a sign-in code, when the browser already holds a session, or when a sign-in link has just
// brought the user back. A visitor with no account never loads it.

import { create } from 'zustand'
import type { CloudBackend, CloudSession } from './backend'
import type { SyncEngine } from './sync'

export type SignInStep = 'idle' | 'sending' | 'sent' | 'verifying' | 'failed'

export interface AccountState {
  /** Who is signed in, or null. */
  session: CloudSession | null
  /** Where the sign-in form is. */
  step: SignInStep
  /** The address the code was sent to, for the "check your email" message. */
  sentTo: string
  /** A code has been sent and the form is asking for it (not for the address). */
  codeSent: boolean
  /** When the code was last sent, in milliseconds, for the wait before sending another. */
  sentAt: number | null
  /** Something is being done to the account (signing out, deleting). */
  busy: boolean
  /** A plain sentence about what went wrong, or null. */
  error: string | null
}

export const useAccountStore = create<AccountState>()(() => ({
  session: null,
  step: 'idle',
  sentTo: '',
  codeSent: false,
  sentAt: null,
  busy: false,
  error: null,
}))

const patch = (state: Partial<AccountState>) => useAccountStore.setState(state)

export interface AccountOptions {
  loadBackend: () => Promise<CloudBackend>
  sync: SyncEngine
  /** Whether this browser already holds a session (read without loading the library). */
  hasSavedSession: () => boolean
  /** The sign-in link's code, if the address holds one; taking it out of the address. */
  takeCode: () => string | null
  redirectTo: () => string
  /** Tell the user something happened ("Signed in as ..."). */
  notify: (message: string) => void
  now?: () => number
}

export interface Account {
  /** Start up: pick up a session or a returning sign-in link. Never rejects. */
  start(): Promise<void>
  /** Email a sign-in code (and the link that does the same) to the address. */
  sendLink(email: string): Promise<void>
  /** Go back from asking for the code to asking for the address. */
  backToEmail(): void
  /** Finish signing in with the code from the email the link was sent in. */
  verifyCode(code: string): Promise<void>
  /** Bring the cloud copy up to date now. */
  syncNow(): Promise<void>
  signOut(): Promise<void>
  deleteAccount(): Promise<void>
}

export function createAccount(options: AccountOptions): Account {
  const { loadBackend, sync, hasSavedSession, takeCode, redirectTo, notify } = options
  const now = options.now ?? Date.now
  let loading: Promise<CloudBackend> | null = null

  /** Take in what the sign-in library reports; a repeat of what is known is ignored. */
  function settle(backend: CloudBackend, session: CloudSession | null) {
    const known = useAccountStore.getState().session
    if (known?.userId === session?.userId) {
      if (session && known?.email !== session.email) patch({ session })
      return
    }
    patch({ session, step: 'idle', codeSent: false, sentAt: null, error: null })
    if (session) void sync.start(backend, session.userId)
    else sync.stop()
  }

  async function connect(): Promise<CloudBackend> {
    const backend = await loadBackend()
    backend.onSessionChange((session) => settle(backend, session))
    return backend
  }

  /** The backend, loaded once. */
  function ensure(): Promise<CloudBackend> {
    loading ??= connect().catch((error: unknown) => {
      loading = null
      throw error
    })
    return loading
  }

  return {
    async start() {
      const code = takeCode()
      if (!code && !hasSavedSession()) return
      try {
        const backend = await ensure()
        if (code) await backend.completeSignIn(code)
        const session = await backend.getSession()
        settle(backend, session)
        if (code && session) notify(`Signed in as ${session.email}`)
      } catch {
        // No connection, or a link that has expired: the app works as it did, signed out
        // until the user signs in again, or the next visit finds the session.
        if (code) {
          patch({
            step: 'failed',
            error: 'That sign-in link did not work. Ask for a new code.',
          })
        }
      }
    },
    async sendLink(email) {
      patch({ step: 'sending', error: null, sentTo: email })
      try {
        const backend = await ensure()
        await backend.sendSignInLink(email, redirectTo())
        patch({ step: 'sent', codeSent: true, sentAt: now() })
      } catch {
        patch({
          step: 'failed',
          error:
            'The code could not be sent. Check the address and your connection, and try again in a minute.',
        })
      }
    },
    backToEmail() {
      patch({ step: 'idle', codeSent: false, sentAt: null, error: null })
    },
    async verifyCode(code) {
      patch({ step: 'verifying', error: null })
      try {
        const backend = await ensure()
        await backend.verifyCode(useAccountStore.getState().sentTo, code.trim())
        const session = await backend.getSession()
        settle(backend, session)
        if (session) notify(`Signed in as ${session.email}`)
      } catch {
        patch({
          step: 'sent',
          error: 'That code did not work. Check it or send a new one.',
        })
      }
    },
    syncNow: () => sync.syncNow(),
    async signOut() {
      patch({ busy: true, error: null })
      try {
        const backend = await ensure()
        sync.stop()
        await backend.signOut()
        settle(backend, null)
      } catch {
        patch({ error: 'Signing out failed. Try again.' })
      } finally {
        patch({ busy: false })
      }
    },
    async deleteAccount() {
      const session = useAccountStore.getState().session
      patch({ busy: true, error: null })
      try {
        const backend = await ensure()
        // Nothing may be sent to the account while it is being deleted.
        sync.stop()
        try {
          await backend.deleteAccount()
        } catch (error) {
          if (session) void sync.start(backend, session.userId)
          throw error
        }
        if (session) sync.forget(session.userId)
        settle(backend, null)
        notify('Your account was deleted.')
      } catch {
        patch({ error: 'The account could not be deleted. Try again.' })
      } finally {
        patch({ busy: false })
      }
    },
  }
}
