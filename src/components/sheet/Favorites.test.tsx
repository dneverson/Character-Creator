import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SheetView } from './SheetView'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { useCharacterStore } from '../../character/store'
import { createCharacter, type Character } from '../../character/model'
import type { Favorite } from '../../character/favorites'
import { loadClasses, type LoadedClass } from '../../data/class'
import { loadBackgrounds } from '../../data/background'
import { loadRaces } from '../../data/race'
import { loadFeats } from '../../data/feats'
import { loadItems } from '../../data/items'
import { loadSpells } from '../../data/spells'
import { loadBeasts } from '../../data/beasts'
import { loadConditions } from '../../data/conditions'
import { loadClassOptions } from '../../data/classOptions'
import { loadLanguages } from '../../data/languages'
import { ITEMS, loadedClass, stack } from '../../test/derivedFixtures'
import { makeItem } from '../../test/itemFixtures'
import { listsOf, makeSpell } from '../../test/spellFixtures'

vi.mock('../../data/class', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/class')>()),
  loadClasses: vi.fn(),
}))
vi.mock('../../data/background', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/background')>()),
  loadBackgrounds: vi.fn(),
}))
vi.mock('../../data/race', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/race')>()),
  loadRaces: vi.fn(),
}))
vi.mock('../../data/feats', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/feats')>()),
  loadFeats: vi.fn(),
}))
vi.mock('../../data/classOptions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/classOptions')>()),
  loadClassOptions: vi.fn(),
}))
vi.mock('../../data/languages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/languages')>()),
  loadLanguages: vi.fn(),
}))
vi.mock('../../data/items', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/items')>()),
  loadItems: vi.fn(),
}))
vi.mock('../../data/spells', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/spells')>()),
  loadSpells: vi.fn(),
}))
vi.mock('../../data/beasts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/beasts')>()),
  loadBeasts: vi.fn(),
}))
vi.mock('../../data/conditions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/conditions')>()),
  loadConditions: vi.fn(),
}))

const feature = (name: string, level: number, text: string) => ({
  name,
  source: 'PHB',
  className: 'Fighter',
  classSource: 'PHB',
  level,
  entries: [text],
})

const fighter: LoadedClass = loadedClass('Fighter', [], [], {
  classFeature: [
    feature('Second Wind', 1, 'You have a limited well of stamina.'),
    feature('Action Surge', 2, 'You can push yourself beyond your normal limits.'),
  ],
})
fighter.entry.classFeatures = ['Second Wind|Fighter|PHB|1', 'Action Surge|Fighter|PHB|2']

const cleric: LoadedClass = loadedClass('Cleric', [], [], {
  classFeature: [
    {
      name: 'Spellcasting',
      source: 'PHB',
      className: 'Cleric',
      classSource: 'PHB',
      level: 1,
      entries: ['You cast divine spells.'],
    },
  ],
})
cleric.entry.spellcastingAbility = 'wis'
cleric.entry.casterProgression = 'full'
cleric.entry.cantripProgression = [3, 3, 3]
cleric.entry.preparedSpells = '<$level$> + <$wis_mod$>'
cleric.entry.classFeatures = ['Spellcasting|Cleric|PHB|1']

const sacredFlame = makeSpell({
  name: 'Sacred Flame',
  source: 'PHB',
  level: 0,
  school: 'V',
  lists: listsOf('Cleric|PHB'),
  entries: ['Flame-like radiance descends on a creature.'],
})

const wand = makeItem({
  name: 'Wand of Sparks',
  source: 'DMG',
  magic: true,
  charges: { max: '7', recharge: 'on a long rest', on: 'restLong' },
  entries: ['The wand has 7 charges.'],
})

const WIND = 'use:classFeature|Second Wind|PHB|Fighter#Second Wind'
const WAND = 'item:Wand of Sparks|DMG'

function seed(patch: Partial<Character> = {}) {
  const c = createCharacter('Tordek')
  c.classes = [
    { name: 'Fighter', source: 'PHB', level: 3 },
    { name: 'Cleric', source: 'PHB', level: 1 },
  ]
  c.abilities = {
    ...c.abilities,
    str: { base: 16, other: 0 },
    wis: { base: 16, other: 0 },
  }
  c.equipment.items = [stack('Longsword'), stack('Wand of Sparks', { source: 'DMG' })]
  c.spells = {
    'Cleric|PHB': {
      cantrips: [{ name: 'Sacred Flame', source: 'PHB', level: 0 }],
      spells: [],
    },
  }
  Object.assign(c, patch)
  useCharacterStore.setState({
    characters: { [c.id]: c },
    order: [c.id],
    activeId: c.id,
    view: 'sheet',
  })
  return c
}

const active = () => {
  const { activeId, characters } = useCharacterStore.getState()
  return characters[activeId ?? '']
}

const original = window.matchMedia
function setWide() {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: query.includes('min-width: 1200px'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

function renderSheet() {
  return render(
    <ThemeProvider>
      <SheetView />
    </ThemeProvider>,
  )
}

type User = ReturnType<typeof userEvent.setup>

async function openTab(user: User, name: string) {
  await user.click(await screen.findByRole('tab', { name }))
  return screen.getByRole('tabpanel')
}

/** Pins the row of a table that has `text` in it. */
async function pinRow(user: User, table: HTMLElement, text: string) {
  const row = within(table).getByText(text).closest('tr')
  if (!row) throw new Error(`no row for ${text}`)
  await user.click(within(row).getByRole('button', { name: 'Add to Favorites' }))
}

const block = () => screen.getByRole('region', { name: 'Favorites' })
const rowOf = (name: string) => within(block()).getByRole('listitem', { name })

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.mocked(loadClasses).mockResolvedValue([fighter, cleric])
  vi.mocked(loadBackgrounds).mockResolvedValue([])
  vi.mocked(loadRaces).mockResolvedValue([])
  vi.mocked(loadFeats).mockResolvedValue([])
  vi.mocked(loadClassOptions).mockResolvedValue([])
  vi.mocked(loadLanguages).mockResolvedValue([])
  vi.mocked(loadItems).mockResolvedValue([...ITEMS, wand])
  vi.mocked(loadSpells).mockResolvedValue([sacredFlame])
  vi.mocked(loadBeasts).mockResolvedValue([])
  vi.mocked(loadConditions).mockResolvedValue([])
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

afterEach(() => {
  window.matchMedia = original
})

describe('the Favorites block', () => {
  it('leads the Actions tab with one line on how to add a favorite when it is empty', async () => {
    const user = userEvent.setup()
    seed()
    renderSheet()
    const panel = await openTab(user, 'Actions')
    const favorites = within(panel).getByRole('region', { name: 'Favorites' })
    expect(within(favorites).getByText(/Nothing here yet/)).toBeInTheDocument()
    const attacks = await within(panel).findByRole('table', { name: 'Attacks' })
    // The block comes before the attacks table.
    expect(
      favorites.compareDocumentPosition(attacks) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('pins an attack from its table without opening anything or recording history', async () => {
    const user = userEvent.setup()
    setWide()
    const c = seed()
    renderSheet()
    const panel = await openTab(user, 'Actions')
    const table = await within(panel).findByRole('table', { name: 'Attacks' })
    await pinRow(user, table, 'Longsword')
    expect(active().favorites).toEqual([{ kind: 'attack', key: expect.any(String) }])
    expect(active().history).toHaveLength(c.history.length)
    expect(active().completedAt).toBe(c.completedAt)
    expect(document.querySelector('.data-table-detail')).toBeNull()
    const row = rowOf('Longsword')
    // The numbers in the favorite are the sheet's: the info button opens how it adds up.
    await user.click(
      within(row).getByRole('button', { name: 'How Longsword attack bonus adds up' }),
    )
    await waitFor(() =>
      expect(
        screen.getAllByRole('table', { name: 'Longsword attack bonus' }).length,
      ).toBeGreaterThan(0),
    )
    // The pin of the same attack now takes it off.
    const pinned = within(table).getByRole('button', { name: 'Remove from Favorites' })
    await user.click(pinned)
    expect(active().favorites).toEqual([])
    expect(within(block()).getByText(/Nothing here yet/)).toBeInTheDocument()
  })

  it('shows a limited use and a feature with counters that spend in place', async () => {
    const user = userEvent.setup()
    setWide()
    seed()
    renderSheet()
    await openTab(user, 'Features & Traits')
    const features = await screen.findByRole('table', { name: 'Features and traits' })
    await pinRow(user, features, 'Second Wind')
    await user.click(screen.getByRole('tab', { name: 'Actions' }))
    const uses = await screen.findByRole('table', { name: 'Limited uses' })
    await pinRow(user, uses, 'Action Surge')

    expect(active().favorites?.map((f) => f.kind)).toEqual(['feature', 'use'])
    const wind = rowOf('Second Wind')
    await user.click(
      within(wind).getByRole('button', { name: 'Second Wind use 1 of 1, available' }),
    )
    expect(active().play.uses[WIND]).toBe(1)
    // Spending did not open the row's text.
    expect(document.querySelector('.data-table-detail')).toBeNull()
    // The row itself opens the feature's text.
    await user.click(within(wind).getByText('Second Wind'))
    expect(
      await screen.findByText('You have a limited well of stamina.'),
    ).toBeInTheDocument()

    const surge = rowOf('Action Surge')
    expect(
      within(surge).getByRole('group', { name: 'Action Surge uses' }),
    ).toBeInTheDocument()
    await user.click(within(surge).getByText('Restores'))
    expect(
      await screen.findByText('You can push yourself beyond your normal limits.'),
    ).toBeInTheDocument()
  })

  it('shows an item with its charges counter and its text', async () => {
    const user = userEvent.setup()
    setWide()
    seed()
    renderSheet()
    const panel = await openTab(user, 'Inventory')
    const table = await within(panel).findByRole('table', { name: 'Items' })
    await pinRow(user, table, 'Wand of Sparks')
    await user.click(screen.getByRole('tab', { name: 'Actions' }))
    const row = await waitFor(() => rowOf('Wand of Sparks'))
    expect(within(row).getByText('Qty')).toBeInTheDocument()
    await user.click(
      within(row).getByRole('button', { name: 'Spend one Wand of Sparks' }),
    )
    expect(active().play.uses[WAND]).toBe(1)
    await user.click(within(row).getByText('Wand of Sparks'))
    expect(await screen.findByText(/The wand has 7 charges/)).toBeInTheDocument()
  })

  it('shows a spell with its stats and opens its text', async () => {
    const user = userEvent.setup()
    setWide()
    seed()
    renderSheet()
    const panel = await openTab(user, 'Spells')
    const table = await within(panel).findByRole('table', { name: 'Your spells' })
    await pinRow(user, table, 'Sacred Flame')
    expect(active().favorites).toEqual([{ kind: 'spell', key: sacredFlame.key }])
    expect(document.querySelector('.data-table-detail')).toBeNull()
    await user.click(screen.getByRole('tab', { name: 'Actions' }))
    const row = await waitFor(() => rowOf('Sacred Flame'))
    expect(within(row).getByText('Casting time')).toBeInTheDocument()
    expect(within(row).getByText('Range')).toBeInTheDocument()
    await user.click(within(row).getByText('Sacred Flame'))
    expect(await screen.findByText(/Flame-like radiance descends/)).toBeInTheDocument()
  })

  it('pins from the Spells, Inventory and Features tabs without opening the row', async () => {
    const user = userEvent.setup()
    setWide()
    seed()
    renderSheet()
    for (const [tab, label, text] of [
      ['Spells', 'Your spells', 'Sacred Flame'],
      ['Inventory', 'Items', 'Wand of Sparks'],
      ['Features & Traits', 'Features and traits', 'Second Wind'],
    ]) {
      const panel = await openTab(user, tab)
      const table = await within(panel).findByRole('table', { name: label })
      await pinRow(user, table, text)
      expect(document.querySelector('.data-table-detail')).toBeNull()
      expect(
        within(table).getAllByRole('button', { name: 'Remove from Favorites' }),
      ).toHaveLength(1)
    }
    expect(active().favorites?.map((f) => f.kind)).toEqual(['spell', 'item', 'feature'])
  })

  it('moves a favorite up and down and removes it', async () => {
    const user = userEvent.setup()
    const favorites: Favorite[] = [
      { kind: 'feature', key: 'a' },
      { kind: 'use', key: WIND },
    ]
    seed({ favorites })
    renderSheet()
    await openTab(user, 'Actions')
    // The first row cannot go up and the last cannot go down; here the first is gone.
    expect(rowOf('Feature: No longer on this character')).toBeInTheDocument()
    const wind = await waitFor(() => rowOf('Second Wind'))
    expect(
      within(wind).getByRole('button', { name: 'Move Second Wind down' }),
    ).toBeDisabled()
    await user.click(within(wind).getByRole('button', { name: 'Move Second Wind up' }))
    expect(active().favorites?.map((f) => f.kind)).toEqual(['use', 'feature'])
    expect(
      within(rowOf('Second Wind')).getByRole('button', { name: 'Move Second Wind up' }),
    ).toBeDisabled()
    await user.click(
      within(rowOf('Second Wind')).getByRole('button', {
        name: 'Remove Second Wind from Favorites',
      }),
    )
    expect(active().favorites?.map((f) => f.kind)).toEqual(['feature'])
  })

  it('says so for a favorite that is no longer there, and offers only to remove it', async () => {
    const user = userEvent.setup()
    seed({
      favorites: [
        { kind: 'attack', key: 'attack|Vorpal Sword|DMG' },
        { kind: 'spell', key: 'Wish|PHB' },
        { kind: 'item', key: 'Rod of Lordly Might|DMG' },
        { kind: 'feature', key: 'race:Gone:0' },
        { kind: 'use', key: 'use:nothing' },
      ],
    })
    renderSheet()
    await openTab(user, 'Actions')
    await waitFor(() =>
      expect(within(block()).getAllByText('No longer on this character')).toHaveLength(5),
    )
    expect(within(block()).queryByRole('button', { name: /Move/ })).toBeNull()
    const removes = within(block()).getAllByRole('button', {
      name: /^Remove .* from Favorites$/,
    })
    expect(removes).toHaveLength(5)
    await user.click(removes[0])
    expect(active().favorites).toHaveLength(4)
  })

  it('keeps the Level up undo and the history when something is pinned', async () => {
    const user = userEvent.setup()
    const c = seed()
    renderSheet()
    const panel = await openTab(user, 'Features & Traits')
    const table = await within(panel).findByRole('table', { name: 'Features and traits' })
    await pinRow(user, table, 'Second Wind')
    expect(active().history).toEqual(c.history)
  })
})
