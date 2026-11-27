import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SheetView } from './SheetView'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { useCharacterStore } from '../../character/store'
import { createCharacter } from '../../character/model'
import { loadClasses } from '../../data/class'
import { loadBackgrounds } from '../../data/background'
import { loadRaces } from '../../data/race'
import { loadFeats } from '../../data/feats'
import { loadItems } from '../../data/items'
import { loadSpells } from '../../data/spells'
import { loadBeasts } from '../../data/beasts'
import { loadClassOptions } from '../../data/classOptions'
import { loadLanguages } from '../../data/languages'
import { FIGHTER, ITEMS } from '../../test/derivedFixtures'

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

function seed() {
  const c = createCharacter('Tordek')
  c.classes = [{ name: 'Fighter', source: 'PHB', level: 3 }]
  c.completedAt = Date.now()
  useCharacterStore.setState({
    characters: { [c.id]: c },
    order: [c.id],
    activeId: c.id,
    view: 'sheet',
    editorTarget: null,
  })
  return c
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.mocked(loadClasses).mockResolvedValue([FIGHTER])
  vi.mocked(loadBackgrounds).mockResolvedValue([])
  vi.mocked(loadRaces).mockResolvedValue([])
  vi.mocked(loadFeats).mockResolvedValue([])
  vi.mocked(loadClassOptions).mockResolvedValue([])
  vi.mocked(loadLanguages).mockResolvedValue([])
  vi.mocked(loadItems).mockResolvedValue(ITEMS)
  vi.mocked(loadSpells).mockResolvedValue([])
  vi.mocked(loadBeasts).mockResolvedValue([])
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

function renderSheet() {
  return render(
    <ThemeProvider>
      <SheetView />
    </ThemeProvider>,
  )
}

async function openNotes(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('tab', { name: 'Notes' }))
  return within(screen.getByRole('tabpanel'))
}

describe('the rules exceptions on the Notes tab', () => {
  it('says the build follows the standard rules when nothing departs from them', async () => {
    const user = userEvent.setup({ delay: null })
    seed()
    renderSheet()
    const panel = await openNotes(user)
    expect(panel.getByRole('heading', { name: 'Rules exceptions' })).toBeInTheDocument()
    expect(panel.getByText('This build follows the standard rules.')).toBeInTheDocument()
  })

  it('lists an exception with its rule, and opens Edit at the section that sets it', async () => {
    const user = userEvent.setup({ delay: null })
    const c = seed()
    useCharacterStore.getState().updateActive({
      classes: [{ name: 'Fighter', source: 'PHB', level: 21 }],
    })
    renderSheet()
    const panel = await openNotes(user)
    expect(panel.getByText('Level cap.')).toBeInTheDocument()
    await user.click(panel.getByRole('button', { name: 'Open in Edit: Class & Level' }))
    const state = useCharacterStore.getState()
    expect(state.view).toBe('editor')
    expect(state.editorTarget).toEqual({ id: c.id, section: 'class' })
  })
})
