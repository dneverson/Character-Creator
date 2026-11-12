import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProficienciesSection } from './ProficienciesSection'
import { sourceText } from './sourceText'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { useCharacterStore } from '../../character/store'
import { createCharacter } from '../../character/model'
import { loadBackgrounds, type PlayableBackground } from '../../data/background'
import { loadClasses, type LoadedClass } from '../../data/class'
import { loadRaces } from '../../data/race'
import { loadFeats } from '../../data/feats'
import { loadItems } from '../../data/items'
import { loadFightingStyleOptions } from '../../data/classOptions'
import { loadLanguages } from '../../data/languages'
import { settle } from '../../test/settle'
import { makeItem } from '../../test/itemFixtures'

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
  loadFightingStyleOptions: vi.fn(),
}))
vi.mock('../../data/languages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/languages')>()),
  loadLanguages: vi.fn(),
}))
vi.mock('../../data/items', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/items')>()),
  loadItems: vi.fn(),
}))

const fighter: LoadedClass = {
  entry: {
    name: 'Fighter',
    source: 'PHB',
    hd: { number: 1, faces: 10 },
    classFeatures: [],
    proficiency: ['str', 'con'],
    startingProficiencies: { armor: ['light', 'shield'], weapons: ['simple', 'martial'] },
  },
  file: {},
}

const artificer: LoadedClass = {
  entry: {
    name: 'Artificer',
    source: 'TCE',
    hd: { number: 1, faces: 8 },
    classFeatures: [],
    startingProficiencies: {
      weapons: ['simple', { proficiency: 'firearms', optional: true }],
    },
  },
  file: {},
}

const TOOLS = [
  makeItem({ name: "Smith's Tools", kind: 'tool', type: 'AT' }),
  makeItem({ name: "Mason's Tools", kind: 'tool', type: 'AT' }),
  makeItem({ name: 'Flute', kind: 'instrument', type: 'INS' }),
]

const background = (
  name: string,
  extra: Partial<PlayableBackground>,
): PlayableBackground => ({
  featGrants: [],
  key: `${name}|PHB`,
  name,
  source: 'PHB',
  edition: 'classic',
  abilityOptions: [],
  storyTables: [],
  entries: [],
  ...extra,
})

const guild = background('Guild Artisan', {
  toolProficiencies: [{ anyArtisansTool: 1 }],
  languageProficiencies: [{ anyStandard: 1 }],
})
const smith = background('Smith', {
  toolProficiencies: [{ "smith's tools": true }, { anyMusicalInstrument: 1 }],
})

function renderSection() {
  return render(
    <ThemeProvider>
      <ProficienciesSection />
    </ThemeProvider>,
  )
}

function seed(mutate: (c: ReturnType<typeof createCharacter>) => void) {
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

const active = (id: string) => useCharacterStore.getState().characters[id]

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.mocked(loadClasses).mockResolvedValue([fighter, artificer])
  vi.mocked(loadBackgrounds).mockResolvedValue([guild, smith])
  vi.mocked(loadRaces).mockResolvedValue([])
  vi.mocked(loadFeats).mockResolvedValue([])
  vi.mocked(loadItems).mockResolvedValue(TOOLS)
  vi.mocked(loadFightingStyleOptions).mockResolvedValue([])
  vi.mocked(loadLanguages).mockResolvedValue([
    { name: 'Dwarvish', entries: [{ source: 'PHB', type: 'standard' }] },
    { name: 'Abyssal', entries: [{ source: 'PHB', type: 'exotic' }] },
    { name: "Thieves' Cant", entries: [{ source: 'PHB', type: 'secret' }] },
  ])
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

/** A row of a pick card's table, found by the option's name. */
const findRow = async (name: string) => {
  const cell = (await screen.findAllByText(name)).find((el) => el.closest('tbody tr'))
  return cell?.closest('tr') as HTMLElement
}

describe('ProficienciesSection', () => {
  it('renders nothing without an active character', async () => {
    const { container } = renderSection()
    expect(container).toBeEmptyDOMElement()
    await settle()
  })

  it('lists each kind with the sources that give it', async () => {
    seed((c) => {
      c.classes = [{ name: 'Fighter', source: 'PHB', level: 1 }]
      c.background = { name: 'Guild Artisan', source: 'PHB', abilityChoices: {} }
    })
    renderSection()

    const saves = await screen.findByRole('table', { name: 'Saving throws' })
    expect(within(saves).getByText('Strength')).toBeInTheDocument()
    expect(within(saves).getAllByText('Fighter').length).toBeGreaterThan(0)
    const armor = screen.getByRole('table', { name: 'Armor' })
    expect(within(armor).getByText('Shields')).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Weapons' })).toBeInTheDocument()
    expect(screen.getAllByText('None.').length).toBeGreaterThan(0)
    expect(screen.getByText('2 picks left')).toBeInTheDocument()
  })

  it('charges a pick to the card clicked and lists it with its source', async () => {
    const user = userEvent.setup()
    const c = seed((ch) => {
      ch.background = { name: 'Guild Artisan', source: 'PHB', abilityChoices: {} }
    })
    renderSection()

    // The card lists every standard language, not the exotic or secret ones.
    expect(await findRow('Dwarvish')).toBeInTheDocument()
    expect(screen.queryByText('Abyssal')).not.toBeInTheDocument()
    await user.click(
      within(await findRow('Dwarvish')).getByRole('button', { name: 'Choose' }),
    )
    await waitFor(() => expect(active(c.id).grantPicks.language?.dwarvish).toBe('bg'))
    const languages = await screen.findByRole('table', { name: 'Languages' })
    expect(within(languages).getByText('Dwarvish')).toBeInTheDocument()
    expect(within(languages).getByText('Guild Artisan (background)')).toBeInTheDocument()

    // An artisan's tool is picked the same way, from the tools of the books.
    await user.click(
      within(await findRow("Mason's Tools")).getByRole('button', { name: 'Choose' }),
    )
    await waitFor(() =>
      expect(active(c.id).grantPicks.tool?.["mason's tools"]).toBe('bg'),
    )
    expect(screen.queryByRole('button', { name: /^Flute/ })).not.toBeInTheDocument()
  })

  it('takes one of two alternatives and drops the picks of the other', async () => {
    const user = userEvent.setup()
    const c = seed((ch) => {
      ch.background = { name: 'Smith', source: 'PHB', abilityChoices: {} }
      ch.grantAlt = { 'bg|toolProficiencies': 1 }
      ch.grantPicks = { tool: { flute: 'bg' } }
    })
    renderSection()

    const group = await screen.findByRole('group', {
      name: /Background - Smith: take one of/,
    })
    expect(
      within(group).getByRole('button', { name: /musical instrument/ }),
    ).toHaveAttribute('aria-pressed', 'true')
    // Back to the first alternative: the instrument pick no longer applies.
    await user.click(within(group).getByRole('button', { name: "Smith's Tools" }))
    await waitFor(() => expect(active(c.id).grantAlt['bg|toolProficiencies']).toBe(0))
    expect(active(c.id).grantPicks.tool).toEqual({})
  })

  it('switches an optional grant on and says it depends on the DM', async () => {
    const user = userEvent.setup()
    const c = seed((ch) => {
      ch.classes = [{ name: 'Artificer', source: 'TCE', level: 1 }]
    })
    renderSection()

    expect(await screen.findByText('Optional - depends on your DM')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: /Firearms/ }))
    await waitFor(() =>
      expect(
        active(c.id).grantAlt['class:Artificer|TCE|weaponProficiencies|optional0'],
      ).toBe(1),
    )
    const weapons = await screen.findByRole('table', { name: 'Weapons' })
    expect(within(weapons).getByText('Firearms')).toBeInTheDocument()
  })

  it('flags a pick outside every list and lets a stray one be taken back', async () => {
    const user = userEvent.setup()
    const c = seed((ch) => {
      ch.grantPicks = { language: { sylvan: 'gone' } }
    })
    renderSection()

    await user.click(await screen.findByRole('button', { name: 'Show' }))
    await user.click(screen.getByRole('button', { name: 'Abyssal' }))
    await waitFor(() => expect(active(c.id).grantPicks.language?.abyssal).toBe('manual'))
    expect(screen.getAllByText('Non-standard').length).toBeGreaterThan(0)
    const languages = await screen.findByRole('table', { name: 'Languages' })
    expect(
      within(languages).getAllByText('Non-standard (DM approval)').length,
    ).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'sylvan (gone)' }))
    await waitFor(() => expect(active(c.id).grantPicks.language?.sylvan).toBeUndefined())
  })

  it('names the kind of a source that is not a class', () => {
    expect(sourceText({ kind: 'race', tag: 'race', label: 'Elf' })).toBe('Elf (race)')
    expect(sourceText({ kind: 'class', tag: 'class:F|PHB', label: 'Fighter' })).toBe(
      'Fighter',
    )
  })
})
