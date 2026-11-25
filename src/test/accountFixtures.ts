// Stand-ins for the account, for the tests of the account's screens.

import { vi } from 'vitest'
import { useAccountStore, type Account } from '../cloud/account'
import { useSyncStatus } from '../cloud/sync'

export function fakeAccount(): Account {
  return {
    start: vi.fn(async () => {}),
    sendLink: vi.fn(async () => {}),
    backToEmail: vi.fn(),
    verifyCode: vi.fn(async () => {}),
    syncNow: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    deleteAccount: vi.fn(async () => {}),
  }
}

export const alice = { userId: 'u1', email: 'alice@example.test' }

/** Put the account and the sync status back to a signed-out visitor's. */
export function resetAccountState() {
  useAccountStore.setState({
    session: null,
    step: 'idle',
    sentTo: '',
    codeSent: false,
    sentAt: null,
    busy: false,
    error: null,
  })
  useSyncStatus.setState({ state: 'idle', lastSyncedAt: null })
}
