import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClassBrowser } from './ClassBrowser'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { useCharacterStore } from '../../character/store'
import { createCharacter } from '../../character/model'
import {
  loadClasses,
  subclassesFor,
  subclassUnlockLevel,
  type LoadedClass,
  type SubclassEntry,
} from '../../data/class'
import { settle } from '../../test/settle'

vi.mock('../../data/class', async (importActual) => ({
  ...(await importActual<typeof import('../../data/class')>()),
  loadClasses: vi.fn(),
  subclassesFor: vi.fn(),
  subclassUnlockLevel: vi.fn(),
}))
const mockClasses = vi.mocked(loadClasses)
const mockSubclasses = vi.mocked(subclassesFor)
const mockUnlock = vi.mocked(subclassUnlockLevel)

const champion: SubclassEntry = {
  name: 'Champion',
  shortName: 'Champion',
  source: 'PHB',
  className: 'Fighter',
  classSource: 'PHB',
  subclassFeatures: [],
}

const fighter: LoadedClass = {
  entry: {
    name: 'Fighter',
    source: 'PHB',
    edition: 'classic',
    hd: { number: 1, faces: 10 },
    proficiency: ['str', 'con'],
    classFeatures: [],
    subclassTitle: 'Martial Archetype',
  },
  file: {},
}

const wizard: LoadedClass = {
  entry: {
    name: 'Wizard',
    source: 'XPHB',
    edition: 'one',
    hd: { number: 1, faces: 6 },
    proficiency: ['int', 'wis'],
    classFeatures: [],
    spellcastingAbility: 'int',
    casterProgression: 'full',
    subclassTitle: 'Arcane Tradition',
  },
  file: {},
}

// A reprint / `_copy` stub as it appears in the source data: no hit die.
const reprint: LoadedClass = {
  entry: {
    name: 'Mystic',
    source: 'UAMystic',
    edition: 'classic',
    proficiency: ['int', 'wis'],
    classFeatures: [],
  },
  file: {},
}

function seedActive() {
  const c = createCharacter('Tordek')
  c.selectedBooks = ['PHB', 'XPHB']
  useCharacterStore.setState({
    characters: { [c.id]: c },
    order: [c.id],
    activeId: c.id,
    view: 'editor',
  })
  return c
}

function renderSection() {
  return render(
    <ThemeProvider>
      <ClassBrowser />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mockClasses.mockResolvedValue([fighter, wizard])
  mockSubclasses.mockReturnValue([champion])
  mockUnlock.mockReturnValue(3)
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

describe('ClassBrowser', () => {
  it('renders nothing without an active character', async () => {
    const { container } = renderSection()
    expect(container).toBeEmptyDOMElement()
    // Still nothing once the section data has loaded.
    await settle()
    expect(container).toBeEmptyDOMElement()
  })

  it('lists classes scoped to the selected books with their stats', async () => {
    seedActive()
    renderSection()

    const fighterRow = (await screen.findByText('Fighter')).closest('tr') as HTMLElement
    expect(within(fighterRow).getByText('d10')).toBeInTheDocument()
    expect(within(fighterRow).getByText('STR, CON')).toBeInTheDocument()
    expect(within(fighterRow).getByText('Non-caster')).toBeInTheDocument()
    expect(within(fighterRow).getByText('2014')).toBeInTheDocument()

    const wizardRow = screen.getByText('Wizard').closest('tr') as HTMLElement
    expect(within(wizardRow).getByText('Full caster')).toBeInTheDocument()
    expect(within(wizardRow).getByText('2024')).toBeInTheDocument()
  })

  it('lets rows be multi-selected and compared side by side', async () => {
    const user = userEvent.setup()
    seedActive()
    renderSection()
    await screen.findByText('Fighter')

    // Multi-select: per-row checkboxes, not single-select radios.
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes.length).toBeGreaterThan(0)

    // Compare stays disabled until at least two rows are selected.
    const compare = screen.getByRole('button', { name: /^Compare/ })
    expect(compare).toBeDisabled()

    await user.click(
      within(screen.getByText('Fighter').closest('tr')!).getByRole('checkbox'),
    )
    await user.click(
      within(screen.getByText('Wizard').closest('tr')!).getByRole('checkbox'),
    )

    const compareTwo = screen.getByRole('button', { name: /Compare \(2\)/ })
    expect(compareTwo).toBeEnabled()
    await user.click(compareTwo)

    // Modal renders the compared attribute grid.
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Compare classes')).toBeInTheDocument()
    expect(within(dialog).getByText('Hit Die')).toBeInTheDocument()
  })

  it('adds a class (with its subclass) to the build from a row action', async () => {
    const user = userEvent.setup()
    const c = seedActive()
    renderSection()

    const fighterRow = (await screen.findByText('Fighter')).closest('tr') as HTMLElement
    await user.click(within(fighterRow).getByRole('button', { name: 'Add' }))

    // The row's class enters the build carrying the row's subclass, and the
    // action flips to an actionable "Remove".
    await waitFor(() => {
      const built = useCharacterStore.getState().characters[c.id].classes
      expect(built).toHaveLength(1)
      expect(built[0]).toMatchObject({ name: 'Fighter', source: 'PHB', level: 1 })
      expect(built[0].subclass?.name).toBe('Champion')
    })
    const removeBtn = within(fighterRow).getByRole('button', { name: 'Remove' })
    expect(removeBtn).toBeEnabled()

    // Clicking Remove takes the class back out of the build.
    await user.click(removeBtn)
    await waitFor(() => {
      expect(useCharacterStore.getState().characters[c.id].classes).toHaveLength(0)
    })
    expect(within(fighterRow).getByRole('button', { name: 'Add' })).toBeEnabled()
  })

  it('adds a class from the detail pane action', async () => {
    const user = userEvent.setup()
    const c = seedActive()
    renderSection()

    await user.click(await screen.findByText('Wizard'))
    const detail = document.querySelector('.data-table-detail') as HTMLElement
    await user.click(within(detail).getByRole('button', { name: /to build/i }))

    await waitFor(() => {
      const built = useCharacterStore.getState().characters[c.id].classes
      expect(built.some((b) => b.name === 'Wizard')).toBe(true)
    })

    // The detail action becomes "Remove from build" and takes the class back out.
    const removeBtn = within(detail).getByRole('button', { name: 'Remove from build' })
    await user.click(removeBtn)
    await waitFor(() => {
      const built = useCharacterStore.getState().characters[c.id].classes
      expect(built.some((b) => b.name === 'Wizard')).toBe(false)
    })
  })

  it('shows rich detail with subclasses when a class is clicked', async () => {
    const user = userEvent.setup()
    seedActive()
    renderSection()

    await user.click(await screen.findByText('Wizard'))
    expect(screen.getByText('Full caster (INT)')).toBeInTheDocument()
    // The detail pane now mirrors the Compare modal's Basics wording.
    expect(screen.getByText('Level 3')).toBeInTheDocument()
    // The detail pane mirrors the Compare modal: the chosen subclass gets its own
    // "<name> features" section, so scope this to the detail pane and match that
    // heading (the subclass name also appears in the title, hence the specifier).
    const detail = document.querySelector('.data-table-detail') as HTMLElement
    expect(within(detail).getByText(/Champion features/i)).toBeInTheDocument()
  })

  it('filters classes by free-text search', async () => {
    const user = userEvent.setup()
    seedActive()
    renderSection()

    await screen.findByText('Fighter')
    await user.type(screen.getByLabelText('Search table'), 'wizard')
    await waitFor(() => expect(screen.queryByText('Fighter')).not.toBeInTheDocument())
    expect(screen.getByText('Wizard')).toBeInTheDocument()
  })

  it('warns when no classes are available from the selected books', async () => {
    const c = seedActive()
    c.selectedBooks = ['XGE']
    useCharacterStore.setState({ characters: { [c.id]: c } })
    renderSection()
    expect(await screen.findByText(/No classes are available/i)).toBeInTheDocument()
  })

  it('renders classes with no hit die without crashing', async () => {
    const c = seedActive()
    c.selectedBooks = ['UAMystic']
    useCharacterStore.setState({ characters: { [c.id]: c } })
    mockClasses.mockResolvedValue([reprint])
    renderSection()

    const row = (await screen.findByText('Mystic')).closest('tr') as HTMLElement
    expect(within(row).getByText('-')).toBeInTheDocument()
  })

  it('surfaces a loader error', async () => {
    seedActive()
    mockClasses.mockRejectedValue(new Error('boom'))
    renderSection()
    expect(await screen.findByText(/Failed to load classes: boom/i)).toBeInTheDocument()
  })
})
