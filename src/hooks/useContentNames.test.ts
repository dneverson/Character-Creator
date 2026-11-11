import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCharacter, type Character } from '../character/model'
import { useCharacterStore } from '../character/store'
import { useContentStatus } from '../content/library'
import { loadItems, type Item } from '../data/items'
import { loadSpells, type Spell } from '../data/spells'
import { makeItem } from '../test/itemFixtures'
import { listsOf, makeSpell } from '../test/spellFixtures'
import { settle } from '../test/settle'
import { useContentNames } from './useContentNames'

vi.mock('../data/spells', () => ({ loadSpells: vi.fn() }))
vi.mock('../data/items', () => ({ loadItems: vi.fn() }))
const mockSpells = vi.mocked(loadSpells)
const mockItems = vi.mocked(loadItems)

const spell = (name: string, srdName?: string): Spell =>
  makeSpell({ name, srdName, level: 2, lists: listsOf('Wizard|PHB') })
const item = (name: string, srdName?: string): Item =>
  makeItem({ name, source: 'DMG', srdName })

const fullSpells = [spell("Melf's Acid Arrow", 'Acid Arrow')]
const fullItems = [item("Heward's Handy Haversack", 'Handy Haversack')]
const freeSpells = [spell('Acid Arrow')]
const freeItems = [item('Handy Haversack')]

function seedActive(mutate: (c: Character) => void): Character {
  const c = createCharacter('Mialee')
  mutate(c)
  useCharacterStore.setState({
    characters: { [c.id]: c },
    order: [c.id],
    activeId: c.id,
    view: 'editor',
  })
  return c
}

const builtOnFreeRules = (c: Character) => {
  c.spells = {
    'Wizard|PHB': {
      cantrips: [],
      spells: [{ name: 'Acid Arrow', source: 'PHB', level: 2 }],
    },
  }
  c.equipment.items = [{ name: 'Handy Haversack', source: 'DMG', quantity: 1 }]
}

const active = () => {
  const { characters, activeId } = useCharacterStore.getState()
  return characters[activeId as string]
}
const spellNames = () => active().spells['Wizard|PHB'].spells.map((s) => s.name)
const itemNames = () => active().equipment.items.map((i) => i.name)

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mockSpells.mockResolvedValue(fullSpells)
  mockItems.mockResolvedValue(fullItems)
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

describe('useContentNames', () => {
  it('does nothing without an open character', async () => {
    renderHook(() => useContentNames())
    await settle()
    expect(useCharacterStore.getState().characters).toEqual({})
  })

  it('names the picks of a character built on the free rules as the books do', async () => {
    const before = seedActive(builtOnFreeRules)
    renderHook(() => useContentNames())

    await waitFor(() => expect(spellNames()).toEqual(["Melf's Acid Arrow"]))
    expect(itemNames()).toEqual(["Heward's Handy Haversack"])
    // A correction, not an edit by the player.
    expect(active().updatedAt).toBe(before.updatedAt)
  })

  it('leaves a character alone when its picks are already named right', async () => {
    mockSpells.mockResolvedValue(freeSpells)
    mockItems.mockResolvedValue(freeItems)
    const before = seedActive(builtOnFreeRules)
    renderHook(() => useContentNames())
    await settle()
    expect(active()).toBe(before)
  })

  it('names a pick made later, and follows the content when it changes', async () => {
    seedActive(() => {})
    renderHook(() => useContentNames())
    await settle()

    // The player adds an item by the book's name: it gains the SRD's name.
    act(() => {
      useCharacterStore.getState().updateActive({
        equipment: {
          ...active().equipment,
          items: [{ name: "Heward's Handy Haversack", source: 'DMG', quantity: 1 }],
        },
      })
    })
    await waitFor(() =>
      expect(active().equipment.items[0].srdName).toBe('Handy Haversack'),
    )

    // The full content is switched off: the free rules name it differently.
    mockSpells.mockResolvedValue(freeSpells)
    mockItems.mockResolvedValue(freeItems)
    act(() => useContentStatus.setState({ epoch: useContentStatus.getState().epoch + 1 }))
    await waitFor(() => expect(itemNames()).toEqual(['Handy Haversack']))

    // And back on again.
    mockSpells.mockResolvedValue(fullSpells)
    mockItems.mockResolvedValue(fullItems)
    act(() => useContentStatus.setState({ epoch: useContentStatus.getState().epoch + 1 }))
    await waitFor(() => expect(itemNames()).toEqual(["Heward's Handy Haversack"]))
  })

  it('goes by the lists that loaded when another fails', async () => {
    mockItems.mockRejectedValue(new Error('offline'))
    seedActive(builtOnFreeRules)
    renderHook(() => useContentNames())

    await waitFor(() => expect(spellNames()).toEqual(["Melf's Acid Arrow"]))
    expect(itemNames()).toEqual(['Handy Haversack'])
  })
})
