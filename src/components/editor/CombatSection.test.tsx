import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CombatSection } from './CombatSection'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { useCharacterStore } from '../../character/store'
import { createCharacter } from '../../character/model'
import { loadClasses } from '../../data/class'
import { loadBackgrounds } from '../../data/background'
import { loadRaces } from '../../data/race'
import { loadFeats } from '../../data/feats'
import { loadItems } from '../../data/items'
import { loadClassOptions } from '../../data/classOptions'
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

function seed(mutate: (c: ReturnType<typeof createCharacter>) => void = () => {}) {
  const c = createCharacter('Tordek')
  c.classes = [{ name: 'Fighter', source: 'PHB', level: 1 }]
  c.abilities = {
    ...c.abilities,
    str: { base: 16, other: 0 },
    dex: { base: 14, other: 0 },
  }
  mutate(c)
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
      <CombatSection />
    </ThemeProvider>,
  )
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
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

describe('CombatSection', () => {
  it('renders nothing without an active character', async () => {
    const { container } = renderSection()
    expect(container).toBeEmptyDOMElement()
    await settle()
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the armor class line by line with its total', async () => {
    seed((c) => {
      c.equipment.items = [stack('Chain Mail'), stack('Shield')]
    })
    renderSection()
    const table = await screen.findByRole('table', { name: 'Armor class breakdown' })
    expect(await within(table).findByText('Armor')).toBeInTheDocument()
    expect(within(table).getAllByText('Shield').length).toBeGreaterThan(0)
    expect(within(table).getByText('18')).toBeInTheDocument()
  })

  it('edits the manual armor class bonus', async () => {
    const user = userEvent.setup()
    const c = seed()
    renderSection()
    const input = await screen.findByLabelText('Other AC bonus')
    await user.clear(input)
    await user.type(input, '1')
    await user.tab()
    expect(useCharacterStore.getState().characters[c.id].manualBonuses?.ac).toBe(1)
    const table = screen.getByRole('table', { name: 'Armor class breakdown' })
    expect(within(table).getByText('13')).toBeInTheDocument()
  })

  it('lists an equipped weapon and opens how its numbers add up', async () => {
    const user = userEvent.setup()
    seed((c) => {
      c.equipment.items = [stack('Longsword')]
    })
    renderSection()
    const attacks = await screen.findByRole('table', { name: 'Attacks' })
    expect(await within(attacks).findByText('Longsword')).toBeInTheDocument()
    expect(within(attacks).getByText('Unarmed strike')).toBeInTheDocument()
    // The dice and the kind of damage are columns of their own.
    const sword = within(attacks).getByText('Longsword').closest('tr') as HTMLElement
    expect(within(sword).getByText('1d8 + 3')).toBeInTheDocument()
    expect(within(sword).getByText('slashing')).toBeInTheDocument()
    const fist = within(attacks).getByText('Unarmed strike').closest('tr') as HTMLElement
    expect(within(fist).getByText('4')).toBeInTheDocument()
    expect(within(fist).getByText('bludgeoning')).toBeInTheDocument()
    expect(
      within(attacks).getByRole('columnheader', { name: 'Damage type' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show how Longsword adds up' }))
    expect(
      screen.getByRole('table', { name: 'Longsword attack bonus' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('table', { name: 'Longsword damage bonus, two hands' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Hide how Longsword adds up' }))
    expect(screen.queryByRole('table', { name: 'Longsword attack bonus' })).toBeNull()
  })

  it('shows an unarmed strike as one total and lists each line behind it', async () => {
    const user = userEvent.setup()
    seed()
    renderSection()
    await screen.findByRole('table', { name: 'Attacks' })
    await user.click(
      screen.getByRole('button', { name: 'Show how Unarmed strike adds up' }),
    )
    const table = screen.getByRole('table', { name: 'Unarmed strike damage' })
    expect(within(table).getByText('Unarmed strike')).toBeInTheDocument()
    expect(within(table).getByText('Strength')).toBeInTheDocument()
    const rows = within(table).getAllByRole('row')
    expect(rows[rows.length - 1]).toHaveTextContent('Damage4')
  })

  it('shows spell numbers for a caster and none for a fighter', async () => {
    const user = userEvent.setup()
    const wizard = {
      entry: {
        name: 'Wizard',
        source: 'PHB',
        hd: { number: 1, faces: 6 },
        classFeatures: [],
        spellcastingAbility: 'int',
        casterProgression: 'full',
        cantripProgression: [3],
      },
      file: {},
    }
    vi.mocked(loadClasses).mockResolvedValue([FIGHTER, wizard])
    seed((c) => {
      c.classes = [{ name: 'Wizard', source: 'PHB', level: 1 }]
      c.abilities = { ...c.abilities, int: { base: 16, other: 0 } }
    })
    renderSection()
    const stats = await screen.findByRole('table', {
      name: 'Spell save DC and attack bonus',
    })
    expect(within(stats).getByText('13')).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Show how Wizard spell numbers adds up' }),
    )
    expect(
      screen.getByRole('table', { name: 'Wizard spell save DC' }),
    ).toBeInTheDocument()
  })

  it('shows no spellcasting table for a character who casts nothing', async () => {
    seed()
    renderSection()
    await screen.findByRole('table', { name: 'Attacks' })
    expect(
      screen.queryByRole('table', { name: 'Spell save DC and attack bonus' }),
    ).toBeNull()
  })

  it('edits the manual initiative bonus and opens how a passive score adds up', async () => {
    const user = userEvent.setup()
    const c = seed()
    renderSection()
    const input = await screen.findByLabelText('Other initiative bonus')
    await user.clear(input)
    await user.type(input, '2')
    await user.tab()
    expect(useCharacterStore.getState().characters[c.id].manualBonuses?.initiative).toBe(
      2,
    )
    const initiative = screen.getByRole('table', { name: 'Initiative breakdown' })
    expect(within(initiative).getByText('+4')).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Show how passive Perception adds up' }),
    )
    expect(screen.getByRole('table', { name: 'Passive Perception' })).toBeInTheDocument()
  })

  it('picks a fighting style here and applies its rule', async () => {
    const user = userEvent.setup()
    const fighter = {
      ...FIGHTER,
      entry: {
        ...FIGHTER.entry,
        optionalfeatureProgression: [
          { name: 'Fighting Style', featureType: ['FS:F'], progression: { '1': 1 } },
        ],
      },
    }
    vi.mocked(loadClasses).mockResolvedValue([fighter])
    vi.mocked(loadClassOptions).mockResolvedValue([
      {
        key: 'Defense|PHB',
        name: 'Defense',
        source: 'PHB',
        types: ['FS:F'],
        entries: ['While you are wearing armor, you gain a +1 bonus to AC.'],
      },
      {
        key: 'Archery|PHB',
        name: 'Archery',
        source: 'PHB',
        types: ['FS:F'],
        entries: ['You gain a +2 bonus to attack rolls you make with ranged weapons.'],
      },
    ])
    const c = seed((ch) => {
      ch.equipment.items = [stack('Chain Mail')]
    })
    renderSection()

    expect(await screen.findByText('Class - Fighter fighting style')).toBeInTheDocument()
    // The styles are rows with their rules text, so they can be told apart before picking.
    expect(
      screen.getByText(/\+2 bonus to attack rolls you make with ranged/),
    ).toBeInTheDocument()
    const row = screen.getByText('Defense').closest('tr')
    expect(row).not.toBeNull()
    await user.click(within(row as HTMLElement).getByRole('button', { name: 'Choose' }))
    expect(useCharacterStore.getState().characters[c.id].classOptions).toEqual({
      'class:Fighter|PHB|FS:F': ['Defense|PHB'],
    })
    const table = screen.getByRole('table', { name: 'Armor class breakdown' })
    expect(within(table).getByText('17')).toBeInTheDocument()
    expect(screen.getByText('1 of 1 done')).toBeInTheDocument()
  })

  it('offers no option card that is not a fighting style', async () => {
    const warlock = {
      ...FIGHTER,
      entry: {
        ...FIGHTER.entry,
        name: 'Warlock',
        optionalfeatureProgression: [
          { name: 'Eldritch Invocations', featureType: ['EI'], progression: [2] },
        ],
      },
    }
    vi.mocked(loadClasses).mockResolvedValue([warlock])
    vi.mocked(loadClassOptions).mockResolvedValue([
      {
        key: "Devil's Sight|PHB",
        name: "Devil's Sight",
        source: 'PHB',
        types: ['EI'],
        entries: ['You can see normally in darkness.'],
      },
    ])
    seed((ch) => {
      ch.classes = [{ name: 'Warlock', source: 'PHB', level: 1 }]
    })
    renderSection()
    expect(
      await screen.findByRole('table', { name: 'Armor class breakdown' }),
    ).toBeInTheDocument()
    // Invocations and every other option are picked in Class Features.
    expect(screen.queryByText("Devil's Sight")).toBeNull()
  })
})
