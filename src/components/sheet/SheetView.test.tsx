import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SheetView } from './SheetView'
import { CharacterEditor } from '../editor/CharacterEditor'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { useCharacterStore } from '../../character/store'
import { createCharacter } from '../../character/model'
import { loadClasses } from '../../data/class'
import { loadBackgrounds } from '../../data/background'
import { loadRaces } from '../../data/race'
import { loadFeats } from '../../data/feats'
import { loadItems } from '../../data/items'
import { loadFightingStyleOptions } from '../../data/classOptions'
import { loadLanguages } from '../../data/languages'
import { FIGHTER, ITEMS, stack } from '../../test/derivedFixtures'
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

function seed() {
  const c = createCharacter('Tordek')
  c.classes = [
    {
      name: 'Fighter',
      source: 'PHB',
      level: 3,
      subclass: { name: 'Champion', shortName: 'Champion', source: 'PHB' },
    },
  ]
  c.race = {
    name: 'Dwarf',
    baseName: 'Dwarf',
    source: 'PHB',
    abilityFixed: {},
    abilityChoices: {},
  }
  c.abilities = {
    ...c.abilities,
    str: { base: 16, other: 0 },
    dex: { base: 14, other: 0 },
  }
  c.equipment.items = [stack('Longsword')]
  useCharacterStore.setState({
    characters: { [c.id]: c },
    order: [c.id],
    activeId: c.id,
    view: 'sheet',
  })
  return c
}

function renderSheet() {
  return render(
    <ThemeProvider>
      <SheetView />
    </ThemeProvider>,
  )
}

const original = window.matchMedia
function setPhone() {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: true,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.mocked(loadClasses).mockResolvedValue([FIGHTER])
  vi.mocked(loadBackgrounds).mockResolvedValue([])
  vi.mocked(loadRaces).mockResolvedValue([])
  vi.mocked(loadFeats).mockResolvedValue([])
  vi.mocked(loadFightingStyleOptions).mockResolvedValue([])
  vi.mocked(loadLanguages).mockResolvedValue([])
  vi.mocked(loadItems).mockResolvedValue(ITEMS)
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

afterEach(() => {
  window.matchMedia = original
})

describe('SheetView', () => {
  it('renders nothing without an open character', async () => {
    const { container } = renderSheet()
    expect(container).toBeEmptyDOMElement()
    await settle()
    expect(container).toBeEmptyDOMElement()
  })

  it('names the character and says who they are', async () => {
    seed()
    renderSheet()
    expect(screen.getByRole('heading', { name: 'Tordek', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Dwarf, Fighter 3 (Champion)')).toBeInTheDocument()
    await settle()
  })

  it('shows the abilities, with the modifier large and the score under it', async () => {
    seed()
    renderSheet()
    const strength = await screen.findByRole('group', { name: 'Strength' })
    expect(within(strength).getByText('+3')).toBeInTheDocument()
    expect(within(strength).getByText('16')).toBeInTheDocument()
    const dexterity = screen.getByRole('group', { name: 'Dexterity' })
    expect(within(dexterity).getByText('+2')).toBeInTheDocument()
  })

  it('shows the derived proficiency, initiative, armor class and hit points', async () => {
    seed()
    renderSheet()
    const prof = await screen.findByRole('group', { name: 'Proficiency' })
    expect(within(prof).getByText('+2')).toBeInTheDocument()
    expect(
      within(screen.getByRole('group', { name: 'Initiative' })).getByText('+2'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('group', { name: 'Armor class' })).getByText('12'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('group', { name: 'Hit points' })).getByText('maximum'),
    ).toBeInTheDocument()
  })

  it('lists the saves, skills, senses and proficiencies down the left', async () => {
    seed()
    renderSheet()
    expect(await screen.findByRole('list', { name: 'Saving throws' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Skills' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Senses' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Armor' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Languages' })).toBeInTheDocument()
  })

  it('holds the attacks in the Actions tab and says what is not built yet', async () => {
    const user = userEvent.setup()
    seed()
    renderSheet()
    const attacks = await screen.findByRole('table', { name: 'Attacks' })
    expect(within(attacks).getByText('Longsword')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Actions' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    // A fighter casts nothing, so there is no Spells tab.
    expect(screen.queryByRole('tab', { name: 'Spells' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Inventory' }))
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Not built yet: step 7.')
    expect(screen.queryByRole('table', { name: 'Attacks' })).not.toBeInTheDocument()
  })

  it('moves the left column into the Core and Skills tabs on a phone', async () => {
    const user = userEvent.setup()
    setPhone()
    seed()
    renderSheet()
    // The first tab on a phone is Core: saves, senses and proficiencies.
    expect(await screen.findByRole('tab', { name: 'Core' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('list', { name: 'Saving throws' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Skills' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Skills' }))
    expect(screen.getByRole('list', { name: 'Skills' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Saving throws' })).not.toBeInTheDocument()
  })

  it('switches to the editor, keeps Level up off and goes back to the list', async () => {
    const user = userEvent.setup()
    seed()
    renderSheet()
    expect(screen.getByRole('button', { name: 'Sheet' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: 'Level up' })).toBeDisabled()
    await settle()
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(useCharacterStore.getState().view).toBe('editor')
    await user.click(screen.getByRole('button', { name: 'Characters' }))
    expect(useCharacterStore.getState().view).toBe('list')
  })

  it('shows the same switch in the editor, which goes back to the sheet', async () => {
    const user = userEvent.setup()
    const c = seed()
    useCharacterStore.setState({ view: 'editor' })
    render(
      <ThemeProvider>
        <CharacterEditor />
      </ThemeProvider>,
    )
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByLabelText('Character name')).toHaveValue(c.name)
    await user.click(screen.getByRole('button', { name: 'Sheet' }))
    expect(useCharacterStore.getState().view).toBe('sheet')
    await settle()
  })

  it('tells the player when the data could not be loaded', async () => {
    vi.mocked(loadClasses).mockRejectedValue(new Error('offline'))
    seed()
    renderSheet()
    expect(await screen.findByText(/Could not load the data/)).toBeInTheDocument()
  })
})
