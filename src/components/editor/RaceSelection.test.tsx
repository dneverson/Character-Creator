import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RaceSelection } from './RaceSelection'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { useCharacterStore } from '../../character/store'
import { createCharacter, type RaceRef } from '../../character/model'
import { describeAbilityOption, type AbilityOption } from '../../data/abilityOptions'
import { loadRaces, type PlayableRace } from '../../data/race'
import { ABILITIES } from '../../dice/dice'
import { settle } from '../../test/settle'

vi.mock('../../data/race', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/race')>()),
  loadRaces: vi.fn(),
}))
const mockRaces = vi.mocked(loadRaces)

const dwarf: PlayableRace = {
  featGrants: [],
  key: 'Dwarf|PHB|Hill|PHB',
  name: 'Dwarf (Hill)',
  baseName: 'Dwarf',
  subraceName: 'Hill',
  source: 'PHB',
  edition: 'classic',
  size: ['M'],
  speed: 25,
  darkvision: 60,
  abilityOptions: [{ fixed: { con: 2 }, amounts: [], from: [] }],
}

// A species that has the player place one increase.
const human: PlayableRace = {
  featGrants: [],
  key: 'Human|XPHB||XPHB',
  name: 'Human',
  baseName: 'Human',
  source: 'XPHB',
  edition: 'one',
  size: ['M'],
  speed: { walk: 30 },
  abilityOptions: [{ fixed: {}, amounts: [2], from: ['str', 'dex'] }],
}

// A race that has the player place two +1s among three abilities.
const elf: PlayableRace = {
  featGrants: [],
  key: 'Half-Elf|PHB||PHB',
  name: 'Half-Elf',
  baseName: 'Half-Elf',
  source: 'PHB',
  edition: 'classic',
  size: ['M'],
  speed: 30,
  abilityOptions: [{ fixed: { cha: 2 }, amounts: [1, 1], from: ['str', 'dex', 'con'] }],
}

// A 2024 species that grants no ability increases of its own (they come from the
// background). It also has no speed, which shows as "-" in its cell.
const warforged: PlayableRace = {
  featGrants: [],
  key: 'Warforged|XPHB||XPHB',
  name: 'Warforged',
  baseName: 'Warforged',
  source: 'XPHB',
  edition: 'one',
  size: ['M'],
  abilityOptions: [],
}

// A 2014 race with no increases either.
const construct: PlayableRace = {
  featGrants: [],
  key: 'Construct|PHB||PHB',
  name: 'Construct',
  baseName: 'Construct',
  source: 'PHB',
  edition: 'classic',
  size: ['M'],
  speed: 30,
  abilityOptions: [],
}

// An exotic species with an unknown size code, a boolean movement mode, and a
// choice over every ability.
const oddling: PlayableRace = {
  featGrants: [],
  key: 'Oddling|XPHB||XPHB',
  name: 'Oddling',
  baseName: 'Oddling',
  source: 'XPHB',
  edition: 'one',
  size: ['Z'],
  speed: { walk: 30, hover: true },
  abilityOptions: [{ fixed: {}, amounts: [1], from: [...ABILITIES] }],
}

// A race with two ways to take its increases.
const placeFirst: AbilityOption = { fixed: {}, amounts: [2], from: ['str', 'dex'] }
const fixedSecond: AbilityOption = {
  fixed: { wis: 1 },
  amounts: [1],
  from: ['int', 'cha'],
}
const variant: PlayableRace = {
  featGrants: [],
  key: 'Variant|PHB||PHB',
  name: 'Variant',
  baseName: 'Variant',
  source: 'PHB',
  edition: 'classic',
  size: ['M'],
  speed: 30,
  abilityOptions: [placeFirst, fixedSecond],
}

const dwarfRef: RaceRef = {
  name: 'Dwarf (Hill)',
  baseName: 'Dwarf',
  subraceName: 'Hill',
  source: 'PHB',
  abilityOption: 0,
  abilityFixed: { con: 2 },
  abilityChoices: {},
}

function seedActive(books = ['PHB', 'XPHB'], race?: RaceRef) {
  const c = createCharacter('Tordek')
  c.selectedBooks = books
  c.race = race
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
      <RaceSelection />
    </ThemeProvider>,
  )
}

function active(id: string) {
  return useCharacterStore.getState().characters[id]
}

const raceTable = () => screen.findByRole('table', { name: 'Race reference' })
const rowOf = (name: string) =>
  within(screen.getByRole('table', { name: 'Race reference' }))
    .getByText(name)
    .closest('tr') as HTMLElement

/** The cell of a race's row under a column, found by the column's sort button. */
function cellOf(name: string, header: string): HTMLElement {
  const headers = within(
    screen.getByRole('table', { name: 'Race reference' }),
  ).getAllByRole('columnheader')
  const index = headers.findIndex((h) =>
    within(h).queryByRole('button', { name: header }),
  )
  return within(rowOf(name)).getAllByRole('cell')[index]
}

async function choose(user: ReturnType<typeof userEvent.setup>, name: string) {
  await raceTable()
  await user.click(within(rowOf(name)).getByRole('button', { name: 'Choose' }))
}

const summary = () =>
  screen.getByRole('heading', { level: 3 }).closest('.border') as HTMLElement
const increase = (amount: string, ability: string) =>
  within(screen.getByRole('group', { name: `Add ${amount} to` })).getByRole('button', {
    name: ability,
  })

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mockRaces.mockResolvedValue([dwarf, human])
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

describe('RaceSelection', () => {
  it('renders nothing without an active character', async () => {
    const { container } = renderSection()
    expect(container).toBeEmptyDOMElement()
    // Still nothing once the section data has loaded.
    await settle()
    expect(container).toBeEmptyDOMElement()
  })

  it('shows every race of the books in a table until one is chosen', async () => {
    seedActive()
    renderSection()
    expect(screen.getByText(/Loading races/)).toBeInTheDocument()
    await raceTable()
    expect(rowOf('Dwarf (Hill)')).toBeInTheDocument()
    expect(rowOf('Human')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument()
  })

  it('chooses a race with fixed increases and sums it up', async () => {
    const user = userEvent.setup()
    const c = seedActive()
    renderSection()

    await choose(user, 'Dwarf (Hill)')
    await waitFor(() => expect(active(c.id).race?.baseName).toBe('Dwarf'))
    expect(active(c.id).race).toMatchObject({
      name: 'Dwarf (Hill)',
      subraceName: 'Hill',
      source: 'PHB',
      abilityOption: 0,
      abilityFixed: { con: 2 },
      abilityChoices: {},
    })
    expect(
      screen.queryByRole('table', { name: 'Race reference' }),
    ).not.toBeInTheDocument()
    expect(
      within(summary()).getByRole('heading', { name: 'Dwarf (Hill)' }),
    ).toBeInTheDocument()
    expect(within(summary()).getByText('Darkvision:')).toBeInTheDocument()
    expect(within(summary()).getByText('60 ft.')).toBeInTheDocument()
    expect(within(summary()).getByText('Constitution +2')).toBeInTheDocument()
  })

  it('places a single chosen increase and takes it back off', async () => {
    const user = userEvent.setup()
    const c = seedActive()
    renderSection()

    await choose(user, 'Human')
    await waitFor(() => expect(active(c.id).race?.baseName).toBe('Human'))

    await user.click(increase('+2', 'Strength'))
    await waitFor(() => expect(active(c.id).race?.abilityChoices.str).toBe(2))
    expect(increase('+2', 'Strength')).toHaveAttribute('aria-pressed', 'true')

    // Clicking the same ability again takes the increase off.
    await user.click(increase('+2', 'Strength'))
    await waitFor(() => expect(active(c.id).race?.abilityChoices.str).toBeUndefined())
  })

  it('moves a single increase to another ability clicked', async () => {
    const user = userEvent.setup()
    const c = seedActive()
    renderSection()

    await choose(user, 'Human')
    await user.click(increase('+2', 'Strength'))
    await waitFor(() => expect(active(c.id).race?.abilityChoices.str).toBe(2))
    expect(increase('+2', 'Dexterity')).toBeEnabled()

    await user.click(increase('+2', 'Dexterity'))
    await waitFor(() => expect(active(c.id).race?.abilityChoices).toEqual({ dex: 2 }))
  })

  it('holds back the other abilities once every one of several increases is placed', async () => {
    const user = userEvent.setup()
    mockRaces.mockResolvedValue([elf])
    const c = seedActive()
    renderSection()

    await choose(user, 'Half-Elf')
    await user.click(increase('+1', 'Strength'))
    expect(increase('+1', 'Constitution')).toBeEnabled()
    await user.click(increase('+1', 'Dexterity'))
    await waitFor(() =>
      expect(active(c.id).race?.abilityChoices).toEqual({ str: 1, dex: 1 }),
    )
    expect(increase('+1', 'Constitution')).toBeDisabled()
    expect(screen.getByText('2 of 2 chosen')).toBeInTheDocument()
  })

  it('switches to another way of taking the increases, starting it afresh', async () => {
    const user = userEvent.setup()
    mockRaces.mockResolvedValue([variant])
    const c = seedActive()
    renderSection()

    await choose(user, 'Variant')
    await user.click(increase('+2', 'Strength'))
    await waitFor(() => expect(active(c.id).race?.abilityChoices).toEqual({ str: 2 }))

    await user.click(
      screen.getByRole('radio', { name: describeAbilityOption(fixedSecond) }),
    )
    await waitFor(() => expect(active(c.id).race?.abilityOption).toBe(1))
    expect(active(c.id).race?.abilityFixed).toEqual({ wis: 1 })
    expect(active(c.id).race?.abilityChoices).toEqual({})
    expect(screen.getByText('Wisdom +1')).toBeInTheDocument()
    expect(increase('+1', 'Charisma')).toHaveAttribute('aria-pressed', 'false')
  })

  it('says where a 2024 species gets its increases, and leaves out a speed it lacks', async () => {
    const user = userEvent.setup()
    mockRaces.mockResolvedValue([warforged])
    seedActive()
    renderSection()

    await raceTable()
    // No speed: a dash in its cell.
    expect(cellOf('Warforged', 'Speed')).toHaveTextContent(/^-$/)

    await choose(user, 'Warforged')
    expect(
      await screen.findByText(
        'None from the species: under the 2024 rules they come from your background.',
      ),
    ).toBeInTheDocument()
    expect(within(summary()).getByText('Size:')).toBeInTheDocument()
    expect(within(summary()).queryByText('Speed:')).not.toBeInTheDocument()
  })

  it('says a 2014 race without increases gives none', async () => {
    const user = userEvent.setup()
    mockRaces.mockResolvedValue([construct])
    seedActive()
    renderSection()

    await choose(user, 'Construct')
    expect(await screen.findByText('This race gives none.')).toBeInTheDocument()
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
  })

  it('shows an unknown size as it is, names a boolean speed, and offers every ability', async () => {
    const user = userEvent.setup()
    mockRaces.mockResolvedValue([oddling])
    seedActive()
    renderSection()

    await choose(user, 'Oddling')
    // An unknown size code passes through verbatim; a boolean mode is named.
    expect(within(summary()).getByText('Z')).toBeInTheDocument()
    expect(within(summary()).getByText('30 ft., hover 30 ft.')).toBeInTheDocument()
    // A choice over every ability offers all six.
    const buttons = within(screen.getByRole('group', { name: 'Add +1 to' })).getAllByRole(
      'button',
    )
    expect(buttons.map((b) => b.textContent)).toEqual([
      'Strength',
      'Dexterity',
      'Constitution',
      'Intelligence',
      'Wisdom',
      'Charisma',
    ])
  })

  it('clears the race back to none from its row', async () => {
    const user = userEvent.setup()
    const c = seedActive(['PHB', 'XPHB'], dwarfRef)
    renderSection()

    expect(
      await screen.findByRole('heading', { level: 3, name: 'Dwarf (Hill)' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Change race' }))
    await user.click(
      within(rowOf('Dwarf (Hill)')).getByRole('button', { name: 'Remove' }),
    )
    await waitFor(() => expect(active(c.id).race).toBeUndefined())
    expect(
      within(rowOf('Dwarf (Hill)')).getByRole('button', { name: 'Choose' }),
    ).toBeInTheDocument()
  })

  it('takes the increases the first way for a race saved before there were several', async () => {
    const { abilityOption, ...saved } = dwarfRef
    expect(abilityOption).toBe(0)
    seedActive(['PHB', 'XPHB'], saved)
    renderSection()

    expect(
      await screen.findByRole('heading', { level: 3, name: 'Dwarf (Hill)' }),
    ).toBeInTheDocument()
    expect(within(summary()).getByText('Constitution +2')).toBeInTheDocument()
  })

  it('keeps the race when changing it is called off', async () => {
    const user = userEvent.setup()
    const c = seedActive(['PHB', 'XPHB'], dwarfRef)
    renderSection()

    await user.click(await screen.findByRole('button', { name: 'Change race' }))
    expect(screen.getByText(/Current race:/)).toHaveTextContent(
      'Current race: Dwarf (Hill)',
    )
    await user.click(screen.getByRole('button', { name: 'Keep Dwarf (Hill)' }))
    expect(
      screen.getByRole('heading', { level: 3, name: 'Dwarf (Hill)' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('table', { name: 'Race reference' }),
    ).not.toBeInTheDocument()
    expect(active(c.id).race).toEqual(dwarfRef)
  })

  it('warns about a race outside the selected books, and removes it', async () => {
    const user = userEvent.setup()
    const c = seedActive(['PHB', 'XPHB'], {
      name: 'Tabaxi',
      baseName: 'Tabaxi',
      source: 'VGM',
      abilityFixed: { dex: 2, cha: 1 },
      abilityChoices: {},
    })
    renderSection()

    const warning = (await screen.findByText(/is not in the selected books/)).closest(
      '.alert',
    ) as HTMLElement
    expect(warning).toHaveTextContent(
      "This character's race, Tabaxi (VGM), is not in the selected books.",
    )
    // The table stays open to choose another.
    expect(await raceTable()).toBeInTheDocument()

    await user.click(within(warning).getByRole('button', { name: 'Remove race' }))
    await waitFor(() => expect(active(c.id).race).toBeUndefined())
    expect(screen.queryByText(/is not in the selected books/)).not.toBeInTheDocument()
  })

  it('warns when no races are available from the selected books', async () => {
    seedActive(['DMG'])
    renderSection()
    expect(await screen.findByText(/No races available/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('table', { name: 'Race reference' }),
    ).not.toBeInTheDocument()
  })

  it('surfaces a loader error', async () => {
    seedActive()
    mockRaces.mockRejectedValue(new Error('boom'))
    renderSection()
    expect(await screen.findByText(/Failed to load races: boom/i)).toBeInTheDocument()
  })
})
