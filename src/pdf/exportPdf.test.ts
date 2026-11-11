import { beforeEach, describe, expect, it, vi } from 'vitest'
import { exportCharacterPdf } from './exportPdf'
import { createCharacter } from '../character/model'
import { loadClasses, type LoadedClass } from '../data/class'
import { loadBackgrounds, type PlayableBackground } from '../data/background'
import { loadRaces, type PlayableRace } from '../data/race'
import { loadFeats, type Feat } from '../data/feats'
import { loadItems, type Item } from '../data/items'

vi.mock('../data/class', () => ({ loadClasses: vi.fn() }))
vi.mock('../data/background', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/background')>()),
  loadBackgrounds: vi.fn(),
}))
vi.mock('../data/race', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/race')>()),
  loadRaces: vi.fn(),
}))
vi.mock('../data/feats', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/feats')>()),
  loadFeats: vi.fn(),
}))

vi.mock('../data/items', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/items')>()),
  loadItems: vi.fn(),
}))

const buildCharacterSheet = vi.fn()
vi.mock('./characterSheet', () => ({
  buildCharacterSheet: (...args: unknown[]) => buildCharacterSheet(...args),
}))

const mockClasses = vi.mocked(loadClasses)
const mockBackgrounds = vi.mocked(loadBackgrounds)
const mockRaces = vi.mocked(loadRaces)
const mockFeats = vi.mocked(loadFeats)
const mockItems = vi.mocked(loadItems)

beforeEach(() => {
  vi.clearAllMocks()
  buildCharacterSheet.mockResolvedValue(new Uint8Array([1, 2, 3]))
  mockClasses.mockResolvedValue([])
  mockBackgrounds.mockResolvedValue([])
  mockRaces.mockResolvedValue([])
  mockFeats.mockResolvedValue([])
  mockItems.mockResolvedValue([])
  // jsdom lacks the object-URL APIs; stub them for the download step.
  URL.createObjectURL = vi.fn(() => 'blob:fake')
  URL.revokeObjectURL = vi.fn()
})

describe('exportCharacterPdf', () => {
  it('resolves the character references and triggers a slugified download', async () => {
    const bg: PlayableBackground = {
      featGrants: [],
      key: 'Acolyte|PHB',
      name: 'Acolyte',
      source: 'PHB',
      edition: 'classic',
      abilityOptions: [],
      storyTables: [],
      entries: [],
    }
    const race: PlayableRace = {
      featGrants: [],
      key: 'Elf|PHB',
      name: 'Elf (High)',
      baseName: 'Elf',
      subraceName: 'High',
      source: 'PHB',
      abilityOptions: [],
      skillProficiencies: [],
    }
    const feats: Feat[] = []
    mockBackgrounds.mockResolvedValue([bg])
    mockRaces.mockResolvedValue([race])
    mockFeats.mockResolvedValue(feats)
    const items: Item[] = []
    mockItems.mockResolvedValue(items)

    const c = createCharacter('Sir Test / Two')
    c.background = { name: 'Acolyte', source: 'PHB', abilityChoices: {} }
    c.race = {
      name: 'Elf (High)',
      baseName: 'Elf',
      source: 'PHB',
      subraceName: 'High',
      abilityFixed: {},
      abilityChoices: {},
    }

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    await exportCharacterPdf(c)

    expect(buildCharacterSheet).toHaveBeenCalledOnce()
    const opts = buildCharacterSheet.mock.calls[0][1]
    expect(opts.background).toBe(bg)
    expect(opts.race).toBe(race)
    expect(opts.feats).toBe(feats)
    expect(opts.items).toBe(items)
    expect(clickSpy).toHaveBeenCalledOnce()
    expect(URL.createObjectURL).toHaveBeenCalledOnce()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake')
    clickSpy.mockRestore()
  })

  it('indexes loaded classes and matches a subrace-less race', async () => {
    const loadedClass: LoadedClass = {
      entry: {
        name: 'Wizard',
        source: 'PHB',
        edition: 'classic',
        hd: { number: 1, faces: 6 },
        classFeatures: [],
      },
      file: {},
    }
    const race: PlayableRace = {
      featGrants: [],
      key: 'Human|PHB',
      name: 'Human',
      baseName: 'Human',
      source: 'PHB',
      abilityOptions: [],
      skillProficiencies: [],
    }
    mockClasses.mockResolvedValue([loadedClass])
    mockRaces.mockResolvedValue([race])

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    const c = createCharacter('Gandalf')
    // A race with no subrace exercises the (subraceName ?? '') fallbacks.
    c.race = {
      name: 'Human',
      baseName: 'Human',
      source: 'PHB',
      abilityFixed: {},
      abilityChoices: {},
    }
    await exportCharacterPdf(c)

    const opts = buildCharacterSheet.mock.calls[0][1]
    expect(opts.classByKey.get('Wizard|PHB')).toBe(loadedClass)
    expect(opts.race).toBe(race)
    clickSpy.mockRestore()
  })

  it('leaves references undefined and defaults the filename when the character is blank', async () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    let downloaded = ''
    const appendSpy = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation((node) => {
        downloaded = (node as HTMLAnchorElement).download
        return node
      })

    await exportCharacterPdf(createCharacter(''))

    const opts = buildCharacterSheet.mock.calls[0][1]
    expect(opts.background).toBeUndefined()
    expect(opts.race).toBeUndefined()
    expect(downloaded).toBe('character.pdf')
    clickSpy.mockRestore()
    appendSpy.mockRestore()
  })
})
