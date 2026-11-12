import { render, screen, waitFor, within } from '@testing-library/react'
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

/** A window whose width matches only the queries that `matching` accepts. */
function setWidth(matching: (query: string) => boolean) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: matching(query),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
const setWide = () => setWidth((q) => q.includes('min-width: 1200px'))

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
    expect(
      screen.getByText('Dwarf, Fighter 3 (Champion) - 2014 rules'),
    ).toBeInTheDocument()
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

  it('holds the attacks in the Actions tab and the items in the Inventory tab', async () => {
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
    expect(await screen.findByRole('table', { name: 'Items' })).toBeInTheDocument()
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

  it('wears the app look by default and switches to parchment, remembering it', async () => {
    const user = userEvent.setup()
    seed()
    const { container, unmount } = renderSheet()
    const root = () => container.querySelector('.sheet-root') as HTMLElement
    expect(root()).toHaveAttribute('data-sheet-template', 'app')
    expect(root().style.getPropertyValue('--sheet-panel-bg')).toBe('#ffffff')
    await user.click(screen.getByRole('button', { name: 'Look: App' }))
    await user.click(screen.getByRole('button', { name: /Parchment/ }))
    expect(root()).toHaveAttribute('data-sheet-template', 'parchment')
    expect(root().style.getPropertyValue('--sheet-panel-bg')).toBe('#f4ecd8')
    expect(screen.getByRole('button', { name: 'Look: Parchment' })).toBeInTheDocument()
    await settle()
    unmount()
    // A fresh visit to the sheet opens in the remembered look.
    const again = renderSheet()
    expect(again.container.querySelector('.sheet-root')).toHaveAttribute(
      'data-sheet-template',
      'parchment',
    )
    await settle()
  })

  it('takes the dark tokens when the theme is dark', async () => {
    localStorage.setItem('cc-theme', 'dark')
    seed()
    const { container } = renderSheet()
    expect(
      (container.querySelector('.sheet-root') as HTMLElement).style.getPropertyValue(
        '--sheet-panel-bg',
      ),
    ).toBe('#212529')
    await settle()
  })

  it('opens in the app look when the remembered look is unknown', async () => {
    localStorage.setItem('cc-sheet-template', 'scroll')
    seed()
    const { container } = renderSheet()
    expect(container.querySelector('.sheet-root')).toHaveAttribute(
      'data-sheet-template',
      'app',
    )
    await settle()
  })

  it('forgets the remembered look when the app look is chosen again', async () => {
    const user = userEvent.setup()
    localStorage.setItem('cc-sheet-template', 'parchment')
    seed()
    renderSheet()
    await user.click(screen.getByRole('button', { name: 'Look: Parchment' }))
    await user.click(screen.getByRole('button', { name: /^App/ }))
    expect(localStorage.getItem('cc-sheet-template')).toBeNull()
    await settle()
  })

  it('tells the player when the data could not be loaded', async () => {
    vi.mocked(loadClasses).mockRejectedValue(new Error('offline'))
    seed()
    renderSheet()
    expect(await screen.findByText(/Could not load the data/)).toBeInTheDocument()
  })
})

describe('SheetView speed, senses and rules', () => {
  it('shows the speed and darkvision of the species, each with how it adds up', async () => {
    const user = userEvent.setup()
    setWide()
    seed()
    vi.mocked(loadRaces).mockResolvedValue([
      {
        key: 'dwarf|phb',
        name: 'Dwarf',
        baseName: 'Dwarf',
        source: 'PHB',
        speed: 25,
        darkvision: 60,
        abilityOptions: [],
        featGrants: [],
      },
    ])
    renderSheet()
    const speed = await screen.findByRole('group', { name: 'Speed' })
    await waitFor(() => expect(within(speed).getByText('25')).toBeInTheDocument())
    await user.click(within(speed).getByRole('button', { name: 'How Speed adds up' }))
    const pane = document.querySelector('.data-table-detail') as HTMLElement
    expect(within(pane).getAllByText('Walking speed')).toHaveLength(2)
    const senses = screen.getByRole('list', { name: 'Senses' })
    expect(within(senses).getByText('Darkvision')).toBeInTheDocument()
    expect(
      within(senses).getByRole('button', { name: 'Darkvision: 60 ft.' }),
    ).toBeInTheDocument()
    await settle()
  })
})

describe('SheetView breakdowns', () => {
  it('opens how armor class adds up over the sheet on a narrow screen, and Back closes it', async () => {
    const user = userEvent.setup()
    seed()
    renderSheet()
    const box = await screen.findByRole('group', { name: 'Armor class' })
    const open = within(box).getByRole('button', { name: 'How Armor class adds up' })
    expect(open).toHaveAttribute('aria-pressed', 'false')
    await user.click(open)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Armor class 12')).toBeInTheDocument()
    const table = within(dialog).getByRole('table', { name: 'Armor class' })
    expect(within(table).getByText('Armor class', { selector: 'td' })).toBeInTheDocument()
    expect(open).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(dialog).getByRole('button', { name: 'Back' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(open).toHaveFocus()
    expect(open).toHaveAttribute('aria-pressed', 'false')
    await settle()
  })

  it('opens it in the pane beside the table on a wide screen and closes it three ways', async () => {
    const user = userEvent.setup()
    setWide()
    seed()
    renderSheet()
    const open = await screen.findByRole('button', { name: 'How Armor class adds up' })
    await user.click(open)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const pane = document.querySelector('.data-table-detail') as HTMLElement
    expect(within(pane).getByText('Armor class 12')).toBeInTheDocument()
    expect(within(pane).getByRole('table', { name: 'Armor class' })).toBeInTheDocument()
    // The same click closes it.
    await user.click(open)
    expect(document.querySelector('.data-table-detail')).toBeNull()
    // Escape closes it from the opener, and the close control from the pane.
    await user.click(open)
    await user.keyboard('{Escape}')
    expect(document.querySelector('.data-table-detail')).toBeNull()
    expect(open).toHaveFocus()
    await user.click(open)
    await user.click(screen.getByRole('button', { name: 'Close details' }))
    expect(document.querySelector('.data-table-detail')).toBeNull()
    await settle()
  })

  it('opens how an ability score, a saving throw and a skill add up', async () => {
    const user = userEvent.setup()
    setWide()
    seed()
    renderSheet()
    await user.click(await screen.findByRole('button', { name: 'How Strength adds up' }))
    const pane = () => document.querySelector('.data-table-detail') as HTMLElement
    expect(within(pane()).getByRole('table', { name: 'Strength' })).toBeInTheDocument()
    expect(within(pane()).getByText('Base score')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'How Strength save adds up' }))
    expect(
      within(pane()).getByRole('table', { name: 'Strength save' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'How Athletics adds up' }))
    expect(within(pane()).getByRole('table', { name: 'Athletics' })).toBeInTheDocument()
    expect(within(pane()).getByText('Ability modifier')).toBeInTheDocument()
    await settle()
  })

  it('moves the open breakdown from one number to the next', async () => {
    const user = userEvent.setup()
    setWide()
    seed()
    renderSheet()
    await user.click(
      await screen.findByRole('button', { name: 'How Armor class adds up' }),
    )
    await user.click(screen.getByRole('button', { name: 'How Initiative adds up' }))
    const pane = document.querySelector('.data-table-detail') as HTMLElement
    expect(within(pane).getByText('Initiative +2')).toBeInTheDocument()
    expect(within(pane).queryByText('Armor class 12')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'How Armor class adds up' }),
    ).toHaveAttribute('aria-pressed', 'false')
    await settle()
  })

  it('opens the proficiency bonus, hit points and a passive score', async () => {
    const user = userEvent.setup()
    setWide()
    seed()
    renderSheet()
    await user.click(
      await screen.findByRole('button', { name: 'How Proficiency bonus adds up' }),
    )
    const pane = () => document.querySelector('.data-table-detail') as HTMLElement
    expect(within(pane()).getByText('Proficiency bonus +2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'How Hit points adds up' }))
    expect(within(pane()).getByRole('table', { name: 'Hit points' })).toBeInTheDocument()
    expect(within(pane()).getByText('Maximum hit points')).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'How Passive Perception adds up' }),
    )
    expect(
      within(pane()).getByRole('heading', { name: 'Passive Perception 5' }),
    ).toBeInTheDocument()
    await settle()
  })

  it('opens an attack bonus and its damage, with the two-handed damage under it', async () => {
    const user = userEvent.setup()
    setWide()
    seed()
    renderSheet()
    const attacks = await screen.findByRole('table', { name: 'Attacks' })
    expect(within(attacks).queryByRole('button', { name: /^(Show|Hide) how/ })).toBeNull()
    await user.click(
      await within(attacks).findByRole('button', {
        name: 'How Longsword attack bonus adds up',
      }),
    )
    const pane = () => document.querySelector('.data-table-detail') as HTMLElement
    expect(within(pane()).getByText('Longsword attack bonus +5')).toBeInTheDocument()
    await user.click(
      within(attacks).getByRole('button', { name: 'How Longsword damage adds up' }),
    )
    expect(
      within(pane()).getByRole('table', { name: 'Longsword damage' }),
    ).toBeInTheDocument()
    expect(
      within(pane()).getByRole('table', { name: 'Longsword damage, two hands' }),
    ).toBeInTheDocument()
    await settle()
  })

  it('draws the pane as a book entry when the detail style is Book', async () => {
    const user = userEvent.setup()
    localStorage.setItem('cc-detail-style', 'book')
    setWide()
    seed()
    renderSheet()
    await user.click(
      await screen.findByRole('button', { name: 'How Armor class adds up' }),
    )
    const pane = document.querySelector('.data-table-detail') as HTMLElement
    expect(pane.querySelector('.entry-book__title')).toHaveTextContent('Armor class 12')
    await settle()
  })

  it('names every info button and shows its words as a tooltip', async () => {
    const user = userEvent.setup()
    seed()
    renderSheet()
    const open = await screen.findByRole('button', { name: 'How Initiative adds up' })
    await user.hover(open)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('How Initiative adds up')
    await settle()
  })
})
