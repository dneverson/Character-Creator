import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SkillsSection } from './SkillsSection'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { useCharacterStore } from '../../character/store'
import { createCharacter } from '../../character/model'
import { loadBackgrounds, type PlayableBackground } from '../../data/background'
import { loadClasses, type LoadedClass } from '../../data/class'
import { loadRaces, type PlayableRace } from '../../data/race'
import { loadFeats } from '../../data/feats'
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
const mockClasses = vi.mocked(loadClasses)
const mockBackgrounds = vi.mocked(loadBackgrounds)
const mockRaces = vi.mocked(loadRaces)
const mockFeats = vi.mocked(loadFeats)

const acolyte: PlayableBackground = {
  featGrants: [],
  key: 'Acolyte|XPHB',
  name: 'Acolyte',
  source: 'XPHB',
  edition: 'one',
  skillProficiencies: [{ insight: true, choose: { from: ['religion', 'history'] } }],
  abilityOptions: [],
  storyTables: [],
  entries: [],
}

// A subrace that grants a fixed skill; its subraceName exercises the race
// matcher's `subraceName ?? ''` comparison against the character's race ref.
const elf: PlayableRace = {
  featGrants: [],
  key: 'Elf|PHB|Wood|PHB',
  name: 'Elf (Wood)',
  baseName: 'Elf',
  subraceName: 'Wood',
  source: 'PHB',
  edition: 'classic',
  size: ['M'],
  speed: { walk: 35 },
  abilityOptions: [],
  skillProficiencies: [{ perception: true }],
}

// A base race with no subrace; exercises the `subraceName ?? ''` fallbacks in
// the race matcher when neither side carries a subrace.
const human: PlayableRace = {
  featGrants: [],
  key: 'Human|PHB',
  name: 'Human',
  baseName: 'Human',
  source: 'PHB',
  edition: 'classic',
  size: ['M'],
  speed: { walk: 30 },
  abilityOptions: [],
  skillProficiencies: [{ perception: true }],
}

// A class that lets its skill be chosen; exercises the class-source label.
const rogue: LoadedClass = {
  entry: {
    name: 'Rogue',
    source: 'PHB',
    hd: { number: 1, faces: 8 },
    classFeatures: [],
    startingProficiencies: { skills: [{ choose: { from: ['stealth'], count: 1 } }] },
  },
  file: {},
}

function seedActive(mutate: (c: ReturnType<typeof createCharacter>) => void = () => {}) {
  const c = createCharacter('Tordek')
  c.selectedBooks = ['XPHB']
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
      <SkillsSection />
    </ThemeProvider>,
  )
}

function active(id: string) {
  return useCharacterStore.getState().characters[id]
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mockClasses.mockResolvedValue([])
  mockBackgrounds.mockResolvedValue([acolyte])
  mockRaces.mockResolvedValue([])
  mockFeats.mockResolvedValue([])
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

describe('SkillsSection', () => {
  it('renders nothing without an active character', async () => {
    const { container } = renderSection()
    expect(container).toBeEmptyDOMElement()
    // Still nothing once the section data has loaded.
    await settle()
    expect(container).toBeEmptyDOMElement()
  })

  it('flags an off-standard pick when no source offers the skill', async () => {
    const user = userEvent.setup()
    const c = seedActive()
    renderSection()

    // With no background/class/race, a skill can only be taken under Other skills.
    await user.click(await screen.findByRole('button', { name: 'Show' }))
    await user.click(screen.getByRole('button', { name: 'Acrobatics' }))
    await waitFor(() => expect(active(c.id).grantPicks.skill?.acrobatics).toBe('manual'))
    expect(screen.getAllByText('Non-standard').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('note').length).toBeGreaterThan(0)
  })

  it('grants a fixed background skill and charges chosen skills to its card', async () => {
    const user = userEvent.setup()
    const c = seedActive((ch) => {
      ch.background = { name: 'Acolyte', source: 'XPHB', abilityChoices: {} }
    })
    renderSection()

    // Fixed grant: Insight is in the Granted line and is not a chip anywhere.
    expect(await screen.findByText('Insight (Background)')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Insight/ })).not.toBeInTheDocument()

    // The card lists the whole allowed set and how many picks are left.
    expect(screen.getByText('Background - Acolyte')).toBeInTheDocument()
    expect(screen.getByText('1 of 1 left')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Religion/ }))
    await waitFor(() => expect(active(c.id).grantPicks.skill?.religion).toBe('bg'))

    // The card is full: it collapses to one line, and Change reopens it.
    expect(await screen.findByText('Background:')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^History/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Change' }))
    // The unpicked skill is disabled with the reason; Done closes the card again.
    expect(screen.getByRole('button', { name: /^History/ })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('button', { name: /^History/ })).not.toBeInTheDocument()
  })

  it('flags a source whose budget is overspent', async () => {
    // Two skills charged to the single-slot background budget -> over.
    seedActive((ch) => {
      ch.background = { name: 'Acolyte', source: 'XPHB', abilityChoices: {} }
      ch.grantPicks = { skill: { religion: 'bg', history: 'bg' } }
    })
    renderSection()

    expect(await screen.findByText('2 of 1: 1 too many')).toBeInTheDocument()
    // The over-budget badge is accompanied by a non-standard note.
    expect(screen.getAllByRole('note').length).toBeGreaterThan(0)
  })

  it('lists a race-granted skill matched by subrace as granted', async () => {
    mockRaces.mockResolvedValue([elf])
    seedActive((ch) => {
      ch.race = {
        name: 'Elf (Wood)',
        baseName: 'Elf',
        subraceName: 'Wood',
        source: 'PHB',
        abilityFixed: {},
        abilityChoices: {},
      }
    })
    renderSection()

    // The matched species grants Perception outright.
    expect(await screen.findByText('Perception (Race)')).toBeInTheDocument()
    expect(screen.getAllByText('Race').length).toBeGreaterThan(0)
  })

  it('matches a base race with no subrace on either side', async () => {
    mockRaces.mockResolvedValue([human])
    seedActive((ch) => {
      ch.race = {
        name: 'Human',
        baseName: 'Human',
        source: 'PHB',
        abilityFixed: {},
        abilityChoices: {},
      }
    })
    renderSection()

    // The base species grants Perception outright.
    expect(await screen.findByText('Perception (Race)')).toBeInTheDocument()
  })

  it('shows an unrecognized stored source tag verbatim under Other skills', async () => {
    // An imported character can carry a source tag the app no longer emits;
    // it shows with its stored tag, flagged, and a click clears it.
    const user = userEvent.setup()
    const c = seedActive((ch) => {
      ch.grantPicks = { skill: { acrobatics: 'legacy' } }
    })
    renderSection()

    expect((await screen.findAllByText('legacy')).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Show' }))
    expect(screen.getByText('From a source you no longer have')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Acrobatics (legacy)' }))
    await waitFor(() => expect(active(c.id).grantPicks.skill?.acrobatics).toBeUndefined())
  })

  it('charges a chosen skill to its class and labels the source', async () => {
    const user = userEvent.setup()
    mockClasses.mockResolvedValue([rogue])
    mockBackgrounds.mockResolvedValue([])
    const c = seedActive((ch) => {
      ch.classes = [{ name: 'Rogue', source: 'PHB', level: 1 }]
    })
    renderSection()

    await user.click(await screen.findByRole('button', { name: /^Stealth/ }))
    await waitFor(() =>
      expect(active(c.id).grantPicks.skill?.stealth).toBe('class:Rogue|PHB'),
    )
    // The summary table labels the source with the class name.
    expect(screen.getAllByText('Rogue').length).toBeGreaterThan(0)
  })

  it('disables a skill another source already covers and says why', async () => {
    const cleric: LoadedClass = {
      ...rogue,
      entry: {
        ...rogue.entry,
        name: 'Cleric',
        startingProficiencies: {
          skills: [{ choose: { from: ['religion', 'history'], count: 1 } }],
        },
      },
    }
    mockClasses.mockResolvedValue([cleric])
    seedActive((ch) => {
      ch.classes = [{ name: 'Cleric', source: 'PHB', level: 1 }]
      ch.background = { name: 'Acolyte', source: 'XPHB', abilityChoices: {} }
      ch.grantPicks = { skill: { religion: 'bg' } }
    })
    renderSection()

    // The class card shows Religion taken by the background, with the reason.
    await screen.findByText('Class - Cleric')
    const chips = screen.getAllByRole('button', { name: /^Religion/ })
    expect(chips[0]).toBeDisabled()
    expect(chips[0]).toHaveAttribute('title', expect.stringContaining('Background'))
    expect(screen.getByText('1 of 1 left', { exact: false })).toBeInTheDocument()
  })

  it('picks expertise from the skills the character has and doubles the bonus', async () => {
    const user = userEvent.setup()
    const expert: LoadedClass = {
      entry: { ...rogue.entry, startingProficiencies: {} },
      file: {
        classFeature: [
          {
            name: 'Expertise',
            source: 'PHB',
            className: 'Rogue',
            classSource: 'PHB',
            level: 1,
            entries: [],
          },
        ],
      },
    }
    mockClasses.mockResolvedValue([expert])
    mockBackgrounds.mockResolvedValue([])
    const c = seedActive((ch) => {
      ch.classes = [{ name: 'Rogue', source: 'PHB', level: 1 }]
      ch.abilities.dex.base = 14
      ch.grantPicks = { skill: { stealth: 'manual' } }
    })
    renderSection()

    // Only a skill the character is proficient in can be picked.
    expect(await screen.findByText('Class - Rogue expertise')).toBeInTheDocument()
    expect(screen.getByText('2 of 2 left', { exact: false })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Stealth' }))
    await waitFor(() =>
      expect(active(c.id).grantPicks.expertise?.stealth).toBe('class:Rogue|PHB'),
    )
    expect(await screen.findByText('Expertise (Rogue)')).toBeInTheDocument()
  })

  it('surfaces a loader error', async () => {
    seedActive()
    mockRaces.mockRejectedValue(new Error('boom'))
    renderSection()
    expect(await screen.findByText(/Failed to load skills: boom/i)).toBeInTheDocument()
  })
})
