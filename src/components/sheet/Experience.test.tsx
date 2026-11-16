import { render, screen, waitFor } from '@testing-library/react'
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

function seed(xp?: number) {
  const c = createCharacter('Tordek')
  c.classes = [{ name: 'Fighter', source: 'PHB', level: 3 }]
  c.completedAt = Date.now()
  if (xp !== undefined) c.play = { ...c.play, xp }
  useCharacterStore.setState({
    characters: { [c.id]: c },
    order: [c.id],
    activeId: c.id,
    view: 'sheet',
  })
  return c
}

const active = (id: string) => useCharacterStore.getState().characters[id]

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

describe('experience points in play', () => {
  it('levels by milestone until tracking is turned on, and says nothing is waiting', async () => {
    const c = seed()
    renderSheet()
    const toggle = await screen.findByRole('checkbox', { name: /Track experience/ })
    expect(toggle).not.toBeChecked()
    expect(screen.queryByLabelText('Experience points to add')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Level up' })).toBeInTheDocument()
    expect(active(c.id).play.xp).toBeUndefined()
  })

  it('starts at the points of the character level, and adds points with a history entry', async () => {
    const user = userEvent.setup()
    const c = seed()
    renderSheet()
    await user.click(await screen.findByRole('checkbox', { name: /Track experience/ }))
    await waitFor(() => expect(active(c.id).play.xp).toBe(900))
    expect(screen.getByText('next level at 2,700')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Level up available' }),
    ).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Experience points to add'), '1800')
    await user.click(screen.getByRole('button', { name: 'Add XP' }))
    await waitFor(() => expect(active(c.id).play.xp).toBe(2700))
    expect(active(c.id).history.at(-1)).toMatchObject({
      action: { type: 'experience', amount: 1800 },
    })
    expect(
      await screen.findByRole('button', { name: 'Level up available' }),
    ).toBeInTheDocument()
  })

  it('turns tracking off and back to milestones', async () => {
    const user = userEvent.setup()
    const c = seed(5000)
    renderSheet()
    await user.click(await screen.findByRole('checkbox', { name: /Track experience/ }))
    await waitFor(() => expect(active(c.id).play.xp).toBeUndefined())
  })

  it('counts the total level of a multiclass character', async () => {
    const c = seed(2700)
    useCharacterStore.getState().updateActive({
      classes: [
        { name: 'Fighter', source: 'PHB', level: 2 },
        { name: 'Wizard', source: 'PHB', level: 2 },
      ],
    })
    renderSheet()
    expect(await screen.findByText('next level at 6,500')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Level up available' }),
    ).not.toBeInTheDocument()
    expect(active(c.id).play.xp).toBe(2700)
  })
})
