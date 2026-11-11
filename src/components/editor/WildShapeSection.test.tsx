import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WildShapeSection } from './WildShapeSection'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { useCharacterStore } from '../../character/store'
import { createCharacter } from '../../character/model'
import { loadBeasts, type Beast } from '../../data/beasts'
import { loadBookEditions } from '../../data/edition'
import { makeBeast } from '../../test/beastFixtures'
import { settle } from '../../test/settle'

vi.mock('../../data/beasts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/beasts')>()
  return { ...actual, loadBeasts: vi.fn() }
})
vi.mock('../../data/edition', () => ({ loadBookEditions: vi.fn() }))
const mockBeasts = vi.mocked(loadBeasts)

const wolf: Beast = makeBeast({
  name: 'Wolf',
  cr: '1/4',
  crValue: 0.25,
  ac: 13,
  hp: 11,
  speed: { walk: 40 },
})

const giantEagle: Beast = makeBeast({
  name: 'Giant Eagle',
  size: ['L'],
  cr: '1',
  crValue: 1,
  ac: 13,
  hp: 26,
  speed: { walk: 10, fly: 80 },
  hasFly: true,
})

const swarm = makeBeast({ name: 'Swarm of Rats', cr: '1/4', crValue: 0.25, swarm: true })
const spirit = makeBeast({ name: 'Bestial Spirit', hasCr: false })
const frog = makeBeast({
  name: 'Giant Frog',
  cr: '1/4',
  crValue: 0.25,
  hasSwim: true,
  speed: { walk: 30, swim: 30 },
})

function seedActive(mutate: (c: ReturnType<typeof createCharacter>) => void = () => {}) {
  const c = createCharacter('Tordek')
  c.selectedBooks = ['PHB', 'MM']
  mutate(c)
  useCharacterStore.setState({
    characters: { [c.id]: c },
    order: [c.id],
    activeId: c.id,
    view: 'editor',
  })
  return c
}

const druid = (level: number, source = 'PHB') =>
  seedActive((c) => {
    c.classes = [{ name: 'Druid', source, level }]
  })

function renderSection() {
  return render(
    <ThemeProvider>
      <WildShapeSection />
    </ThemeProvider>,
  )
}

function active(id: string) {
  return useCharacterStore.getState().characters[id]
}

/** The row of a beast in the table that is open. */
const rowOf = (name: string) => {
  const row = screen.getByText(name, { selector: 'strong' }).closest('tr')
  if (!row) throw new Error(`no row for ${name}`)
  return within(row)
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mockBeasts.mockResolvedValue([wolf, giantEagle])
  vi.mocked(loadBookEditions).mockResolvedValue((source) =>
    source === 'XPHB' ? 'one' : 'classic',
  )
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

describe('WildShapeSection', () => {
  it('renders nothing without an active character', async () => {
    const { container } = renderSection()
    expect(container).toBeEmptyDOMElement()
    await settle()
    expect(container).toBeEmptyDOMElement()
    expect(mockBeasts).not.toHaveBeenCalled()
  })

  it('renders nothing and reads no beasts when the character is not a Druid', async () => {
    seedActive((c) => {
      c.classes = [{ name: 'Fighter', source: 'PHB', level: 4 }]
    })
    const { container } = renderSection()
    expect(container).toBeEmptyDOMElement()
    await settle()
    expect(container).toBeEmptyDOMElement()
    expect(mockBeasts).not.toHaveBeenCalled()
  })

  it('notes that Wild Shape is locked below Druid level 2 and reads no beasts', async () => {
    seedActive((c) => {
      c.classes = [{ name: 'Druid', source: 'PHB', level: 1 }]
    })
    renderSection()
    expect(screen.getByText(/Wild Shape unlocks at Druid level 2/i)).toBeInTheDocument()
    await settle()
    expect(screen.getByText(/Wild Shape unlocks at Druid level 2/i)).toBeInTheDocument()
    expect(mockBeasts).not.toHaveBeenCalled()
  })

  it('reads the beasts of the selected books once Wild Shape unlocks', async () => {
    const c = seedActive((ch) => {
      ch.classes = [{ name: 'Druid', source: 'PHB', level: 1 }]
    })
    renderSection()
    await settle()
    expect(mockBeasts).not.toHaveBeenCalled()

    act(() => {
      useCharacterStore
        .getState()
        .updateActive({ classes: [{ name: 'Druid', source: 'PHB', level: 2 }] })
    })
    expect(await screen.findByText('Wolf', { selector: 'strong' })).toBeInTheDocument()
    expect(mockBeasts).toHaveBeenCalledWith(active(c.id).selectedBooks)
  })

  it('shows in-limit beasts as standard, greys the rest with the reason and flags an over-limit pick', async () => {
    const user = userEvent.setup()
    mockBeasts.mockResolvedValue([wolf, giantEagle, swarm, spirit])
    const c = druid(4)
    renderSection()

    // Level 4 non-moon: CR 1/2, no flying forms; both the rule and the limits are stated.
    expect(await screen.findByText(/Druid 4: Beasts up to/)).toBeInTheDocument()
    expect(screen.getByText(/no limit on how many forms/i)).toBeInTheDocument()
    expect(await screen.findByText('Wolf', { selector: 'strong' })).toBeInTheDocument()
    // Out-of-limit rows say why, in the row.
    expect(
      rowOf('Giant Eagle').getByText(/CR 1 is above your limit of 1\/2/),
    ).toBeVisible()
    expect(rowOf('Swarm of Rats').getByText(/swarm cannot be/i)).toBeVisible()
    expect(rowOf('Bestial Spirit').getByText(/No challenge rating/)).toBeVisible()
    expect(rowOf('Giant Eagle').getByRole('button', { name: 'Add' })).toBeDisabled()

    await user.click(rowOf('Wolf').getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(active(c.id).wildShapes).toHaveLength(1))

    // The switch allows the over-limit one, which is then flagged in the picks.
    await user.click(screen.getByLabelText(/Allow non-standard choices/))
    await user.click(rowOf('Giant Eagle').getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(active(c.id).wildShapes).toHaveLength(2))
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(rowOf('Giant Eagle').getByRole('note')).toBeInTheDocument()
    expect(rowOf('Wolf').queryByRole('note')).not.toBeInTheDocument()
  })

  it('raises the CR cap and badges a Circle of the Moon druid', async () => {
    seedActive((c) => {
      c.classes = [
        {
          name: 'Druid',
          source: 'PHB',
          level: 6,
          subclass: { name: 'Circle of the Moon', shortName: 'Moon', source: 'PHB' },
        },
        // A second druid entry with no level exercises the `|| 0` fallback.
        { name: 'Druid', source: 'PHB', level: 0 },
      ]
    })
    renderSection()
    expect(await screen.findByText(/- Moon/)).toBeInTheDocument()
    expect(
      screen.getByText(/Circle of the Moon: you can shift as a bonus action/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Druid 6: Beasts up to/)).toHaveTextContent('CR 2')
  })

  it('removes a beast when its form is taken off again', async () => {
    const user = userEvent.setup()
    const c = druid(4)
    renderSection()

    await screen.findByText('Wolf', { selector: 'strong' })
    await user.click(rowOf('Wolf').getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(active(c.id).wildShapes).toHaveLength(1))
    // The same row now offers Remove.
    await user.click(rowOf('Wolf').getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(active(c.id).wildShapes).toHaveLength(0))
  })

  it('describes flying forms at high druid levels', async () => {
    druid(8)
    renderSection()
    expect(await screen.findByText(/flying and swimming included/i)).toBeInTheDocument()
  })

  it('notes that flying and swimming forms are barred at low levels', async () => {
    druid(2)
    renderSection()
    expect(
      await screen.findByText(/neither a flying nor a swimming speed/i),
    ).toBeInTheDocument()
  })

  it('says so when no beast matches the search', async () => {
    const user = userEvent.setup()
    druid(4)
    renderSection()

    await user.type(await screen.findByPlaceholderText(/Search beasts/), 'zzz')
    expect(await screen.findByText('Nothing to show.')).toBeInTheDocument()
  })

  it('says to select a beast book when none is read', async () => {
    mockBeasts.mockResolvedValue([])
    druid(4)
    renderSection()
    expect(await screen.findByText(/No beast books selected/)).toBeInTheDocument()
  })

  it('lists a form from a book that is no longer selected, to remove it', async () => {
    const user = userEvent.setup()
    const c = seedActive((ch) => {
      ch.classes = [{ name: 'Druid', source: 'PHB', level: 4 }]
      ch.wildShapes = [{ name: 'Dire Wolf', source: 'GONE' }]
    })
    renderSection()
    expect(await screen.findByText(/Dire Wolf \(GONE\) is in a book/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(active(c.id).wildShapes).toHaveLength(0))
  })

  it('2024: states the known forms and has no swimming bar', async () => {
    mockBeasts.mockResolvedValue([wolf, frog, giantEagle])
    druid(2, 'XPHB')
    renderSection()

    expect(await screen.findByText(/You know 4 forms/)).toBeInTheDocument()
    expect(screen.queryByText(/no limit on how many/i)).not.toBeInTheDocument()
    expect(screen.getByText(/2 uses/)).toBeInTheDocument()
    expect(await screen.findByText('Forms 0 of 4')).toBeInTheDocument()
    // No swimming limit in 2024: the frog is a standard row at level 2.
    expect(rowOf('Giant Frog').getByRole('button', { name: 'Add' })).toBeEnabled()
  })

  it('2024: a full list of forms blocks adding another until the switch, and shows the count of picks', async () => {
    const user = userEvent.setup()
    const four = ['A', 'B', 'C', 'D'].map((n) =>
      makeBeast({ name: `Beast ${n}`, cr: '1/4', crValue: 0.25 }),
    )
    mockBeasts.mockResolvedValue([...four, wolf])
    const c = seedActive((ch) => {
      ch.classes = [{ name: 'Druid', source: 'XPHB', level: 2 }]
      ch.wildShapes = four.map((b) => ({ name: b.name, source: b.source }))
    })
    renderSection()
    await user.click(await screen.findByRole('button', { name: 'Change' }))
    expect(screen.getByText('Forms 4 of 4')).toBeInTheDocument()
    expect(rowOf('Wolf').getByText(/You know 4 forms already/)).toBeVisible()
    expect(rowOf('Wolf').getByRole('button', { name: 'Add' })).toBeDisabled()

    await user.click(screen.getByLabelText(/Allow non-standard choices/))
    await user.click(rowOf('Wolf').getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(active(c.id).wildShapes).toHaveLength(5))
    expect(screen.getByText('Forms 5 of 4')).toBeInTheDocument()
  })

  it('2024: notes the Moon facts', async () => {
    seedActive((c) => {
      c.classes = [
        {
          name: 'Druid',
          source: 'XPHB',
          level: 3,
          subclass: { name: 'Circle of the Moon', shortName: 'Moon', source: 'XPHB' },
        },
      ]
    })
    renderSection()
    expect(await screen.findByText(/9 temporary hit points/)).toBeInTheDocument()
    expect(screen.getByText(/is 13 plus your Wisdom modifier/)).toBeInTheDocument()
  })

  it('surfaces a loader error', async () => {
    druid(4)
    mockBeasts.mockRejectedValue(new Error('boom'))
    renderSection()
    expect(await screen.findByText(/Failed to load beasts: boom/i)).toBeInTheDocument()
  })
})
