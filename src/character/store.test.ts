import { beforeEach, describe, expect, it } from 'vitest'
import { useCharacterStore } from './store'
import { createCharacter } from './model'
import { newRoll, rollAction } from './rollHistory'

function reset() {
  localStorage.clear()
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
}

describe('character store', () => {
  beforeEach(reset)

  it('creates a character and opens the editor', () => {
    useCharacterStore.getState().newCharacter()
    const s = useCharacterStore.getState()
    expect(s.order).toHaveLength(1)
    expect(s.view).toBe('editor')
    expect(s.activeId).toBe(s.order[0])
    expect(s.characters[s.order[0]].selectedBooks).toEqual(['PHB', 'MM', 'DMG'])
  })

  it('updates only the active character and bumps updatedAt', () => {
    const store = useCharacterStore.getState()
    store.newCharacter()
    const id = useCharacterStore.getState().activeId!
    const before = useCharacterStore.getState().characters[id].updatedAt
    useCharacterStore.getState().updateActive({ selectedBooks: ['XPHB'] })
    const after = useCharacterStore.getState().characters[id]
    expect(after.selectedBooks).toEqual(['XPHB'])
    expect(after.updatedAt).toBeGreaterThanOrEqual(before)
  })

  it('duplicates a character with a new id and no shared references', () => {
    useCharacterStore.getState().newCharacter()
    const id = useCharacterStore.getState().activeId!
    useCharacterStore.getState().duplicateCharacter(id)
    const { order, characters } = useCharacterStore.getState()
    expect(order).toHaveLength(2)
    const copyId = order[1]
    expect(copyId).not.toBe(id)
    expect(characters[copyId].selectedBooks).not.toBe(characters[id].selectedBooks)
    expect(characters[copyId].name).toContain('copy')
  })

  it('deletes the active character and returns to the list', () => {
    useCharacterStore.getState().newCharacter()
    const id = useCharacterStore.getState().activeId!
    useCharacterStore.getState().deleteCharacter(id)
    const s = useCharacterStore.getState()
    expect(s.order).toHaveLength(0)
    expect(s.activeId).toBeNull()
    expect(s.view).toBe('list')
  })

  it('deleting a non-active character keeps the current editor open', () => {
    const store = useCharacterStore.getState()
    store.newCharacter()
    const first = useCharacterStore.getState().activeId!
    store.newCharacter()
    const second = useCharacterStore.getState().activeId!
    useCharacterStore.getState().deleteCharacter(first)
    const s = useCharacterStore.getState()
    expect(s.order).toEqual([second])
    expect(s.activeId).toBe(second)
    expect(s.view).toBe('editor')
  })

  it('opens an existing character and ignores an unknown id', () => {
    useCharacterStore.getState().newCharacter()
    const id = useCharacterStore.getState().activeId!
    useCharacterStore.getState().backToList()
    expect(useCharacterStore.getState().view).toBe('list')

    useCharacterStore.getState().openCharacter('nope')
    expect(useCharacterStore.getState().activeId).toBeNull()

    useCharacterStore.getState().openCharacter(id)
    const s = useCharacterStore.getState()
    expect(s.activeId).toBe(id)
    expect(s.view).toBe('editor')
  })

  it('imports a character once, without duplicating on re-import', () => {
    const imported = createCharacter('Boromir')
    useCharacterStore.getState().importCharacter(imported)
    useCharacterStore.getState().importCharacter(imported)
    const s = useCharacterStore.getState()
    expect(s.order).toEqual([imported.id])
    expect(s.characters[imported.id].name).toBe('Boromir')
  })

  it('renames an existing character and ignores an unknown id', () => {
    useCharacterStore.getState().newCharacter()
    const id = useCharacterStore.getState().activeId!
    useCharacterStore.getState().renameCharacter(id, 'Faramir')
    expect(useCharacterStore.getState().characters[id].name).toBe('Faramir')

    useCharacterStore.getState().renameCharacter('missing', 'X')
    expect(useCharacterStore.getState().characters['missing']).toBeUndefined()
  })

  it('switches the open character between its editor and its sheet', () => {
    useCharacterStore.getState().newCharacter()
    const id = useCharacterStore.getState().activeId
    useCharacterStore.getState().setView('sheet')
    expect(useCharacterStore.getState().view).toBe('sheet')
    useCharacterStore.getState().setView('editor')
    expect(useCharacterStore.getState().view).toBe('editor')
    // The sheet is the same character, and the way back to the list still works.
    expect(useCharacterStore.getState().activeId).toBe(id)
    useCharacterStore.getState().setView('sheet')
    useCharacterStore.getState().backToList()
    expect(useCharacterStore.getState().view).toBe('list')
  })

  it('has no sheet to show while no character is open', () => {
    useCharacterStore.getState().setView('sheet')
    expect(useCharacterStore.getState().view).toBe('list')
  })

  it('deleting the character on the sheet returns to the list', () => {
    useCharacterStore.getState().newCharacter()
    const id = useCharacterStore.getState().activeId!
    useCharacterStore.getState().setView('sheet')
    useCharacterStore.getState().deleteCharacter(id)
    expect(useCharacterStore.getState().view).toBe('list')
  })

  it('opening a character shows its editor, also from the sheet', () => {
    useCharacterStore.getState().newCharacter()
    const id = useCharacterStore.getState().activeId!
    useCharacterStore.getState().setView('sheet')
    useCharacterStore.getState().openCharacter(id)
    expect(useCharacterStore.getState().view).toBe('editor')
  })

  it('duplicating an unknown id is a no-op', () => {
    useCharacterStore.getState().duplicateCharacter('missing')
    expect(useCharacterStore.getState().order).toHaveLength(0)
  })

  it('updateActive is a no-op with no active character', () => {
    useCharacterStore.getState().updateActive({ name: 'Ghost' })
    expect(useCharacterStore.getState().order).toHaveLength(0)
  })

  it('updateActive is a no-op when activeId points to a missing character', () => {
    // A stale activeId (e.g. from an inconsistent persisted blob) references an
    // id that is not in the map; the update must leave state untouched.
    useCharacterStore.setState({
      characters: {},
      order: [],
      activeId: 'ghost',
      view: 'editor',
    })
    useCharacterStore.getState().updateActive({ name: 'Nobody' })
    const s = useCharacterStore.getState()
    expect(s.characters).toEqual({})
    expect(s.activeId).toBe('ghost')
  })

  it('replaces a stored character with a corrected copy, without marking it edited', () => {
    useCharacterStore.getState().newCharacter()
    const before =
      useCharacterStore.getState().characters[useCharacterStore.getState().activeId!]
    const corrected = { ...before, wildShapes: [{ name: 'Wolf', source: 'MM' }] }
    useCharacterStore.getState().replaceCharacter(corrected)

    const s = useCharacterStore.getState()
    expect(s.characters[before.id]).toBe(corrected)
    expect(s.characters[before.id].updatedAt).toBe(before.updatedAt)
    expect(s.order).toEqual([before.id])
  })

  it('replacing a character that is not stored is a no-op', () => {
    useCharacterStore.getState().replaceCharacter(createCharacter('Ghost'))
    const s = useCharacterStore.getState()
    expect(s.characters).toEqual({})
    expect(s.order).toHaveLength(0)
  })

  // Reading stored characters, older ones included, is covered where it now
  // happens: src/storage/characters.test.ts and persistence.test.ts.

  describe('history', () => {
    const active = () => {
      const s = useCharacterStore.getState()
      return s.characters[s.activeId!]
    }
    const actions = (id: string) =>
      useCharacterStore.getState().characters[id].history.map((e) => e.action?.type)

    it('records an edit of the active character, and a rename', () => {
      useCharacterStore.getState().newCharacter()
      const id = active().id
      useCharacterStore.getState().updateActive({ selectedBooks: ['XPHB'] })
      useCharacterStore.getState().renameCharacter(id, 'Faramir')

      expect(active().history.map((e) => e.changes.map((c) => c.path))).toEqual([
        [], // created
        [['selectedBooks']],
        [['name']],
      ])
      expect(active().history[2].changes[0]).toMatchObject({ after: 'Faramir' })
    })

    it('records a roll passed with an edit, and makes it the roll in use', () => {
      useCharacterStore.getState().newCharacter()
      const roll = newRoll({ stream: 'hitDie', kind: 'hit-die', rolls: [7] })
      useCharacterStore
        .getState()
        .updateActive({ hp: { ...active().hp, rolls: [7] } }, rollAction(roll))

      expect(active().history.at(-1)?.action).toEqual({ type: 'roll', roll })
      expect(active().rollCursors.hitDie).toBe(roll.id)
    })

    it('gives a duplicate the history of its source, and says where it came from', () => {
      useCharacterStore.getState().newCharacter()
      const id = active().id
      useCharacterStore.getState().updateActive({ name: 'Boromir' })
      useCharacterStore.getState().duplicateCharacter(id)

      const copyId = useCharacterStore.getState().order[1]
      expect(actions(copyId)).toEqual(['created', undefined, 'duplicated'])
      const { history } = useCharacterStore.getState().characters[copyId]
      expect(history.at(-1)?.action).toEqual({ type: 'duplicated', from: id })
      // The source's own history is not touched.
      expect(actions(id)).toEqual(['created', undefined])
    })

    it('records nothing when a corrected copy is put in place', () => {
      useCharacterStore.getState().newCharacter()
      const before = active()
      useCharacterStore
        .getState()
        .replaceCharacter({ ...before, wildShapes: [{ name: 'Wolf', source: 'MM' }] })
      expect(active().history).toBe(before.history)
    })
  })
})
