import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { character, fakeBackend, memoryCharacters, remoteOf } from '../test/cloudFixtures'
import { deletedRow } from './merge'
import { deviceRemovalStore } from './removals'
import { createSyncEngine, useSyncStatus } from './sync'

const DEBOUNCE = 1000
const RETRY = 5000

/** The removal store over device settings held in memory, as one account's. */
function memoryRemovals(initial: Record<string, number> = {}) {
  const items = new Map<string, string>()
  const store = deviceRemovalStore(
    {
      getItem: (key) => items.get(key) ?? null,
      setItem: (key, value) => void items.set(key, value),
      removeItem: (key) => void items.delete(key),
    },
    'removals',
    'last-user',
  )
  if (Object.keys(initial).length > 0) store.save('user', initial)
  return { store, saved: (userId = 'user') => store.load(userId) }
}

function setup(options: {
  device?: ReturnType<typeof character>[]
  cloud?: ReturnType<typeof remoteOf>[]
  removals?: Record<string, number>
}) {
  const device = memoryCharacters(options.device)
  const cloud = fakeBackend(options.cloud)
  const removals = memoryRemovals(options.removals)
  const onRemote = vi.fn()
  const engine = createSyncEngine({
    local: device.storage,
    removals: removals.store,
    onRemote,
    debounceMs: DEBOUNCE,
    retryMs: RETRY,
    now: () => 500,
  })
  return { device, cloud, removals, onRemote, engine }
}

beforeEach(() => {
  vi.useFakeTimers()
  useSyncStatus.setState({ state: 'idle', lastSyncedAt: null })
})
afterEach(() => vi.useRealTimers())

describe('signing in', () => {
  it('joins the cloud with the device, stores the result and sends what it lacks', async () => {
    const mine = character('mine', 10)
    const theirs = character('theirs', 10)
    const { device, cloud, onRemote, engine } = setup({
      device: [mine],
      cloud: [remoteOf(theirs)],
    })

    await engine.start(cloud.backend, 'user')

    expect(device.records.get('theirs')?.id).toBe('theirs')
    expect(cloud.rows.get('mine')?.updatedAt).toBe(10)
    expect(onRemote).toHaveBeenCalledWith({
      upserts: [expect.objectContaining({ id: 'theirs' })],
      removedIds: [],
    })
    expect(useSyncStatus.getState().state).toBe('idle')
  })

  it('removes a character the cloud deleted, and tells the app', async () => {
    const { device, cloud, onRemote, engine } = setup({
      device: [character('a', 10)],
      cloud: [deletedRow('a', 20)],
    })
    await engine.start(cloud.backend, 'user')
    expect(device.records.has('a')).toBe(false)
    expect(onRemote).toHaveBeenCalledWith({ upserts: [], removedIds: ['a'] })
  })

  it('does not tell the app when nothing changed on the device', async () => {
    const same = character('a', 10)
    const { cloud, onRemote, engine } = setup({ device: [same], cloud: [remoteOf(same)] })
    await engine.start(cloud.backend, 'user')
    expect(onRemote).not.toHaveBeenCalled()
    expect(cloud.backend.upsertRows).not.toHaveBeenCalled()
  })
})

describe('saving while signed in', () => {
  it('sends saves after a pause, once per character', async () => {
    const { cloud, engine } = setup({})
    await engine.start(cloud.backend, 'user')

    engine.noteSave(character('a', 10, [], 'First'))
    engine.noteSave(character('a', 11, [], 'Second'))
    engine.noteSave(character('b', 12))
    expect(cloud.backend.upsertRows).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(DEBOUNCE)

    expect(cloud.backend.upsertRows).toHaveBeenCalledTimes(1)
    const sent = cloud.backend.upsertRows.mock.calls[0][0]
    expect(sent.map((row) => row.id).sort()).toEqual(['a', 'b'])
    expect(cloud.rows.get('a')?.updatedAt).toBe(11)
  })

  it('does nothing while no one is signed in', async () => {
    const { cloud, engine } = setup({})
    engine.noteSave(character('a', 10))
    engine.noteRemove('a')
    await vi.advanceTimersByTimeAsync(DEBOUNCE * 2)
    expect(cloud.backend.upsertRows).not.toHaveBeenCalled()
  })

  it('does not send back what the cloud just gave the device', async () => {
    const { cloud, onRemote, engine } = setup({ cloud: [remoteOf(character('a', 10))] })
    await engine.start(cloud.backend, 'user')
    const [{ upserts }] = onRemote.mock.calls[0]
    // The app saves what the sync brought it, like any other character.
    engine.noteSave(upserts[0])
    await vi.advanceTimersByTimeAsync(DEBOUNCE)
    expect(cloud.backend.upsertRows).not.toHaveBeenCalled()
  })

  it('keeps going when a save is made while another sync is running', async () => {
    const { cloud, device, engine } = setup({})
    const starting = engine.start(cloud.backend, 'user')
    // The app stores a character on the device first, then tells the engine.
    device.records.set('a', character('a', 10))
    engine.noteSave(character('a', 10))
    await starting
    await vi.advanceTimersByTimeAsync(DEBOUNCE)
    expect(cloud.rows.has('a')).toBe(true)
  })
})

describe('removing while signed in', () => {
  it('sends a deletion and keeps it written down until the cloud has it', async () => {
    const { cloud, removals, engine } = setup({ cloud: [remoteOf(character('a', 10))] })
    await engine.start(cloud.backend, 'user')

    engine.noteRemove('a')
    expect(removals.saved()).toEqual({ a: 500 })
    await vi.advanceTimersByTimeAsync(DEBOUNCE)

    expect(cloud.rows.get('a')).toEqual(deletedRow('a', 500))
    expect(removals.saved()).toEqual({})
  })

  it('does not send a deletion the cloud itself asked for', async () => {
    const { cloud, engine } = setup({
      device: [character('a', 10)],
      cloud: [deletedRow('a', 20)],
    })
    await engine.start(cloud.backend, 'user')
    // The app removes the character from its list, which removes it from storage.
    engine.noteRemove('a')
    await vi.advanceTimersByTimeAsync(DEBOUNCE)
    expect(cloud.backend.upsertRows).not.toHaveBeenCalled()
  })

  it('does not send a deletion for a character that was brought back', async () => {
    const { cloud, engine } = setup({})
    await engine.start(cloud.backend, 'user')
    engine.noteRemove('a')
    engine.noteSave(character('a', 600))
    await vi.advanceTimersByTimeAsync(DEBOUNCE)
    const sent = cloud.backend.upsertRows.mock.calls[0][0]
    expect(sent).toHaveLength(1)
    expect(sent[0].deletedAt).toBeNull()
  })

  it('drops a pending save of a character that is then removed', async () => {
    const { cloud, engine } = setup({})
    await engine.start(cloud.backend, 'user')
    engine.noteSave(character('a', 10))
    engine.noteRemove('a')
    await vi.advanceTimersByTimeAsync(DEBOUNCE)
    expect(cloud.rows.get('a')?.deletedAt).toBe(500)
  })

  it('sends a deletion left from an earlier visit at the next sign-in', async () => {
    const { cloud, removals, engine } = setup({
      cloud: [remoteOf(character('a', 10))],
      removals: { a: 500 },
    })
    await engine.start(cloud.backend, 'user')
    expect(cloud.rows.get('a')?.deletedAt).toBe(500)
    expect(removals.saved()).toEqual({})
  })
})

describe('removing while signed out', () => {
  async function signedOutDeletion() {
    const world = setup({ cloud: [remoteOf(character('a', 10))] })
    await world.engine.start(world.cloud.backend, 'user')
    world.engine.stop()
    world.engine.noteRemove('a')
    return world
  }

  it('waits for the account that was last signed in, and is sent when it signs in again', async () => {
    const { cloud, engine, removals } = await signedOutDeletion()
    expect(removals.saved()).toEqual({ a: 500 })
    expect(cloud.backend.upsertRows).not.toHaveBeenCalled()

    await engine.start(cloud.backend, 'user')

    expect(cloud.rows.get('a')).toEqual(deletedRow('a', 500))
    expect(removals.saved()).toEqual({})
  })

  it('is not sent for a different account that signs in', async () => {
    const { cloud, engine, removals } = await signedOutDeletion()
    await engine.start(cloud.backend, 'someone-else')
    expect(cloud.rows.get('a')?.deletedAt).toBeNull()
    expect(removals.saved('someone-else')).toEqual({})
  })

  it('has no one to wait for when no account was ever signed in here', () => {
    const { engine, removals } = setup({})
    engine.noteRemove('a')
    expect(removals.saved()).toEqual({})
  })

  it('forgets a deleted account and what waited for it', async () => {
    const { engine, removals } = await signedOutDeletion()
    engine.forget('user')
    expect(removals.saved()).toEqual({})
    expect(removals.store.lastUserId()).toBeNull()
  })

  it('keeps the last account when another one is forgotten', () => {
    const { engine, removals } = setup({})
    removals.store.rememberUser('user')
    engine.forget('other')
    expect(removals.store.lastUserId()).toBe('user')
  })
})

describe('when the cloud copy was last current', () => {
  it('notes the time of each successful sync, keeps it through a failure, and forgets it on stop', async () => {
    const { cloud, engine } = setup({ device: [character('a', 10)] })
    expect(useSyncStatus.getState().lastSyncedAt).toBeNull()
    await engine.start(cloud.backend, 'user')
    expect(useSyncStatus.getState().lastSyncedAt).toBe(500)

    cloud.state.offline = true
    await engine.syncNow()
    expect(useSyncStatus.getState().state).toBe('offline')
    expect(useSyncStatus.getState().lastSyncedAt).toBe(500)

    engine.stop()
    expect(useSyncStatus.getState().lastSyncedAt).toBeNull()
  })
})

describe('offline and failures', () => {
  it('reports offline when the sign-in sync cannot reach the cloud, then retries', async () => {
    const { device, cloud, engine } = setup({
      device: [character('a', 10)],
    })
    cloud.state.offline = true
    await engine.start(cloud.backend, 'user')
    expect(useSyncStatus.getState().state).toBe('offline')

    cloud.state.offline = false
    await vi.advanceTimersByTimeAsync(RETRY)

    expect(cloud.rows.has('a')).toBe(true)
    expect(device.records.has('a')).toBe(true)
    expect(useSyncStatus.getState().state).toBe('idle')
  })

  it('queues a save made offline and sends it when the retry succeeds', async () => {
    const { cloud, device, engine } = setup({})
    await engine.start(cloud.backend, 'user')
    cloud.state.offline = true

    device.records.set('a', character('a', 10))
    engine.noteSave(character('a', 10))
    await vi.advanceTimersByTimeAsync(DEBOUNCE)
    expect(useSyncStatus.getState().state).toBe('offline')
    expect(cloud.rows.has('a')).toBe(false)

    cloud.state.offline = false
    await vi.advanceTimersByTimeAsync(RETRY)
    expect(cloud.rows.has('a')).toBe(true)
    expect(useSyncStatus.getState().state).toBe('idle')
  })

  it('retries when the browser says the connection is back', async () => {
    const { cloud, engine } = setup({ device: [character('a', 10)] })
    cloud.state.offline = true
    await engine.start(cloud.backend, 'user')
    cloud.state.offline = false

    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(0)

    expect(cloud.rows.has('a')).toBe(true)
  })

  it('keeps a deletion made offline for the next start', async () => {
    const { cloud, removals, engine } = setup({ cloud: [remoteOf(character('a', 10))] })
    await engine.start(cloud.backend, 'user')
    cloud.state.offline = true
    engine.noteRemove('a')
    await vi.advanceTimersByTimeAsync(DEBOUNCE)
    expect(removals.saved()).toEqual({ a: 500 })
  })

  it('reports an error, not offline, when the cloud refuses', async () => {
    const { cloud, engine } = setup({})
    cloud.backend.fetchRows.mockRejectedValueOnce(new Error('refused'))
    await engine.start(cloud.backend, 'user')
    expect(useSyncStatus.getState().state).toBe('error')
    await vi.advanceTimersByTimeAsync(RETRY)
    expect(useSyncStatus.getState().state).toBe('idle')
  })
})

describe('stopping', () => {
  it('stops sending and ignores a sync that finishes after', async () => {
    const { cloud, engine } = setup({})
    await engine.start(cloud.backend, 'user')
    engine.noteSave(character('a', 10))
    engine.stop()
    await vi.advanceTimersByTimeAsync(DEBOUNCE * 2)
    expect(cloud.backend.upsertRows).not.toHaveBeenCalled()
    expect(useSyncStatus.getState().state).toBe('idle')
  })

  it('does not sync when there is no account', async () => {
    const { engine } = setup({})
    await expect(engine.syncNow()).resolves.toBeUndefined()
  })

  it('drops the result of a sync that was running when it stopped', async () => {
    const { cloud, engine } = setup({})
    cloud.backend.fetchRows.mockImplementationOnce(async () => {
      engine.stop()
      throw new Error('refused')
    })
    await engine.start(cloud.backend, 'user')
    expect(useSyncStatus.getState().state).toBe('idle')
  })

  it('drops a sync that was queued when it stopped', async () => {
    const { cloud, engine } = setup({})
    const first = engine.start(cloud.backend, 'user')
    const second = engine.syncNow()
    engine.stop()
    await Promise.all([first, second])
    expect(cloud.backend.upsertRows).not.toHaveBeenCalled()
  })
})
