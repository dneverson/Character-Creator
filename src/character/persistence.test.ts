import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterStorage } from '../storage/characters'
import { useStorageStatus } from '../storage/status'
import { createCharacter, type Character } from './model'
import { connectCharacterStorage } from './persistence'
import { useCharacterStore } from './store'

/** A storage held in a map, recording what it is asked to do. */
function fakeStorage(initial: Character[] = []) {
  const records = new Map(initial.map((c) => [c.id, c]))
  const storage = {
    loadAll: vi.fn(async () => [...records.values()]),
    save: vi.fn(
      async (character: Character) => void records.set(character.id, character),
    ),
    remove: vi.fn(async (id: string) => void records.delete(id)),
  } satisfies CharacterStorage
  return { storage, records }
}

const state = () => useCharacterStore.getState()
const madeAt = (name: string, createdAt: number): Character => ({
  ...createCharacter(name),
  createdAt,
})

// Each test joins the one character store to its own storage; the joins of
// earlier tests are dropped so they do not answer too.
let unsubscribe: (() => void)[] = []
beforeEach(() => {
  const subscribe = useCharacterStore.subscribe
  vi.spyOn(useCharacterStore, 'subscribe').mockImplementation((listener) => {
    const stop = subscribe(listener)
    unsubscribe.push(stop)
    return stop
  })
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
  useStorageStatus.setState({ persistent: true })
})
afterEach(() => {
  for (const stop of unsubscribe) stop()
  unsubscribe = []
  vi.restoreAllMocks()
})

describe('connectCharacterStorage', () => {
  it('reads the stored characters into the app, oldest first', async () => {
    const second = madeAt('Mialee', 2000)
    const first = madeAt('Tordek', 1000)
    const { storage } = fakeStorage([second, first])

    await connectCharacterStorage(storage)

    expect(state().characters).toEqual({ [first.id]: first, [second.id]: second })
    expect(state().order).toEqual([first.id, second.id])
    // What was just read is not written back.
    expect(storage.save).not.toHaveBeenCalled()
  })

  it('saves a character when it is created, changed, duplicated or imported', async () => {
    const { storage, records } = fakeStorage()
    await connectCharacterStorage(storage)

    state().newCharacter()
    const id = state().activeId as string
    expect(records.get(id)).toBe(state().characters[id])

    state().updateActive({ name: 'Tordek' })
    expect(records.get(id)?.name).toBe('Tordek')

    state().duplicateCharacter(id)
    state().importCharacter(createCharacter('Imported'))
    expect([...records.values()].map((c) => c.name).sort()).toEqual([
      'Imported',
      'Tordek',
      'Tordek (copy)',
    ])
  })

  it('saves only the character that changed', async () => {
    const tordek = madeAt('Tordek', 1000)
    const mialee = madeAt('Mialee', 2000)
    const { storage } = fakeStorage([tordek, mialee])
    await connectCharacterStorage(storage)

    state().renameCharacter(mialee.id, 'Mialee the Wise')
    expect(storage.save).toHaveBeenCalledTimes(1)
    expect(storage.save.mock.calls[0][0].id).toBe(mialee.id)

    // A change that touches no character saves nothing.
    state().openCharacter(tordek.id)
    state().backToList()
    expect(storage.save).toHaveBeenCalledTimes(1)
  })

  it('removes a deleted character from storage', async () => {
    const tordek = madeAt('Tordek', 1000)
    const { storage, records } = fakeStorage([tordek])
    await connectCharacterStorage(storage)

    state().deleteCharacter(tordek.id)
    expect(storage.remove).toHaveBeenCalledWith(tordek.id)
    expect(records.size).toBe(0)
  })

  it('keeps a character made before the stored ones arrived, after them', async () => {
    const stored = madeAt('Tordek', 1000)
    const { storage, records } = fakeStorage([stored])
    const connected = connectCharacterStorage(storage)

    // The user is quicker than the storage.
    state().newCharacter()
    const early = state().activeId as string
    expect(records.has(early)).toBe(true)

    await connected
    expect(state().order).toEqual([stored.id, early])
    expect(Object.keys(state().characters).sort()).toEqual([stored.id, early].sort())
  })

  it('keeps the newer copy when the app and the storage hold the same character', async () => {
    const stored = madeAt('Tordek', 1000)
    const { storage, records } = fakeStorage([stored])
    const connected = connectCharacterStorage(storage)
    const newer = { ...stored, name: 'Tordek the Bold' }
    state().importCharacter(newer)

    await connected
    expect(state().characters[stored.id]).toBe(newer)
    expect(state().order).toEqual([stored.id])
    expect(records.get(stored.id)).toBe(newer)
  })

  it('reports a storage that cannot be read, and carries on empty', async () => {
    const { storage } = fakeStorage()
    storage.loadAll.mockRejectedValue(new Error('blocked'))

    await connectCharacterStorage(storage)
    expect(state().characters).toEqual({})
    expect(useStorageStatus.getState().persistent).toBe(false)
  })

  it('reports a character that could not be saved or removed', async () => {
    const tordek = madeAt('Tordek', 1000)
    const { storage } = fakeStorage([tordek])
    await connectCharacterStorage(storage)

    storage.remove.mockRejectedValue(new Error('blocked'))
    state().deleteCharacter(tordek.id)
    await vi.waitFor(() => expect(useStorageStatus.getState().persistent).toBe(false))

    useStorageStatus.setState({ persistent: true })
    storage.save.mockRejectedValue(new Error('blocked'))
    state().newCharacter()
    await vi.waitFor(() => expect(useStorageStatus.getState().persistent).toBe(false))
  })
})
