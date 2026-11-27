// The render counter must load before react-dom: it listens where React DevTools does.
import { renderCount, resetRenderCounts } from '../../test/renderCounts'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
import { loadConditions } from '../../data/conditions'
import { loadClassOptions } from '../../data/classOptions'
import { loadLanguages } from '../../data/languages'
import { ITEMS, loadedClass, stack } from '../../test/derivedFixtures'

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

const fighter: LoadedClass = loadedClass('Fighter', [], [], {
  classFeature: [
    {
      name: 'Second Wind',
      source: 'PHB',
      className: 'Fighter',
      classSource: 'PHB',
      level: 1,
      entries: ['You have a limited well of stamina.'],
    },
  ],
})
fighter.entry.classFeatures = ['Second Wind|Fighter|PHB|1']

const WIND = 'use:classFeature|Second Wind|PHB|Fighter#Second Wind'

function seed() {
  const c = createCharacter('Tordek')
  c.classes = [{ name: 'Fighter', source: 'PHB', level: 3 }]
  c.equipment.items = [stack('Longsword')]
  useCharacterStore.setState({
    characters: { [c.id]: c },
    order: [c.id],
    activeId: c.id,
    view: 'sheet',
  })
}

const active = () => {
  const { activeId, characters } = useCharacterStore.getState()
  return characters[activeId ?? '']
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.mocked(loadClasses).mockResolvedValue([fighter])
  vi.mocked(loadBackgrounds).mockResolvedValue([])
  vi.mocked(loadRaces).mockResolvedValue([])
  vi.mocked(loadFeats).mockResolvedValue([])
  vi.mocked(loadClassOptions).mockResolvedValue([])
  vi.mocked(loadLanguages).mockResolvedValue([])
  vi.mocked(loadItems).mockResolvedValue(ITEMS)
  vi.mocked(loadSpells).mockResolvedValue([])
  vi.mocked(loadBeasts).mockResolvedValue([])
  vi.mocked(loadConditions).mockResolvedValue([])
})

describe('what a play update draws again', () => {
  it('spending a use draws its counter again, not the panels that do not show it', async () => {
    const user = userEvent.setup({ delay: null })
    seed()
    render(
      <ThemeProvider>
        <SheetView />
      </ThemeProvider>,
    )
    await user.click(await screen.findByRole('tab', { name: 'Actions' }))
    const uses = await screen.findByRole('table', { name: 'Limited uses' })
    resetRenderCounts()
    await user.click(
      within(uses).getByRole('button', { name: 'Second Wind use 1 of 1, available' }),
    )
    expect(active().play.uses[WIND]).toBe(1)

    // What shows the play state follows it...
    expect(renderCount('SheetUses')).toBeGreaterThan(0)
    expect(renderCount('UseCounter')).toBeGreaterThan(0)
    // ...and what is drawn from the build alone stays as it was.
    for (const name of [
      'SheetBody',
      'StatBox',
      'SavesPanel',
      'SkillsPanel',
      'SensesPanel',
      'ProficienciesPanel',
      'SheetTabs',
      'ActionsPanel',
      'SheetAttacks',
    ]) {
      expect(renderCount(name), name).toBe(0)
    }
  })

  it('a change to the build draws the panels again', async () => {
    const user = userEvent.setup({ delay: null })
    seed()
    render(
      <ThemeProvider>
        <SheetView />
      </ThemeProvider>,
    )
    await user.click(await screen.findByRole('tab', { name: 'Actions' }))
    await screen.findByRole('table', { name: 'Limited uses' })
    resetRenderCounts()
    const { updateActive } = useCharacterStore.getState()
    updateActive({ classes: [{ name: 'Fighter', source: 'PHB', level: 4 }] })
    expect(await screen.findByText(/Fighter 4/)).toBeInTheDocument()
    expect(renderCount('SavesPanel')).toBeGreaterThan(0)
    expect(renderCount('SheetAttacks')).toBeGreaterThan(0)
  })
})
