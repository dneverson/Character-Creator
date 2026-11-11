import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeatsSection } from './FeatsSection'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { useCharacterStore } from '../../character/store'
import { createCharacter, type Character, type FeatChoice } from '../../character/model'
import { loadBackgrounds, type PlayableBackground } from '../../data/background'
import { loadClasses, type LoadedClass } from '../../data/class'
import { loadRaces, type PlayableRace } from '../../data/race'
import { loadFeats } from '../../data/feats'
import { parseAbilityOptions } from '../../data/abilityOptions'
import { makeFeat } from '../../test/featFixtures'

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

// ---- Fixtures ---------------------------------------------------------------

const fighter: LoadedClass = {
  entry: {
    name: 'Fighter',
    source: 'XPHB',
    hd: { number: 1, faces: 10 },
    classFeatures: [
      'Fighting Style|Fighter|XPHB|1',
      'Ability Score Improvement|Fighter|XPHB|4',
    ],
  },
  file: {
    classFeature: [
      {
        name: 'Fighting Style',
        source: 'XPHB',
        className: 'Fighter',
        classSource: 'XPHB',
        level: 1,
        entries: [
          'You gain a {@filter Fighting Style feat|feats|category=FS} of your choice.',
        ],
      },
    ],
  },
}

const human: PlayableRace = {
  key: 'human|xphb',
  name: 'Human',
  baseName: 'Human',
  source: 'XPHB',
  size: ['M'],
  abilityOptions: [],
  featGrants: [{ named: [], categories: ['O'] }],
}

const soldier: PlayableBackground = {
  key: 'Soldier|XPHB',
  name: 'Soldier',
  source: 'XPHB',
  edition: 'one',
  abilityOptions: [],
  storyTables: [],
  featGrants: [{ named: ['alert|xphb'], categories: [] }],
  entries: [],
}

const alert = makeFeat({
  name: 'Alert',
  category: 'O',
  entries: ['Add your Proficiency Bonus to Initiative.'],
})
const archery = makeFeat({ name: 'Archery', category: 'FS' })
const grappler = makeFeat({
  name: 'Grappler',
  category: 'G',
  prerequisites: [{ level: 4 }],
  abilityOptions: parseAbilityOptions([{ choose: { from: ['str', 'dex'] } }]),
})
const resilient = makeFeat({
  name: 'Resilient',
  category: 'G',
  abilityOptions: parseAbilityOptions([
    {
      str: 1,
      choose: { from: [], entry: 'Gain proficiency in Strength saving throws.' },
    },
    { dex: 1 },
  ]),
})
const tough = makeFeat({ name: 'Tough', category: 'O' })
const lucky = makeFeat({ name: 'Lucky', source: 'PHB' })
// The 2024 Ability Score Improvement feat is offered as the slot's own choice.
const asiFeat = makeFeat({ name: 'Ability Score Improvement', category: 'G' })

const RACE_SLOT = 'race:Human||XPHB:0'
const BG_SLOT = 'bg:Soldier|XPHB:0'
const STYLE_SLOT = 'class:Fighter|XPHB:1:Fighting Style'
const ASI_SLOT = 'class:Fighter|XPHB:4:Ability Score Improvement'

function seed(mutate: (c: Character) => void = () => {}) {
  const c = createCharacter('Tester')
  c.selectedBooks = ['XPHB']
  c.race = {
    name: 'Human',
    baseName: 'Human',
    source: 'XPHB',
    abilityFixed: {},
    abilityChoices: {},
  }
  c.background = { name: 'Soldier', source: 'XPHB', abilityChoices: {} }
  c.classes = [{ name: 'Fighter', source: 'XPHB', level: 4 }]
  mutate(c)
  useCharacterStore.setState({
    characters: { [c.id]: c },
    order: [c.id],
    activeId: c.id,
    view: 'editor',
  })
  return c
}

const featsOf = (id: string) => useCharacterStore.getState().characters[id].feats
const choiceOf = (id: string, slot: string): FeatChoice | undefined =>
  featsOf(id).choices[slot]

function renderSection() {
  return render(
    <ThemeProvider>
      <FeatsSection />
    </ThemeProvider>,
  )
}

/** The block of one slot, found by its label. */
async function card(label: string) {
  return within(await screen.findByRole('region', { name: label }))
}

const tableOf = (label: string) =>
  within(screen.getByRole('table', { name: `Feats for ${label}` }))
const rowOf = (label: string, name: string) =>
  tableOf(label).getByText(name).closest('tr') as HTMLElement

type User = ReturnType<typeof userEvent.setup>

/** Opens a slot's table when it is shut. */
async function open(user: User, label: string) {
  await user.click((await card(label)).getByRole('button', { name: 'Choose feat' }))
  await screen.findByRole('table', { name: `Feats for ${label}` })
}

async function choose(user: User, label: string, name: string) {
  await screen.findByRole('table', { name: `Feats for ${label}` })
  await user.click(within(rowOf(label, name)).getByRole('button', { name: 'Choose' }))
}

const RACE_LABEL = 'Human - Feat'
const BG_LABEL = 'Soldier background - Feat'
const STYLE_LABEL = 'Fighter level 1 - Fighting Style'
const ASI_LABEL = 'Fighter level 4 - Ability Score Improvement'

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mockClasses.mockResolvedValue([fighter])
  mockRaces.mockResolvedValue([human])
  mockBackgrounds.mockResolvedValue([soldier])
  mockFeats.mockResolvedValue([
    alert,
    archery,
    grappler,
    resilient,
    lucky,
    tough,
    asiFeat,
  ])
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

describe('FeatsSection', () => {
  it('renders nothing without an active character', async () => {
    // The data still loads; let it settle so its state updates land inside act().
    const { container } = await act(async () => renderSection())
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a loading state, then a load error', async () => {
    let fail: (e: Error) => void = () => {}
    mockFeats.mockReturnValue(
      new Promise((_, reject) => {
        fail = reject
      }),
    )
    seed()
    renderSection()
    expect(screen.getByText('Loading feats…')).toBeInTheDocument()
    fail(new Error('boom'))
    expect(await screen.findByText('Failed to load feats: boom')).toBeInTheDocument()
  })

  it('explains an empty list before any slot is granted', async () => {
    seed((c) => {
      c.race = undefined
      c.background = undefined
      c.classes = []
    })
    renderSection()
    expect(await screen.findByText(/No feat slots yet/)).toBeInTheDocument()
  })

  it('names each slot and what it takes, and fills a granted feat automatically', async () => {
    const user = userEvent.setup()
    seed()
    renderSection()

    const bg = await card(BG_LABEL)
    expect(bg.getByText(': Alert (granted)')).toBeInTheDocument()
    expect(bg.getByText('Granted automatically by the Soldier background.')).toBeVisible()
    expect(bg.getByRole('heading', { level: 3, name: 'Alert' })).toBeInTheDocument()
    expect(bg.getByText('Origin')).toBeInTheDocument()

    await user.click(bg.getByRole('button', { name: 'Show details' }))
    expect(bg.getByText('Add your Proficiency Bonus to Initiative.')).toBeInTheDocument()
    await user.click(bg.getByRole('button', { name: 'Hide details' }))
    expect(
      bg.queryByText('Add your Proficiency Bonus to Initiative.'),
    ).not.toBeInTheDocument()

    expect((await card(RACE_LABEL)).getByText(': Origin feat')).toBeInTheDocument()
    expect(
      (await card(STYLE_LABEL)).getByText(': Fighting Style feat'),
    ).toBeInTheDocument()
    const asi = await card(ASI_LABEL)
    expect(
      asi.getByText(': any feat or an Ability Score Improvement'),
    ).toBeInTheDocument()
    expect(asi.getByText('No feat chosen yet')).toBeInTheDocument()
    expect(asi.queryByText('No choice made yet')).not.toBeInTheDocument()
  })

  it('opens the first empty slot, and the next one after each pick', async () => {
    const user = userEvent.setup()
    const c = seed()
    renderSection()

    await screen.findByRole('table', { name: `Feats for ${RACE_LABEL}` })
    expect(
      screen.queryByRole('table', { name: `Feats for ${STYLE_LABEL}` }),
    ).not.toBeInTheDocument()
    expect(
      (await card(STYLE_LABEL)).getByRole('button', { name: 'Choose feat' }),
    ).toBeInTheDocument()

    await choose(user, RACE_LABEL, 'Tough')
    expect(choiceOf(c.id, RACE_SLOT)?.feat?.name).toBe('Tough')
    await screen.findByRole('table', { name: `Feats for ${STYLE_LABEL}` })
    expect(
      screen.queryByRole('table', { name: `Feats for ${RACE_LABEL}` }),
    ).not.toBeInTheDocument()
  })

  it('greys the feats that do not fit a slot, with the reason, and lists them last', async () => {
    const user = userEvent.setup()
    seed()
    renderSection()
    await open(user, STYLE_LABEL)

    const names = tableOf(STYLE_LABEL)
      .getAllByRole('row')
      .map((r) => r.querySelector('strong')?.textContent)
      .filter(Boolean)
    expect(names[0]).toBe('Archery')
    expect(names).toContain('Grappler')

    const grappler = rowOf(STYLE_LABEL, 'Grappler')
    expect(grappler).toHaveAttribute('title', 'Not in the Fighting Style feat category')
    expect(within(grappler).getByRole('button', { name: 'Choose' })).toBeDisabled()
    expect(
      within(rowOf(STYLE_LABEL, 'Archery')).getByRole('button', { name: 'Choose' }),
    ).toBeEnabled()
  })

  it('narrows the table by the Category column filter', async () => {
    const user = userEvent.setup()
    seed()
    renderSection()
    await open(user, STYLE_LABEL)

    await user.click(screen.getByRole('button', { name: 'Category filter menu' }))
    await user.click(screen.getByRole('checkbox', { name: 'Toggle all values' }))
    await user.click(screen.getByRole('checkbox', { name: 'General' }))
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    const table = tableOf(STYLE_LABEL)
    expect(table.getByText('Grappler')).toBeInTheDocument()
    expect(table.getByText('Resilient')).toBeInTheDocument()
    expect(table.queryByText('Archery')).not.toBeInTheDocument()
  })

  it('flags an off-category pick once the switch allows it, and clears it to no choice', async () => {
    const user = userEvent.setup()
    const c = seed()
    renderSection()
    await open(user, STYLE_LABEL)

    await user.click(screen.getByRole('checkbox', { name: /Allow non-standard choices/ }))
    await choose(user, STYLE_LABEL, 'Resilient')
    expect(choiceOf(c.id, STYLE_SLOT)).toEqual({
      kind: 'feat',
      feat: { name: 'Resilient', source: 'XPHB' },
      abilityOption: 0,
      abilityChoices: {},
    })
    const style = await card(STYLE_LABEL)
    expect(style.getByText('Not in the Fighting Style feat category')).toBeInTheDocument()
    expect(style.getByText('Non-standard')).toBeInTheDocument()

    await user.click(style.getByRole('button', { name: 'Change feat' }))
    await user.click(
      within(rowOf(STYLE_LABEL, 'Resilient')).getByRole('button', { name: 'Remove' }),
    )
    expect(choiceOf(c.id, STYLE_SLOT)).toBeUndefined()
  })

  it('greys a feat already taken in another slot, naming that slot', async () => {
    seed()
    renderSection()
    await screen.findByRole('table', { name: `Feats for ${RACE_LABEL}` })

    const row = rowOf(RACE_LABEL, 'Alert')
    expect(row).toHaveAttribute('title', `Already taken: ${BG_LABEL}`)
    expect(within(row).getByRole('button', { name: 'Choose' })).toBeDisabled()
  })

  it('takes a feat, then the Ability Score Improvement row, in one slot', async () => {
    const user = userEvent.setup()
    const c = seed()
    renderSection()
    await open(user, ASI_LABEL)

    await choose(user, ASI_LABEL, 'Grappler')
    const asi = await card(ASI_LABEL)
    expect(asi.getByText('Level 4')).toBeInTheDocument()
    // A single pick replaces the previous one.
    const group = asi.getByRole('group', { name: 'Add +1 to' })
    await user.click(within(group).getByRole('button', { name: 'Strength' }))
    await user.click(within(group).getByRole('button', { name: 'Dexterity' }))
    expect(choiceOf(c.id, ASI_SLOT)?.abilityChoices).toEqual({ dex: 1 })
    await user.click(within(group).getByRole('button', { name: 'Dexterity' }))
    expect(choiceOf(c.id, ASI_SLOT)?.abilityChoices).toEqual({})

    await user.click(asi.getByRole('button', { name: 'Change feat' }))
    await choose(user, ASI_LABEL, 'Ability Score Improvement')
    expect(choiceOf(c.id, ASI_SLOT)).toEqual({
      kind: 'asi',
      abilityOption: 0,
      abilityChoices: {},
    })
    expect(asi.getByText('Choose 1 ability score to increase')).toBeInTheDocument()

    await user.click(asi.getByRole('button', { name: 'Change feat' }))
    await user.click(
      within(rowOf(ASI_LABEL, 'Ability Score Improvement')).getByRole('button', {
        name: 'Remove',
      }),
    )
    expect(choiceOf(c.id, ASI_SLOT)).toBeUndefined()
  })

  it('offers the Ability Score Improvement only on slots that take one', async () => {
    const user = userEvent.setup()
    seed()
    renderSection()
    await open(user, STYLE_LABEL)
    expect(
      tableOf(STYLE_LABEL).queryByText('Ability Score Improvement'),
    ).not.toBeInTheDocument()
  })

  it('limits multi-ability picks to the option count', async () => {
    const user = userEvent.setup()
    const c = seed((ch) => {
      ch.feats.choices[ASI_SLOT] = { kind: 'asi', abilityOption: 0, abilityChoices: {} }
    })
    renderSection()

    const asi = await card(ASI_LABEL)
    await user.click(asi.getByRole('radio', { name: /two ability scores/i }))
    expect(choiceOf(c.id, ASI_SLOT)?.abilityOption).toBe(1)

    await user.click(asi.getByRole('button', { name: 'Strength' }))
    await user.click(asi.getByRole('button', { name: 'Wisdom' }))
    expect(choiceOf(c.id, ASI_SLOT)?.abilityChoices).toEqual({ str: 1, wis: 1 })
    expect(asi.getByRole('button', { name: 'Dexterity' })).toBeDisabled()
    expect(asi.getByRole('button', { name: 'Wisdom' })).toBeEnabled()
  })

  it('places +2 on one ability with the improvement', async () => {
    const user = userEvent.setup()
    const c = seed((ch) => {
      ch.feats.choices[ASI_SLOT] = { kind: 'asi', abilityOption: 0, abilityChoices: {} }
    })
    renderSection()

    const asi = await card(ASI_LABEL)
    await user.click(asi.getByRole('button', { name: 'Strength' }))
    expect(choiceOf(c.id, ASI_SLOT)?.abilityChoices).toEqual({ str: 2 })
  })

  it('shows option notes and fixed options without ability checkboxes', async () => {
    seed((c) => {
      c.feats.choices[ASI_SLOT] = {
        kind: 'feat',
        feat: { name: 'Resilient', source: 'XPHB' },
        // A saved option index past the list falls back to the first.
        abilityOption: 5,
      }
    })
    renderSection()

    const asi = await card(ASI_LABEL)
    expect(
      asi.getByText('Gain proficiency in Strength saving throws.'),
    ).toBeInTheDocument()
    expect(asi.getAllByRole('radio')).toHaveLength(2)
    expect(asi.queryByRole('button', { name: 'Strength' })).not.toBeInTheDocument()
  })

  it('keeps a saved feat from an unselected book and flags a missing one', async () => {
    seed((c) => {
      c.feats.choices[RACE_SLOT] = {
        kind: 'feat',
        feat: { name: 'Lucky', source: 'PHB' },
      }
      c.feats.choices[BG_SLOT] = { kind: 'feat', feat: { name: 'Ghost', source: 'XPHB' } }
    })
    renderSection()

    const race = await card(RACE_LABEL)
    expect(race.getByRole('heading', { level: 3, name: 'Lucky' })).toBeInTheDocument()
    expect(race.getByText(/is not in the selected books/)).toBeInTheDocument()
    expect(race.getByText('Not in the Origin feat category')).toBeInTheDocument()

    const bg = await card(BG_LABEL)
    expect(bg.getByText('Feat not found in the data: Ghost (XPHB)')).toHaveClass(
      'text-danger',
    )
  })

  it('removes a saved feat that is not in the selected books', async () => {
    const user = userEvent.setup()
    const c = seed((ch) => {
      ch.feats.choices[RACE_SLOT] = {
        kind: 'feat',
        feat: { name: 'Lucky', source: 'PHB' },
      }
    })
    renderSection()

    await user.click(
      (await card(RACE_LABEL)).getByRole('button', { name: 'Remove feat' }),
    )
    expect(choiceOf(c.id, RACE_SLOT)).toBeUndefined()
  })

  it('adds and removes a bonus feat slot, its table open', async () => {
    const user = userEvent.setup()
    const c = seed((ch) => {
      ch.race = undefined
      ch.background = undefined
      ch.classes = []
    })
    renderSection()

    await user.click(await screen.findByRole('button', { name: 'Add bonus feat' }))
    const [id] = featsOf(c.id).bonusSlots
    expect(id).toMatch(/^bonus:/)

    await screen.findByRole('table', { name: 'Feats for Bonus feat' })
    await choose(user, 'Bonus feat', 'Archery')
    expect(choiceOf(c.id, id)?.feat?.name).toBe('Archery')

    await user.click((await card('Bonus feat')).getByRole('button', { name: 'Remove' }))
    expect(featsOf(c.id)).toEqual({ choices: {}, bonusSlots: [] })
    expect(screen.getByText(/No feat slots yet/)).toBeInTheDocument()
  })
})
