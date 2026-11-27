import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { character, fakeBackend, memoryCharacters, remoteOf } from '../test/cloudFixtures'
import { deletedRow } from './merge'
import { deviceRemovalStore } from './removals'
import { deviceSentEventsStore } from './sentEvents'
import { createSyncEngine, useSyncStatus } from './sync'

const DEBOUNCE = 1000
const RETRY = 5000
const PER_REQUEST = 3

/** The note of what the ledger was sent, over device settings held in memory. */
function memorySent() {
  const items = new Map<string, string>()
  return deviceSentEventsStore(
    {
      getItem: (key) => items.get(key) ?? null,
      setItem: (key, value) => void items.set(key, value),
      removeItem: (key) => void items.delete(key),
    },
    'sent',
  )
}

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
  const sentEvents = memorySent()
  const onRemote = vi.fn()
  const engine = createSyncEngine({
    local: device.storage,
    removals: removals.store,
    sentEvents,
    eventsPerRequest: PER_REQUEST,
    onRemote,
    debounceMs: DEBOUNCE,
    retryMs: RETRY,
    now: () => 500,
  })
  return { device, cloud, removals, sentEvents, onRemote, engine }
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

describe('the server ledger of history entries', () => {
  const idsOf = (cloud: ReturnType<typeof fakeBackend>, id: string) =>
    [...(cloud.events.get(id)?.keys() ?? [])].sort()

  it('sends the entries of a character after its row, at sign-in', async () => {
    const mine = character('mine', 10, [1, 2])
    const { cloud, engine } = setup({ device: [mine] })
    await engine.start(cloud.backend, 'user')
    expect(idsOf(cloud, 'mine')).toEqual(mine.history.map((entry) => entry.id).sort())
    // The row went up first: the fake refuses events for a character it does not hold.
    expect(cloud.backend.upsertRows.mock.invocationCallOrder[0]).toBeLessThan(
      cloud.backend.recordEvents.mock.invocationCallOrder[0],
    )
  })

  it('sends the entries of a character the cloud already holds', async () => {
    const same = character('a', 10, [1])
    const { cloud, engine } = setup({ device: [same], cloud: [remoteOf(same)] })
    await engine.start(cloud.backend, 'user')
    expect(idsOf(cloud, 'a')).toHaveLength(1)
  })

  it('sends only the entries it has not sent, after a save', async () => {
    const first = character('a', 10, [1, 2])
    const { cloud, engine } = setup({ device: [first] })
    await engine.start(cloud.backend, 'user')
    cloud.backend.recordEvents.mockClear()

    const added = character('a', 0, [3]).history
    const later = { ...first, updatedAt: 11, history: [...first.history, ...added] }
    engine.noteSave(later)
    await vi.advanceTimersByTimeAsync(DEBOUNCE)

    expect(cloud.backend.recordEvents).toHaveBeenCalledTimes(1)
    expect(cloud.backend.recordEvents.mock.calls[0][1]).toEqual(added)
    // A sync that follows has nothing left to send.
    await engine.syncNow()
    expect(cloud.backend.recordEvents).toHaveBeenCalledTimes(1)
  })

  it('does not send again after a restart on the same device', async () => {
    const mine = character('mine', 10, [1])
    const { cloud, engine } = setup({ device: [mine] })
    await engine.start(cloud.backend, 'user')
    cloud.backend.recordEvents.mockClear()
    engine.stop()
    await engine.start(cloud.backend, 'user')
    expect(cloud.backend.recordEvents).not.toHaveBeenCalled()
  })

  it('sends an imported entry with its own time, and the server gives its own', async () => {
    const mine = character('mine', 10, [5])
    const { cloud, engine } = setup({ device: [mine] })
    await engine.start(cloud.backend, 'user')
    const [event] = await cloud.backend.readRecordedEvents('mine')
    expect(event.entry.at).toBe(5)
    expect(event.recordedAt).toBeGreaterThan(5)
    expect(event.entry.by).toBe('device')
  })

  it('sends again after a failure, without sending again what got through', async () => {
    const mine = character('mine', 10, [1, 2, 3, 4, 5])
    const { cloud, engine } = setup({ device: [mine] })
    const record = cloud.backend.recordEvents.getMockImplementation()
    if (!record) throw new Error('the fake has no recordEvents')
    cloud.backend.recordEvents.mockImplementationOnce(record)
    cloud.backend.recordEvents.mockImplementationOnce(async () => {
      throw new Error('refused')
    })
    await engine.start(cloud.backend, 'user')
    expect(useSyncStatus.getState().state).toBe('error')
    expect(idsOf(cloud, 'mine')).toHaveLength(PER_REQUEST)

    await vi.advanceTimersByTimeAsync(RETRY)

    expect(useSyncStatus.getState().state).toBe('idle')
    expect(idsOf(cloud, 'mine')).toHaveLength(5)
    // The retry sent only the two entries the first try had not.
    expect(cloud.backend.recordEvents.mock.calls.at(-1)?.[1]).toHaveLength(2)
  })

  it('sends in requests of the configured size', async () => {
    const mine = character('mine', 10, [1, 2, 3, 4, 5, 6, 7])
    const { cloud, engine } = setup({ device: [mine] })
    await engine.start(cloud.backend, 'user')
    expect(cloud.backend.recordEvents.mock.calls.map(([, sent]) => sent.length)).toEqual([
      3, 3, 1,
    ])
  })

  it('sends nothing while signed out', async () => {
    const { cloud, engine } = setup({})
    engine.noteSave(character('a', 10, [1]))
    await vi.advanceTimersByTimeAsync(DEBOUNCE * 2)
    expect(cloud.backend.recordEvents).not.toHaveBeenCalled()
  })

  it('sends nothing for a deleted character, and sends its log again if it returns', async () => {
    const mine = character('mine', 10, [1])
    const { cloud, engine, sentEvents } = setup({ device: [mine] })
    await engine.start(cloud.backend, 'user')
    cloud.backend.recordEvents.mockClear()

    engine.noteRemove('mine')
    expect(sentEvents.load('user')).toEqual({})
    await vi.advanceTimersByTimeAsync(DEBOUNCE)
    expect(cloud.backend.recordEvents).not.toHaveBeenCalled()
    expect(cloud.events.has('mine')).toBe(false)

    // Brought back: its ledger went with the deletion, so the whole log is sent again.
    engine.noteSave({ ...mine, updatedAt: 600 })
    await vi.advanceTimersByTimeAsync(DEBOUNCE)
    expect(idsOf(cloud, 'mine')).toHaveLength(1)
  })

  it('sends nothing for a character whose deletion is still waiting', async () => {
    const gone = character('gone', 10, [1])
    const { cloud, engine } = setup({ device: [gone], removals: { gone: 400 } })
    await engine.start(cloud.backend, 'user')
    expect(cloud.backend.recordEvents).not.toHaveBeenCalled()
  })

  it('drops the note of a character the cloud deleted', async () => {
    const mine = character('mine', 10, [1])
    const { cloud, engine, sentEvents } = setup({ device: [mine] })
    await engine.start(cloud.backend, 'user')
    expect(Object.keys(sentEvents.load('user'))).toEqual(['mine'])
    cloud.rows.set('mine', deletedRow('mine', 50))
    await engine.syncNow()
    expect(sentEvents.load('user')).toEqual({})
  })

  it('keeps a save made offline and sends its entries when the connection returns', async () => {
    const { cloud, engine, device } = setup({})
    await engine.start(cloud.backend, 'user')
    cloud.state.offline = true
    const mine = character('mine', 10, [1])
    device.records.set('mine', mine)
    engine.noteSave(mine)
    await vi.advanceTimersByTimeAsync(DEBOUNCE)
    expect(useSyncStatus.getState().state).toBe('offline')
    cloud.state.offline = false
    await vi.advanceTimersByTimeAsync(RETRY)
    expect(idsOf(cloud, 'mine')).toHaveLength(1)
  })

  it('forgets what an account was sent when the account is deleted', async () => {
    const { cloud, engine, sentEvents } = setup({ device: [character('mine', 10, [1])] })
    await engine.start(cloud.backend, 'user')
    engine.forget('user')
    expect(sentEvents.load('user')).toEqual({})
  })
})
