import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BackgroundSelection } from './BackgroundSelection'
import { BackgroundStory } from './BackgroundStory'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { useCharacterStore } from '../../character/store'
import { createCharacter, type RaceRef } from '../../character/model'
import { loadBackgrounds, type PlayableBackground } from '../../data/background'
import { describeAbilityOption, parseAbilityOptions } from '../../data/abilityOptions'
import { loadRaces, type PlayableRace } from '../../data/race'
import { settle } from '../../test/settle'

vi.mock('../../data/background', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/background')>()),
  loadBackgrounds: vi.fn(),
}))
vi.mock('../../data/race', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/race')>()),
  loadRaces: vi.fn(),
}))
const mockBackgrounds = vi.mocked(loadBackgrounds)
const mockRaces = vi.mocked(loadRaces)

const acolyte: PlayableBackground = {
  featGrants: [{ named: ['magic initiate|xphb'], categories: [] }],
  key: 'Acolyte|XPHB',
  name: 'Acolyte',
  source: 'XPHB',
  edition: 'one',
  skillProficiencies: [{ insight: true, choose: { from: ['religion', 'history'] } }],
  abilityOptions: parseAbilityOptions([
    { choose: { weighted: { from: ['int', 'wis', 'cha'], weights: [2, 1] } } },
    { choose: { weighted: { from: ['int', 'wis', 'cha'], weights: [1, 1, 1] } } },
  ]),
  storyTables: [],
  entries: ['A devout servant of the temple.'],
}

// A bare background with no skills and a single way to take its increases.
const drifter: PlayableBackground = {
  featGrants: [],
  key: 'Drifter|XPHB',
  name: 'Drifter',
  source: 'XPHB',
  edition: 'one',
  skillProficiencies: [],
  abilityOptions: parseAbilityOptions([
    { choose: { weighted: { from: ['con'], weights: [1] } } },
  ]),
  storyTables: [],
  entries: [],
}

// A 2014 background: its increases come from the race.
const sailor: PlayableBackground = {
  featGrants: [],
  key: 'Sailor|XPHB',
  name: 'Sailor',
  source: 'XPHB',
  skillProficiencies: [{ athletics: true, perception: true }],
  abilityOptions: [],
  storyTables: [],
  entries: [],
}

// A 2024 background without increases (none in the books, but the data allows it).
const plain: PlayableBackground = {
  ...drifter,
  key: 'Plain|XPHB',
  name: 'Plain',
  abilityOptions: [],
}

// A background with a story table, to roll on in its details and in the Story section.
const drifterWithTable: PlayableBackground = {
  ...drifter,
  key: 'Wanderer|XPHB',
  name: 'Wanderer',
  storyTables: [
    {
      key: 'personality trait',
      title: 'Personality Trait',
      label: 'Personality Trait',
      field: 'personalityTraits',
      count: 1,
      die: 2,
      rows: [
        { min: 1, max: 1, text: 'I am polite.' },
        { min: 2, max: 2, text: 'I am brave.' },
      ],
    },
  ],
}

const elf: RaceRef = {
  name: 'Elf',
  baseName: 'Elf',
  source: 'PHB',
  abilityFixed: { dex: 2 },
  abilityChoices: {},
}

const human2024: PlayableRace = {
  featGrants: [],
  key: 'Human|XPHB||XPHB',
  name: 'Human',
  baseName: 'Human',
  source: 'XPHB',
  edition: 'one',
  abilityOptions: [],
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
      <BackgroundSelection />
    </ThemeProvider>,
  )
}

function active(id: string) {
  return useCharacterStore.getState().characters[id]
}

const TABLE = 'Background reference'
const rowOf = (name: string) =>
  within(screen.getByRole('table', { name: TABLE }))
    .getByText(name)
    .closest('tr') as HTMLElement

async function choose(user: ReturnType<typeof userEvent.setup>, name: string) {
  await screen.findByRole('table', { name: TABLE })
  await user.click(within(rowOf(name)).getByRole('button', { name: 'Choose' }))
}

const summary = (name: string) =>
  screen.getByRole('heading', { level: 3, name }).closest('.border') as HTMLElement
const increase = (amount: string, ability: string) =>
  within(screen.getByRole('group', { name: `Add ${amount} to` })).getByRole('button', {
    name: ability,
  })

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mockBackgrounds.mockResolvedValue([acolyte])
  mockRaces.mockResolvedValue([human2024])
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

describe('BackgroundSelection story tables', () => {
  it('takes a row in the details of the chosen background, the same row as in Story', async () => {
    const user = userEvent.setup()
    mockBackgrounds.mockResolvedValue([drifterWithTable])
    const c = seedActive((ch) => {
      ch.background = {
        name: 'Wanderer',
        source: 'XPHB',
        abilityOption: 0,
        abilityChoices: {},
      }
    })
    render(
      <ThemeProvider>
        <BackgroundSelection />
        <BackgroundStory />
      </ThemeProvider>,
    )
    await user.click(await screen.findByRole('button', { name: 'Show details' }))
    // Both places offer the table to pick from, not only to read.
    const rows = await screen.findAllByRole('button', { name: /I am brave\./ })
    expect(rows).toHaveLength(2)
    await user.click(rows[0])
    await waitFor(() =>
      expect(active(c.id).story.personalityTraits).toContain('I am brave.'),
    )
    // Taken in one, folded to a line in the other: the same state.
    expect(await screen.findAllByText('1 of 1 from the table')).toHaveLength(2)
    // The details list the row taken under its folded line; Story has its text box.
    expect(screen.getByRole('listitem')).toHaveTextContent('I am brave.')
  })

  it('only reads the story tables of a background that is not the chosen one', async () => {
    const user = userEvent.setup()
    mockBackgrounds.mockResolvedValue([drifterWithTable, acolyte])
    seedActive((ch) => {
      ch.background = {
        name: 'Acolyte',
        source: 'XPHB',
        abilityOption: 0,
        abilityChoices: {},
      }
    })
    renderSection()
    await user.click(await screen.findByRole('button', { name: 'Change background' }))
    await user.click(screen.getByText('Wanderer'))
    expect((await screen.findAllByText('I am brave.')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /I am brave\./ })).not.toBeInTheDocument()
  })
})

describe('BackgroundSelection', () => {
  it('renders nothing without an active character', async () => {
    const { container } = renderSection()
    expect(container).toBeEmptyDOMElement()
    // Still nothing once the section data has loaded.
    await settle()
    expect(container).toBeEmptyDOMElement()
  })

  it('chooses a background from the table, takes a way and places an increase', async () => {
    const user = userEvent.setup()
    // Race already grants ability bonuses -> placing one here trips the edition-mix badge.
    const c = seedActive((ch) => {
      ch.race = elf
    })
    renderSection()

    expect(screen.getByText(/Loading backgrounds/)).toBeInTheDocument()
    await choose(user, 'Acolyte')
    await waitFor(() => expect(active(c.id).background?.name).toBe('Acolyte'))
    expect(active(c.id).background).toEqual({
      name: 'Acolyte',
      source: 'XPHB',
      abilityOption: 0,
      abilityChoices: {},
    })
    expect(screen.queryByRole('table', { name: TABLE })).not.toBeInTheDocument()
    expect(within(summary('Acolyte')).getByText('Skills:')).toBeInTheDocument()
    expect(summary('Acolyte')).toHaveTextContent('Insight')
    expect(summary('Acolyte')).toHaveTextContent('Feat:Magic Initiate')
    expect(
      screen.getByText('Choose your skills in the Skills section below.'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show details' }))
    expect(screen.getByText(/devout servant/i)).toBeInTheDocument()

    // Two ways -> take the first, then put the +2 on Wisdom.
    const [first] = acolyte.abilityOptions
    await user.click(screen.getByRole('radio', { name: describeAbilityOption(first) }))
    await user.click(increase('+2', 'Wisdom'))
    await waitFor(() => expect(active(c.id).background?.abilityChoices.wis).toBe(2))
    expect(active(c.id).background?.abilityOption).toBe(0)
    expect(screen.getByRole('note')).toHaveTextContent('Non-standard')
  })

  it('takes the increases another way, starting it afresh', async () => {
    const user = userEvent.setup()
    const c = seedActive((ch) => {
      ch.background = {
        name: 'Acolyte',
        source: 'XPHB',
        abilityOption: 0,
        abilityChoices: { wis: 2 },
      }
    })
    renderSection()

    const [, second] = acolyte.abilityOptions
    await user.click(
      await screen.findByRole('radio', { name: describeAbilityOption(second) }),
    )
    await waitFor(() => expect(active(c.id).background?.abilityOption).toBe(1))
    expect(active(c.id).background?.abilityChoices).toEqual({})
  })

  it('clears the background back to none from its row', async () => {
    const user = userEvent.setup()
    const c = seedActive((ch) => {
      ch.background = { name: 'Acolyte', source: 'XPHB', abilityChoices: {} }
    })
    renderSection()

    await user.click(await screen.findByRole('button', { name: 'Change background' }))
    await user.click(within(rowOf('Acolyte')).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(active(c.id).background).toBeUndefined())
  })

  it('offers no choice of ways for a background with one, and no skill hint without choices', async () => {
    const user = userEvent.setup()
    mockBackgrounds.mockResolvedValue([drifter])
    const c = seedActive()
    renderSection()

    await choose(user, 'Drifter')
    await waitFor(() => expect(active(c.id).background?.abilityOption).toBe(0))
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(increase('+1', 'Constitution')).toBeInTheDocument()
    // No skills: left out of the summary.
    expect(within(summary('Drifter')).queryByText('Skills:')).not.toBeInTheDocument()
    expect(screen.queryByText(/Skills section below/)).not.toBeInTheDocument()
  })

  it('moves an ability to another amount, clearing the first', async () => {
    const user = userEvent.setup()
    const c = seedActive((ch) => {
      ch.background = {
        name: 'Acolyte',
        source: 'XPHB',
        abilityOption: 0,
        abilityChoices: {},
      }
    })
    renderSection()

    await screen.findByRole('group', { name: 'Add +2 to' })
    await user.click(increase('+2', 'Wisdom'))
    await waitFor(() => expect(active(c.id).background?.abilityChoices.wis).toBe(2))
    await user.click(increase('+1', 'Wisdom'))
    await waitFor(() =>
      expect(active(c.id).background?.abilityChoices).toEqual({ wis: 1 }),
    )
  })

  it('trips the edition-mix badge from a race ability choice', async () => {
    const user = userEvent.setup()
    // A race that grants a *chosen* bonus (no fixed) exercises the OR fallback.
    const c = seedActive((ch) => {
      ch.race = { ...elf, abilityFixed: {}, abilityChoices: { str: 1 } }
    })
    renderSection()

    await choose(user, 'Acolyte')
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    await user.click(increase('+2', 'Wisdom'))
    await waitFor(() => expect(active(c.id).background?.abilityChoices.wis).toBe(2))
    expect(screen.getByRole('note')).toHaveTextContent('Non-standard')
  })

  it('says a 2014 background leaves the increases to the race', async () => {
    const user = userEvent.setup()
    mockBackgrounds.mockResolvedValue([sailor, plain])
    seedActive((ch) => {
      ch.race = elf
    })
    renderSection()

    await choose(user, 'Sailor')
    expect(
      await screen.findByText(
        'None from the background: under the 2014 rules they come from your race.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('group')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Change background' }))
    await choose(user, 'Plain')
    expect(await screen.findByText('This background gives none.')).toBeInTheDocument()
  })

  it('says plainly when neither a 2024 species nor a 2014 background gives increases', async () => {
    const user = userEvent.setup()
    mockBackgrounds.mockResolvedValue([sailor])
    seedActive((ch) => {
      ch.race = {
        name: 'Human',
        baseName: 'Human',
        source: 'XPHB',
        abilityFixed: {},
        abilityChoices: {},
      }
    })
    renderSection()

    await choose(user, 'Sailor')
    expect(await screen.findByText(/^None from either:/)).toHaveTextContent(
      'under the 2024 rules your species leaves them to the background, and under the 2014 rules this background leaves them to the race.',
    )
  })

  it('warns about a background outside the selected books, and removes it', async () => {
    const user = userEvent.setup()
    const c = seedActive((ch) => {
      ch.background = { name: 'Haunted One', source: 'VRGR', abilityChoices: {} }
    })
    renderSection()

    const warning = (await screen.findByText(/is not in the selected books/)).closest(
      '.alert',
    ) as HTMLElement
    expect(warning).toHaveTextContent(
      "This character's background, Haunted One (VRGR), is not in the selected books.",
    )
    // The table stays open to choose another.
    expect(screen.getByRole('table', { name: TABLE })).toBeInTheDocument()

    await user.click(within(warning).getByRole('button', { name: 'Remove background' }))
    await waitFor(() => expect(active(c.id).background).toBeUndefined())
    expect(screen.queryByText(/is not in the selected books/)).not.toBeInTheDocument()
  })

  it('warns when no backgrounds are available from the selected books', async () => {
    seedActive((c) => {
      c.selectedBooks = ['DMG']
    })
    renderSection()
    expect(await screen.findByText(/No backgrounds available/i)).toBeInTheDocument()
  })

  it('surfaces a loader error', async () => {
    seedActive()
    mockBackgrounds.mockRejectedValue(new Error('boom'))
    renderSection()
    expect(
      await screen.findByText(/Failed to load backgrounds: boom/i),
    ).toBeInTheDocument()
  })
})
