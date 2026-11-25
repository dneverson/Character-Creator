import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBackend } from '../test/cloudFixtures'
import { createAccount, useAccountStore } from './account'
import type { CloudSession } from './backend'
import type { SyncEngine } from './sync'

const alice: CloudSession = { userId: 'u1', email: 'alice@example.test' }

function setup(
  options: { saved?: boolean; code?: string | null; session?: CloudSession | null } = {},
) {
  const notify = vi.fn()
  const cloud = fakeBackend([], options.session ?? null)
  const sync = {
    start: vi.fn(async () => {}),
    stop: vi.fn(),
    noteSave: vi.fn(),
    noteRemove: vi.fn(),
    syncNow: vi.fn(async () => {}),
    forget: vi.fn(),
  } satisfies SyncEngine
  const loadBackend = vi.fn(async () => cloud.backend)
  const account = createAccount({
    loadBackend,
    sync,
    hasSavedSession: () => options.saved ?? false,
    takeCode: () => options.code ?? null,
    redirectTo: () => 'https://site.test/app/',
    notify,
    now: () => 5000,
  })
  return { account, cloud, sync, loadBackend, notify }
}

const state = () => useAccountStore.getState()

beforeEach(() => {
  useAccountStore.setState({
    session: null,
    step: 'idle',
    sentTo: '',
    codeSent: false,
    sentAt: null,
    busy: false,
    error: null,
  })
})

describe('starting up', () => {
  it('loads nothing for a visitor with no account', async () => {
    const { account, loadBackend, sync } = setup()
    await account.start()
    expect(loadBackend).not.toHaveBeenCalled()
    expect(sync.start).not.toHaveBeenCalled()
    expect(state().session).toBeNull()
  })

  it('picks up a session the browser already holds and starts syncing', async () => {
    const { account, cloud, sync } = setup({ saved: true, session: alice })
    await account.start()
    expect(state().session).toEqual(alice)
    expect(sync.start).toHaveBeenCalledWith(cloud.backend, 'u1')
  })

  it('finishes a sign-in that came back through the emailed link, and says so', async () => {
    const { account, cloud, sync, notify } = setup({ code: 'one-time', session: alice })
    await account.start()
    expect(cloud.backend.completeSignIn).toHaveBeenCalledWith('one-time')
    expect(state().session).toEqual(alice)
    expect(sync.start).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith('Signed in as alice@example.test')
  })

  it('says nothing when a saved session is simply picked up again', async () => {
    const { account, notify } = setup({ saved: true, session: alice })
    await account.start()
    expect(notify).not.toHaveBeenCalled()
  })

  it('says so when the link does not work', async () => {
    const { account, cloud } = setup({ code: 'old' })
    cloud.backend.completeSignIn.mockRejectedValueOnce(new Error('expired'))
    await account.start()
    expect(state().session).toBeNull()
    expect(state().step).toBe('failed')
    expect(state().error).toMatch(/Ask for a new code/)
  })

  it('stays signed out, quietly, when a saved session cannot be checked', async () => {
    const { account, cloud } = setup({ saved: true })
    cloud.backend.getSession.mockRejectedValueOnce(new Error('offline'))
    await account.start()
    expect(state().session).toBeNull()
    expect(state().error).toBeNull()
  })

  it('syncs again, once, when the library reports the same user again', async () => {
    const { account, cloud, sync } = setup({ saved: true, session: alice })
    await account.start()
    cloud.emit(alice)
    cloud.emit({ ...alice, email: 'new@example.test' })
    expect(sync.start).toHaveBeenCalledTimes(1)
    expect(state().session?.email).toBe('new@example.test')
  })
})

describe('signing in', () => {
  it('sends the link, then asks the user to check their email', async () => {
    const { account, cloud } = setup()
    const sending = account.sendLink('alice@example.test')
    expect(state().step).toBe('sending')
    await sending
    expect(cloud.backend.sendSignInLink).toHaveBeenCalledWith(
      'alice@example.test',
      'https://site.test/app/',
    )
    expect(state().step).toBe('sent')
    expect(state().sentTo).toBe('alice@example.test')
    expect(state().codeSent).toBe(true)
    expect(state().sentAt).toBe(5000)
  })

  it('goes back to asking for the address, keeping it for the form', async () => {
    const { account } = setup()
    await account.sendLink('alice@example.test')
    account.backToEmail()
    expect(state().codeSent).toBe(false)
    expect(state().sentAt).toBeNull()
    expect(state().step).toBe('idle')
    expect(state().sentTo).toBe('alice@example.test')
  })

  it('loads the cloud library once, however often it is asked', async () => {
    const { account, loadBackend } = setup()
    await account.sendLink('a@example.test')
    await account.sendLink('a@example.test')
    expect(loadBackend).toHaveBeenCalledTimes(1)
  })

  it('says so when the link could not be sent, and can try again', async () => {
    const { account, cloud } = setup()
    cloud.backend.sendSignInLink.mockRejectedValueOnce(new Error('rate limit'))
    await account.sendLink('a@example.test')
    expect(state().step).toBe('failed')
    expect(state().error).toMatch(/code could not be sent/)
    await account.sendLink('a@example.test')
    expect(state().step).toBe('sent')
  })

  it('tries loading the library again after it failed to load', async () => {
    const { account, loadBackend, cloud } = setup()
    loadBackend.mockRejectedValueOnce(new Error('offline'))
    await account.sendLink('a@example.test')
    expect(state().step).toBe('failed')
    await account.sendLink('a@example.test')
    expect(state().step).toBe('sent')
    expect(cloud.backend.sendSignInLink).toHaveBeenCalledTimes(1)
  })
})

describe('signing in with the code', () => {
  it('verifies the code for the address the email went to, then signs in', async () => {
    const { account, cloud, sync, notify } = setup({ session: alice })
    await account.sendLink('alice@example.test')
    await account.verifyCode(' 123456 ')
    expect(cloud.backend.verifyCode).toHaveBeenCalledWith('alice@example.test', '123456')
    expect(state().session).toEqual(alice)
    expect(state().codeSent).toBe(false)
    expect(sync.start).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith('Signed in as alice@example.test')
  })

  it('keeps the code form and says so when the code is wrong', async () => {
    const { account, cloud } = setup()
    await account.sendLink('alice@example.test')
    cloud.backend.verifyCode.mockRejectedValueOnce(new Error('bad'))
    await account.verifyCode('000000')
    expect(state().step).toBe('sent')
    expect(state().error).toBe('That code did not work. Check it or send a new one.')
    expect(state().session).toBeNull()
  })
})

describe('signing out', () => {
  it('stops the sync and forgets the session', async () => {
    const { account, cloud, sync } = setup({ saved: true, session: alice })
    await account.start()
    await account.signOut()
    expect(sync.stop).toHaveBeenCalled()
    expect(cloud.backend.signOut).toHaveBeenCalled()
    expect(state().session).toBeNull()
    expect(state().busy).toBe(false)
  })

  it('says so when signing out failed', async () => {
    const { account, cloud } = setup({ saved: true, session: alice })
    await account.start()
    cloud.backend.signOut.mockRejectedValueOnce(new Error('offline'))
    await account.signOut()
    expect(state().error).toMatch(/Signing out failed/)
    expect(state().busy).toBe(false)
  })
})

describe('deleting the account', () => {
  it('deletes it, stops the sync and signs out of the app', async () => {
    const { account, cloud, sync, notify } = setup({ saved: true, session: alice })
    await account.start()
    await account.deleteAccount()
    expect(notify).toHaveBeenCalledWith('Your account was deleted.')
    expect(cloud.backend.deleteAccount).toHaveBeenCalled()
    expect(sync.forget).toHaveBeenCalledWith('u1')
    expect(sync.stop).toHaveBeenCalled()
    expect(state().session).toBeNull()
  })

  it('carries on syncing and says so when the deletion failed', async () => {
    const { account, cloud, sync, notify } = setup({ saved: true, session: alice })
    await account.start()
    cloud.backend.deleteAccount.mockRejectedValueOnce(new Error('offline'))
    await account.deleteAccount()
    expect(state().error).toMatch(/could not be deleted/)
    expect(notify).not.toHaveBeenCalled()
    expect(state().session).toEqual(alice)
    expect(sync.start).toHaveBeenCalledTimes(2)
  })

  it('does not restart the sync for a failed deletion when no one is signed in', async () => {
    const { account, cloud, sync } = setup()
    cloud.backend.deleteAccount.mockRejectedValueOnce(new Error('offline'))
    await account.deleteAccount()
    expect(sync.start).not.toHaveBeenCalled()
    expect(state().error).toMatch(/could not be deleted/)
  })
})

describe('syncing by hand', () => {
  it('asks the sync to reconcile now', async () => {
    const { account, sync } = setup()
    await account.syncNow()
    expect(sync.syncNow).toHaveBeenCalled()
  })
})
