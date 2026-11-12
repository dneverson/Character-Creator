import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SheetView } from './SheetView'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { useCharacterStore } from '../../character/store'
import { createCharacter } from '../../character/model'
import { loadClasses, type LoadedClass } from '../../data/class'
import { loadBackgrounds } from '../../data/background'
import { loadRaces } from '../../data/race'
import { loadFeats } from '../../data/feats'
import { loadItems } from '../../data/items'
import { loadSpells } from '../../data/spells'
import { loadBeasts } from '../../data/beasts'
import { loadFightingStyleOptions } from '../../data/classOptions'
import { loadLanguages } from '../../data/languages'
import { FIGHTER, ITEMS, loadedClass, stack } from '../../test/derivedFixtures'
import { listsOf, makeSpell } from '../../test/spellFixtures'
import { makeBeast } from '../../test/beastFixtures'
import { settle } from '../../test/settle'

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
  loadFightingStyleOptions: vi.fn(),
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
const wolf = makeBeast({ name: 'Wolf', source: 'MM', cr: '1/4', crValue: 0.25 })

function seed(caster: boolean) {
  const c = createCharacter('Tordek')
  c.classes = [{ name: caster ? 'Cleric' : 'Fighter', source: 'PHB', level: 3 }]
  c.abilities = {
    ...c.abilities,
    str: { base: 16, other: 0 },
    wis: { base: 16, other: 0 },
  }
  c.equipment.items = [stack('Longsword')]
  c.story = { ...c.story, alignment: 'Neutral Good', backstory: 'Raised by wolves.' }
  if (caster) {
    c.spells = {
      'Cleric|PHB': {
        cantrips: [{ name: 'Sacred Flame', source: 'PHB', level: 0 }],
        spells: [],
      },
    }
    c.wildShapes = [{ name: 'Wolf', source: 'MM' }]
  }
  useCharacterStore.setState({
    characters: { [c.id]: c },
    order: [c.id],
    activeId: c.id,
    view: 'sheet',
  })
  return c
}

const active = (id: string) => useCharacterStore.getState().characters[id]

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

async function openTab(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('tab', { name }))
  return screen.getByRole('tabpanel')
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.mocked(loadClasses).mockResolvedValue([FIGHTER, cleric])
  vi.mocked(loadBackgrounds).mockResolvedValue([])
  vi.mocked(loadRaces).mockResolvedValue([])
  vi.mocked(loadFeats).mockResolvedValue([])
  vi.mocked(loadFightingStyleOptions).mockResolvedValue([])
  vi.mocked(loadLanguages).mockResolvedValue([])
  vi.mocked(loadItems).mockResolvedValue(ITEMS)
  vi.mocked(loadSpells).mockResolvedValue([sacredFlame])
  vi.mocked(loadBeasts).mockResolvedValue([wolf])
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

afterEach(() => {
  window.matchMedia = original
})

describe('the sheet tabs', () => {
  it('leaves out Spells for a non-caster and Extras for a character with no Wild Shape', async () => {
    seed(false)
    renderSheet()
    await screen.findByRole('tab', { name: 'Inventory' })
    expect(screen.queryByRole('tab', { name: 'Spells' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Extras' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Features & Traits' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Story' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Notes' })).toBeInTheDocument()
  })

  it('shows what is carried and opens an item in the sheet pane, not beside the table', async () => {
    const user = userEvent.setup()
    setWide()
    seed(false)
    renderSheet()
    const panel = await openTab(user, 'Inventory')
    expect(await within(panel).findByText(/Carried/)).toBeInTheDocument()
    expect(within(panel).getByLabelText('Gold pieces')).toBeInTheDocument()
    const table = await within(panel).findByRole('table', { name: 'Items' })
    await user.click(within(table).getByText('Longsword'))
    // One pane, the sheet's, holds the item's text; the table has none of its own.
    const panes = document.querySelectorAll('.data-table-detail')
    expect(panes).toHaveLength(1)
    expect(panel.contains(panes[0])).toBe(true)
    expect(within(panes[0] as HTMLElement).getByText('Longsword')).toBeInTheDocument()
    await user.click(within(table).getByText('Longsword'))
    expect(document.querySelector('.data-table-detail')).toBeNull()
  })

  it('takes off a worn item from the Inventory tab', async () => {
    const user = userEvent.setup()
    const c = seed(false)
    renderSheet()
    const panel = await openTab(user, 'Inventory')
    await user.click(
      await within(panel).findByRole('checkbox', { name: 'Longsword equipped' }),
    )
    await waitFor(() => expect(active(c.id).equipment.items[0].equipped).toBe(false))
  })

  it('opens a row over the sheet on a narrower screen', async () => {
    const user = userEvent.setup()
    seed(true)
    renderSheet()
    const panel = await openTab(user, 'Features & Traits')
    const table = await within(panel).findByRole('table', { name: 'Features and traits' })
    await user.click(within(table).getByText('Spellcasting'))
    const overlay = await screen.findByRole('dialog')
    expect(within(overlay).getByText('You cast divine spells.')).toBeInTheDocument()
    await user.click(within(overlay).getByRole('button', { name: 'Back' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('closes a row text when another tab is opened, and leaves a number breakdown open', async () => {
    const user = userEvent.setup()
    setWide()
    seed(true)
    renderSheet()
    const panel = await openTab(user, 'Features & Traits')
    const table = await within(panel).findByRole('table', { name: 'Features and traits' })
    await user.click(within(table).getByText('Spellcasting'))
    expect(document.querySelector('.data-table-detail')).not.toBeNull()
    await openTab(user, 'Story')
    expect(document.querySelector('.data-table-detail')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'How Armor class adds up' }))
    expect(document.querySelector('.data-table-detail')).not.toBeNull()
    await openTab(user, 'Notes')
    expect(document.querySelector('.data-table-detail')).not.toBeNull()
  })

  it('lists the features and opens one in full', async () => {
    const user = userEvent.setup()
    setWide()
    seed(true)
    renderSheet()
    const panel = await openTab(user, 'Features & Traits')
    const table = await within(panel).findByRole('table', { name: 'Features and traits' })
    await user.click(within(table).getByText('Spellcasting'))
    expect(await screen.findByText('You cast divine spells.')).toBeInTheDocument()
  })

  it('shows a caster the spell numbers and the spells, each openable', async () => {
    const user = userEvent.setup()
    setWide()
    seed(true)
    renderSheet()
    const panel = await openTab(user, 'Spells')
    const numbers = await within(panel).findByRole('table', { name: 'Spellcasting' })
    expect(within(numbers).getByText('Cleric')).toBeInTheDocument()
    expect(within(numbers).getByText(/cantrips 1 of 3/)).toBeInTheDocument()
    const table = await within(panel).findByRole('table', { name: 'Your spells' })
    expect(
      within(table).queryByRole('button', { name: /Remove/ }),
    ).not.toBeInTheDocument()
    await user.click(within(table).getByText('Sacred Flame'))
    expect(
      await screen.findByText(/Flame-like radiance descends on a creature/),
    ).toBeInTheDocument()
  })

  it('reads the story in full and takes the player back to the editor to change it', async () => {
    const user = userEvent.setup()
    seed(false)
    renderSheet()
    const panel = await openTab(user, 'Story')
    expect(within(panel).getByText('Neutral Good')).toBeInTheDocument()
    expect(within(panel).getByText('Raised by wolves.')).toBeInTheDocument()
    expect(within(panel).queryByText('Ideals')).not.toBeInTheDocument()
    await user.click(within(panel).getByRole('button', { name: 'Edit story' }))
    expect(useCharacterStore.getState().view).toBe('editor')
  })

  it('says so when no story is written', async () => {
    const user = userEvent.setup()
    const c = seed(false)
    useCharacterStore.setState({
      characters: {
        [c.id]: { ...c, story: { ...c.story, alignment: '', backstory: '' } },
      },
    })
    renderSheet()
    const panel = await openTab(user, 'Story')
    expect(within(panel).getByText(/Nothing is written yet/)).toBeInTheDocument()
    expect(within(panel).getByText('Not chosen')).toBeInTheDocument()
  })

  it('keeps the notes typed in the Notes tab', async () => {
    const user = userEvent.setup()
    const c = seed(false)
    renderSheet()
    const panel = await openTab(user, 'Notes')
    const box = within(panel).getByLabelText('Notes')
    await user.type(box, 'Remember the key.')
    await user.tab()
    await waitFor(() => expect(active(c.id).story.notes).toBe('Remember the key.'))
  })

  it('shows the Wild Shape forms in Extras with their stat block', async () => {
    const user = userEvent.setup()
    setWide()
    seed(true)
    renderSheet()
    const panel = await openTab(user, 'Extras')
    const table = await within(panel).findByRole('table', { name: 'Wild Shape forms' })
    await user.click(within(table).getByText('Wolf'))
    const panes = document.querySelectorAll('.data-table-detail')
    expect(panes).toHaveLength(1)
    await settle()
  })
})
