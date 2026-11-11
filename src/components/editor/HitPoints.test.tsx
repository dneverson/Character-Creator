import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HitPoints } from './HitPoints'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { useCharacterStore } from '../../character/store'
import { BONUS_SLOT_PREFIX, createCharacter } from '../../character/model'
import { loadClasses, type LoadedClass } from '../../data/class'
import { loadBackgrounds } from '../../data/background'
import { loadRaces } from '../../data/race'
import { loadFeats } from '../../data/feats'
import { makeFeat } from '../../test/featFixtures'
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
const sorcererClass: LoadedClass = {
  entry: {
    name: 'Sorcerer',
    source: 'PHB',
    hd: { number: 1, faces: 6 },
    classFeatures: [],
  },
  file: {},
}
const mockClasses = vi.mocked(loadClasses)
const mockFeats = vi.mocked(loadFeats)

const fighter: LoadedClass = {
  entry: {
    name: 'Fighter',
    source: 'PHB',
    hd: { number: 1, faces: 10 },
    classFeatures: [],
  },
  file: {},
}

function seedActive(mutate: (c: ReturnType<typeof createCharacter>) => void = () => {}) {
  const c = createCharacter('Tordek')
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
      <HitPoints />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mockClasses.mockResolvedValue([fighter])
  vi.mocked(loadBackgrounds).mockResolvedValue([])
  vi.mocked(loadRaces).mockResolvedValue([])
  mockFeats.mockResolvedValue([])
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

describe('HitPoints', () => {
  it('renders nothing when there is no active character', async () => {
    const { container } = renderSection()
    expect(container).toBeEmptyDOMElement()
    // Still nothing once the section data has loaded.
    await settle()
    expect(container).toBeEmptyDOMElement()
  })

  it('warns when the character has no class levels', async () => {
    seedActive()
    renderSection()
    expect(
      await screen.findByText(/Add a class with at least one level/i),
    ).toBeInTheDocument()
  })

  it('shows average HP, rolls hit dice, and edits per-level and flat bonuses', async () => {
    const user = userEvent.setup()
    const c = seedActive((ch) => {
      ch.classes = [{ name: 'Fighter', source: 'PHB', level: 3 }]
    })
    renderSection()

    // Level 1 = 10 (max d10) + levels 2-3 average d10 (6 each) = 22 average dice.
    expect(await screen.findByText('Hit dice, level 1')).toBeInTheDocument()
    expect(screen.getByText('Fighter d10, maximum')).toBeInTheDocument()
    expect(screen.getByText('Hit dice, levels 2-3')).toBeInTheDocument()
    expect(screen.getByText('Fighter d10, average 6 x 2')).toBeInTheDocument()
    expect(screen.getByText(/Hit Dice: 3d10/)).toBeInTheDocument()

    // Rolling records a die per level and switches the method to rolled.
    await user.click(screen.getByRole('button', { name: /Roll HP/i }))
    await waitFor(() => {
      const hp = useCharacterStore.getState().characters[c.id].hp
      expect(hp.method).toBe('rolled')
      expect(hp.rolls).toHaveLength(3)
    })

    // The numeric bonus fields patch HP state.
    const perLevel = screen.getByLabelText('Other HP bonus per level')
    await user.clear(perLevel)
    await user.type(perLevel, '2')
    await user.tab()
    await waitFor(() =>
      expect(useCharacterStore.getState().characters[c.id].hp.perLevelBonus).toBe(2),
    )

    const flat = screen.getByLabelText('Flat HP bonus')
    await user.clear(flat)
    await user.type(flat, '5')
    await user.tab()
    await waitFor(() =>
      expect(useCharacterStore.getState().characters[c.id].hp.flatBonus).toBe(5),
    )
  })

  it('switches between average and rolled HP and restores a past hit-die roll', async () => {
    const user = userEvent.setup()
    const c = seedActive((ch) => {
      ch.classes = [{ name: 'Fighter', source: 'PHB', level: 3 }]
    })
    renderSection()
    const hpOf = () => useCharacterStore.getState().characters[c.id].hp

    await user.click(await screen.findByRole('button', { name: /Roll HP/i }))
    await waitFor(() => expect(hpOf().rolls).toHaveLength(3))
    const firstRolls = [...hpOf().rolls]
    await user.click(screen.getByRole('button', { name: 'Reroll' }))

    // The HP cards select the method.
    await user.click(screen.getByRole('button', { name: /Average HP/ }))
    expect(hpOf().method).toBe('average')
    await user.click(screen.getByRole('button', { name: /Rolled HP/ }))
    expect(hpOf().method).toBe('rolled')

    // Stepping back through the history restores the first roll as the rolled method.
    await user.click(screen.getByRole('button', { name: /Average HP/ }))
    await user.click(screen.getByRole('button', { name: 'Previous roll' }))
    expect(hpOf().rolls).toEqual(firstRolls)
    expect(hpOf().method).toBe('rolled')
  })

  it('notes the Hill Dwarf per-level bonus in the breakdown', async () => {
    seedActive((ch) => {
      ch.classes = [{ name: 'Fighter', source: 'PHB', level: 3 }]
      ch.race = {
        name: 'Dwarf (Hill)',
        baseName: 'Dwarf',
        subraceName: 'Hill',
        source: 'PHB',
        abilityFixed: {},
        abilityChoices: {},
      }
    })
    renderSection()
    const row = (await screen.findByText(/Dwarven Toughness/)).closest('tr')
    expect(row).toHaveTextContent('Race')
    expect(row).toHaveTextContent('Automatic')
    expect(row).toHaveTextContent('+1 per level x 3')
    expect(row).toHaveTextContent('+3')
  })

  it('applies HP from chosen feats: Tough per level and Boon of Fortitude flat', async () => {
    mockFeats.mockResolvedValue([
      makeFeat({ name: 'Tough', hp: { perLevel: 2, flat: 0 } }),
      makeFeat({
        name: 'Boon of Fortitude',
        category: 'EB',
        hp: { perLevel: 0, flat: 40 },
      }),
    ])
    seedActive((ch) => {
      ch.classes = [{ name: 'Fighter', source: 'PHB', level: 3 }]
      ch.abilities = { ...ch.abilities, con: { base: 10, other: 0 } }
      const tough = `${BONUS_SLOT_PREFIX}t`
      const boon = `${BONUS_SLOT_PREFIX}b`
      ch.feats = {
        bonusSlots: [tough, boon],
        choices: {
          [tough]: { kind: 'feat', feat: { name: 'Tough', source: 'XPHB' } },
          [boon]: { kind: 'feat', feat: { name: 'Boon of Fortitude', source: 'XPHB' } },
        },
      }
    })
    renderSection()
    const toughRow = (await screen.findByText(/^Tough/)).closest('tr')
    expect(toughRow).toHaveTextContent('Feat')
    expect(toughRow).toHaveTextContent('+2 per level x 3')
    expect(toughRow).toHaveTextContent('+6')
    const boonRow = screen.getByText(/^Boon of Fortitude/).closest('tr')
    expect(boonRow).toHaveTextContent('Flat')
    expect(boonRow).toHaveTextContent('+40')
    // 22 dice + 0 CON (score 10) + 6 Tough + 40 Boon.
    expect(screen.getByRole('button', { name: /Average HP 68/ })).toBeInTheDocument()
  })

  it('lists a class-level source by its own class level and takes a negative manual line', async () => {
    const user = userEvent.setup()
    mockClasses.mockResolvedValue([fighter, sorcererClass])
    const c = seedActive((ch) => {
      ch.classes = [
        { name: 'Fighter', source: 'PHB', level: 3 },
        {
          name: 'Sorcerer',
          source: 'PHB',
          level: 2,
          subclass: { name: 'Draconic Bloodline', shortName: 'Draconic', source: 'PHB' },
        },
      ]
      ch.abilities = { ...ch.abilities, con: { base: 10, other: 0 } }
    })
    renderSection()
    const row = (await screen.findByText(/Draconic Resilience/)).closest('tr')
    expect(row).toHaveTextContent('Sorcerer, Draconic Bloodline')
    expect(row).toHaveTextContent('+1 per class level x 2')
    expect(screen.getByText('Hit dice, levels 4-5')).toBeInTheDocument()
    // 10 + 6 + 6 (fighter) + 4 + 4 (sorcerer) + 2 Draconic = 32.
    expect(screen.getByRole('button', { name: /Average HP 32/ })).toBeInTheDocument()

    const flat = screen.getByLabelText('Flat HP bonus')
    await user.clear(flat)
    await user.type(flat, '-4')
    await user.tab()
    await waitFor(() =>
      expect(useCharacterStore.getState().characters[c.id].hp.flatBonus).toBe(-4),
    )
    expect(screen.getByRole('button', { name: /Average HP 28/ })).toBeInTheDocument()
  })

  it('shows rolled dice in the table when the rolled method is in use', async () => {
    seedActive((ch) => {
      ch.classes = [{ name: 'Fighter', source: 'PHB', level: 3 }]
      ch.abilities = { ...ch.abilities, con: { base: 10, other: 0 } }
      ch.hp = { ...ch.hp, method: 'rolled', rolls: [10, 3, 4] }
    })
    renderSection()
    expect(await screen.findByText('Fighter d10, rolled')).toBeInTheDocument()
    expect(
      screen.getByText(/Maximum hit points \(rolled\)/).closest('tr'),
    ).toHaveTextContent('17')
  })

  it('surfaces a loader error', async () => {
    seedActive((ch) => {
      ch.classes = [{ name: 'Fighter', source: 'PHB', level: 1 }]
    })
    mockClasses.mockRejectedValue(new Error('boom'))
    renderSection()
    expect(
      await screen.findByText(/Failed to load hit point data: boom/i),
    ).toBeInTheDocument()
  })
})
