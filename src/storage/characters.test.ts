import { describe, expect, it, vi } from 'vitest'
import {
  CHARACTER_SCHEMA_VERSION,
  createCharacter,
  type Character,
  type StoredCharacter,
} from '../character/model'
import { localCharacterStorage } from './characters'
import type { DeviceSettings } from './deviceSettings'
import { memoryStore } from './keyValue'

const KEY = 'characters'
const MOVED = 'characters-moved'

/** Device settings held in a plain map. */
function fakeSettings(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  const settings: DeviceSettings = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  }
  return { settings, values }
}

/** What the state library used to write: every character in one setting. */
const earlierText = (characters: Record<string, unknown>) =>
  JSON.stringify({
    state: { characters, order: Object.keys(characters), activeId: null },
    version: 1,
  })

function setup({ earlier = {}, persistent = true } = {}) {
  const store = memoryStore<Character>()
  const { settings, values } = fakeSettings(earlier)
  const storage = localCharacterStorage({
    store,
    persistent: () => persistent,
    earlier: { settings, key: KEY, movedKey: MOVED },
  })
  return { store, storage, values }
}

describe('localCharacterStorage', () => {
  it('stores one record per character, and gives them all back', async () => {
    const { store, storage } = setup()
    expect(await storage.loadAll()).toEqual([])

    const tordek = createCharacter('Tordek')
    const mialee = createCharacter('Mialee')
    await storage.save(tordek)
    await storage.save(mialee)
    expect((await store.keys()).sort()).toEqual([tordek.id, mialee.id].sort())

    const loaded = await storage.loadAll()
    expect(loaded).toHaveLength(2)
    expect(loaded).toEqual(expect.arrayContaining([tordek, mialee]))
  })

  it('replaces the stored character on a second save, and removes one', async () => {
    const { storage } = setup()
    const tordek = createCharacter('Tordek')
    await storage.save(tordek)
    await storage.save({ ...tordek, name: 'Tordek the Bold' })
    expect((await storage.loadAll()).map((c) => c.name)).toEqual(['Tordek the Bold'])

    await storage.remove(tordek.id)
    expect(await storage.loadAll()).toEqual([])
  })

  it('completes a stored character that lacks parts of the current model', async () => {
    const { store, storage } = setup()
    // As an older version of the app would have stored it.
    const partial: Partial<Character> = { name: 'Old Hero' }
    await store.set('old', partial as Character)

    const [loaded] = await storage.loadAll()
    expect(loaded.id).toBe('old') // the record's key is the id
    expect(loaded.name).toBe('Old Hero')
    expect(loaded.selectedBooks).toEqual(['PHB', 'MM', 'DMG'])
    expect(loaded.story.alignment).toBe('')
    expect(loaded.equipment).toMatchObject({ items: [], starting: {} })
  })

  it('stores a record of an earlier version again, once, brought up to date', async () => {
    const { store, storage } = setup()
    // As version 17 stored it: no version in the document, the rolls apart.
    const earlierRecord: StoredCharacter = {
      ...createCharacter('Old Hero'),
      id: 'old',
      schemaVersion: undefined,
      history: undefined,
      rollHistory: { records: [], cursors: {} },
    }
    await store.set('old', earlierRecord as Character)
    const current = createCharacter('Current')
    await storage.save(current)
    const set = vi.spyOn(store, 'set')

    const loaded = await storage.loadAll()
    const old = loaded.find((c) => c.id === 'old')
    expect(old?.schemaVersion).toBe(CHARACTER_SCHEMA_VERSION)
    // Only the earlier record is written, and what is stored is what was loaded.
    expect(set).toHaveBeenCalledTimes(1)
    expect(await store.get('old')).toEqual(old)

    expect(await storage.loadAll()).toEqual(expect.arrayContaining([old]))
    expect(set).toHaveBeenCalledTimes(1)
  })

  it('skips a record the browser lists but no longer holds', async () => {
    const { store, storage } = setup()
    const tordek = createCharacter('Tordek')
    await storage.save(tordek)
    const listed = store.keys
    store.keys = async () => [...(await listed()), 'gone']
    expect(await storage.loadAll()).toEqual([tordek])
  })

  describe('characters kept in a device setting before', () => {
    const earlier = {
      [KEY]: earlierText({ legacy: { name: 'Old Hero' }, broken: null }),
    }

    it('are brought over once, completed, and the setting is left as it was', async () => {
      const { store, storage, values } = setup({ earlier })

      const first = await storage.loadAll()
      expect(first).toHaveLength(1)
      expect(first[0].id).toBe('legacy')
      expect(first[0].name).toBe('Old Hero')
      expect(first[0].selectedBooks).toEqual(['PHB', 'MM', 'DMG'])
      expect(await store.get('legacy')).toEqual(first[0])
      // Nothing of the user's is deleted; the move is recorded instead.
      expect(values.get(KEY)).toBe(earlier[KEY])
      expect(values.get(MOVED)).toBe('true')
    })

    it('do not come back after the user deletes them', async () => {
      const { storage } = setup({ earlier })
      await storage.loadAll()
      await storage.remove('legacy')
      expect(await storage.loadAll()).toEqual([])
    })

    it('never replace a character that is already stored', async () => {
      const { store, storage } = setup({ earlier })
      const current = { ...createCharacter('Hero, level 5'), id: 'legacy' }
      await store.set('legacy', current)

      const loaded = await storage.loadAll()
      expect(loaded.map((c) => c.name)).toEqual(['Hero, level 5'])
    })

    it('are there for the visit, and tried again, when storage will not last', async () => {
      const { storage, values } = setup({ earlier, persistent: false })
      expect((await storage.loadAll()).map((c) => c.name)).toEqual(['Old Hero'])
      expect(values.has(MOVED)).toBe(false)
    })

    it('are ignored when the setting is not what the app wrote', async () => {
      for (const text of ['not json', 'null', '{}', '{"state":{}}']) {
        const { storage } = setup({ earlier: { [KEY]: text } })
        expect(await storage.loadAll()).toEqual([])
      }
    })
  })
})
