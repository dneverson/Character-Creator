import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClassFeatures } from './ClassFeatures'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { useCharacterStore } from '../../character/store'
import { createCharacter } from '../../character/model'
import {
  featuresForClass,
  loadClasses,
  type LoadedClass,
  type ResolvedFeature,
} from '../../data/class'
import { loadBackgrounds } from '../../data/background'
import { loadRaces } from '../../data/race'
import { loadFeats } from '../../data/feats'
import { loadItems } from '../../data/items'
import { loadClassOptions, type ClassOption } from '../../data/classOptions'
import { loadLanguages } from '../../data/languages'
import { settle } from '../../test/settle'

vi.mock('../../data/class', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/class')>()
  return {
    ...actual,
    loadClasses: vi.fn(),
    featuresForClass: vi.fn(),
  }
})
// The option cards come from the derived sheet, which loads these too.
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
const mockClasses = vi.mocked(loadClasses)
// Feature resolution (levels, subclass replacement) is unit-tested in data/class.test.ts;
// here the component renders whatever list it is handed.
const mockFeatures = vi.mocked(featuresForClass)

const fighter: LoadedClass = {
  entry: {
    name: 'Fighter',
    source: 'PHB',
    edition: 'classic',
    hd: { number: 1, faces: 10 },
    classFeatures: [],
    classTableGroups: [
      { colLabels: ['Maneuvers'], rows: [['-'], ['Action Surge'], ['-']] },
    ],
  },
  file: {},
}

const featureList: ResolvedFeature[] = [
  { level: 1, name: 'Fighting Style', entries: ['Pick a style.'] },
  { level: 2, name: 'Action Surge', entries: ['Take an extra action.'] },
]

function seedActive(mutate: (c: ReturnType<typeof createCharacter>) => void = () => {}) {
  const c = createCharacter('Tordek')
  c.selectedBooks = ['PHB']
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
      <ClassFeatures />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mockClasses.mockResolvedValue([fighter])
  mockFeatures.mockReturnValue(featureList)
  vi.mocked(loadBackgrounds).mockResolvedValue([])
  vi.mocked(loadRaces).mockResolvedValue([])
  vi.mocked(loadFeats).mockResolvedValue([])
  vi.mocked(loadClassOptions).mockResolvedValue([])
  vi.mocked(loadLanguages).mockResolvedValue([])
  vi.mocked(loadItems).mockResolvedValue([])
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

describe('ClassFeatures', () => {
  it('renders nothing without an active character', async () => {
    const { container } = renderSection()
    expect(container).toBeEmptyDOMElement()
    // Still nothing once the section data has loaded.
    await settle()
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the character has no classes', async () => {
    seedActive()
    const { container } = renderSection()
    expect(container).toBeEmptyDOMElement()
    // Still nothing once the section data has loaded.
    await settle()
    expect(container).toBeEmptyDOMElement()
  })

  it('flags a subclass slot and skips classes with no loaded data', async () => {
    mockFeatures.mockReturnValue([
      { level: 3, name: 'Martial Archetype', entries: [], isSubclassSlot: true },
    ])
    seedActive((c) => {
      c.classes = [
        { name: 'Fighter', source: 'PHB', level: 3 },
        // A chosen class with no matching loaded data renders nothing.
        { name: 'Ghost', source: 'ZZZ', level: 1 },
      ]
    })
    renderSection()

    expect(await screen.findByText('choose subclass')).toBeInTheDocument()
    expect(screen.getByText('Select a subclass to see this feature.')).toBeInTheDocument()
    // The unloaded "Ghost" class contributes no card.
    expect(screen.queryByText(/Ghost/)).not.toBeInTheDocument()
  })

  it('lists per-level features and the class table for a chosen class', async () => {
    seedActive((c) => {
      c.classes = [{ name: 'Fighter', source: 'PHB', level: 3 }]
    })
    renderSection()

    expect(await screen.findByText('Fighter 3')).toBeInTheDocument()
    expect(screen.getByText('2014')).toBeInTheDocument()
    // The resolved features are shown.
    expect(screen.getByText('Fighting Style')).toBeInTheDocument()
    // "Action Surge" appears both as a feature and in the class table row.
    expect(screen.getAllByText('Action Surge').length).toBeGreaterThan(0)
    // The class table renders its own column header beside Level, Proficiency Bonus and Features.
    expect(screen.getByRole('columnheader', { name: 'Maneuvers' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Features' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'PB' })).toBeInTheDocument()
  })

  it('formats bonus, speed, dice, numeric, and unknown table cells', async () => {
    const richFighter: LoadedClass = {
      entry: {
        name: 'Fighter',
        source: 'PHB',
        edition: 'classic',
        hd: { number: 1, faces: 10 },
        classFeatures: [],
        classTableGroups: [
          {
            colLabels: ['Prof', 'Speed', 'Dice', 'Count', 'Odd', 'Empty'],
            rows: [
              [
                { type: 'bonus', value: 2 },
                { type: 'bonusSpeed', value: 10 },
                { type: 'dice', toRoll: [{ number: 2, faces: 6 }] },
                3,
                { type: 'dice' }, // no toRoll -> empty
                { type: 'mystery' }, // unknown type -> empty
              ],
            ],
          },
          // A spell-slot group carries rows under rowsSpellProgression.
          { colLabels: ['Slots'], rowsSpellProgression: [[2]] },
          // A group with neither rows nor progression falls back to [] and renders nothing.
          { colLabels: ['Blank'] },
        ],
      },
      file: {},
    }
    mockClasses.mockResolvedValue([richFighter])
    seedActive((c) => {
      c.classes = [{ name: 'Fighter', source: 'PHB', level: 1 }]
    })
    renderSection()

    // The table's own bonus cell (the Proficiency Bonus column adds +2 on its rows too).
    expect((await screen.findAllByText('+2')).length).toBeGreaterThan(1)
    expect(screen.getByText('+10 ft.')).toBeInTheDocument()
    expect(screen.getByText('2d6')).toBeInTheDocument()
    // A bare numeric cell is stringified.
    expect(screen.getAllByRole('cell', { name: '3' }).length).toBeGreaterThan(0)
    // The spell-progression group renders; the empty-row group does not.
    expect(screen.getByRole('columnheader', { name: 'Slots' })).toBeInTheDocument()
    // A group with no rows still has its (empty) column, and the odd cells are empty.
    expect(screen.getByRole('columnheader', { name: 'Blank' })).toBeInTheDocument()
  })

  it('prints the level table of a casting subclass under the class table', async () => {
    const knight: LoadedClass = {
      ...fighter,
      file: {
        subclass: [
          {
            name: 'Eldritch Knight',
            shortName: 'Eldritch Knight',
            source: 'PHB',
            className: 'Fighter',
            classSource: 'PHB',
            edition: 'classic',
            subclassFeatures: [],
            subclassTableGroups: [{ colLabels: ['Spells Known'], rows: [[0], [0], [3]] }],
          },
        ],
      },
    }
    mockClasses.mockResolvedValue([knight])
    seedActive((c) => {
      c.classes = [
        {
          name: 'Fighter',
          source: 'PHB',
          level: 3,
          subclass: {
            name: 'Eldritch Knight',
            shortName: 'Eldritch Knight',
            source: 'PHB',
          },
        },
      ]
    })
    renderSection()

    const table = await screen.findByRole('table', {
      name: 'Eldritch Knight level table',
    })
    expect(
      within(table).getByRole('columnheader', { name: 'Spells Known' }),
    ).toBeVisible()
    expect(screen.getByRole('table', { name: 'Fighter level table' })).toBeInTheDocument()
  })

  it('shows resolved subclass features and hides the placeholder slot', async () => {
    // featuresForClass already replaced the placeholder slot with the subclass feature.
    mockFeatures.mockReturnValue([
      { level: 3, name: 'Improved Critical', entries: ['Crit on 19-20.'] },
    ])
    seedActive((c) => {
      c.classes = [
        {
          name: 'Fighter',
          source: 'PHB',
          level: 3,
          subclass: { name: 'Champion', shortName: 'Champion', source: 'PHB' },
        },
      ]
    })
    renderSection()

    // The chosen subclass is handed to feature resolution, and its feature renders.
    expect(await screen.findByText('Improved Critical')).toBeInTheDocument()
    expect(mockFeatures).toHaveBeenCalledWith(
      fighter,
      expect.objectContaining({
        subclass: expect.objectContaining({ shortName: 'Champion' }),
      }),
    )
    expect(screen.queryByText('Martial Archetype')).not.toBeInTheDocument()
    // The subclass name shows as a header badge.
    expect(screen.getByText('Champion')).toBeInTheDocument()
  })

  it('notes when a chosen class has no features at its level', async () => {
    mockFeatures.mockReturnValue([])
    const plain: LoadedClass = {
      entry: {
        name: 'Fighter',
        source: 'PHB',
        edition: 'classic',
        hd: { number: 1, faces: 10 },
        classFeatures: [],
      },
      file: {},
    }
    mockClasses.mockResolvedValue([plain])
    seedActive((c) => {
      c.classes = [{ name: 'Fighter', source: 'PHB', level: 1 }]
    })
    renderSection()

    expect(await screen.findByText('No features at this level.')).toBeInTheDocument()
  })

  it('leaves the fighting style to Combat and offers the other options here', async () => {
    const styled: LoadedClass = {
      ...fighter,
      entry: {
        ...fighter.entry,
        optionalfeatureProgression: [
          { name: 'Fighting Style', featureType: ['FS:F'], progression: { '1': 1 } },
          { name: 'Maneuvers', featureType: ['MV:B'], progression: { '1': 1 } },
        ],
      },
    }
    const options: ClassOption[] = [
      {
        key: 'Defense|PHB',
        name: 'Defense',
        source: 'PHB',
        types: ['FS:F'],
        entries: ['While you are wearing armor, you gain a +1 bonus to AC.'],
      },
      {
        key: 'Parry|PHB',
        name: 'Parry',
        source: 'PHB',
        types: ['MV:B'],
        entries: ['Reduce the damage by the number you roll.'],
      },
    ]
    mockClasses.mockResolvedValue([styled])
    vi.mocked(loadClassOptions).mockResolvedValue(options)
    seedActive((ch) => {
      ch.classes = [{ name: 'Fighter', source: 'PHB', level: 1 }]
    })
    renderSection()

    expect(await screen.findByText('Parry')).toBeInTheDocument()
    expect(screen.queryByText('Class - Fighter fighting style')).toBeNull()
    expect(screen.queryByText('Defense')).toBeNull()
  })

  it('greys an option whose prerequisite is not met and still allows it with DM approval', async () => {
    const user = userEvent.setup()
    const warlock: LoadedClass = {
      entry: {
        name: 'Warlock',
        source: 'PHB',
        edition: 'classic',
        hd: { number: 1, faces: 8 },
        classFeatures: [],
        optionalfeatureProgression: [
          { name: 'Eldritch Invocations', featureType: ['EI'], progression: [0, 2] },
        ],
      },
      file: {},
    }
    mockClasses.mockResolvedValue([warlock])
    mockFeatures.mockReturnValue([])
    vi.mocked(loadClassOptions).mockResolvedValue([
      {
        key: 'Agonizing Blast|PHB',
        name: 'Agonizing Blast',
        source: 'PHB',
        types: ['EI'],
        entries: ['Add your Charisma modifier to the damage.'],
        prerequisite: [{ spell: ['eldritch blast#c'] }],
      },
      {
        key: "Devil's Sight|PHB",
        name: "Devil's Sight",
        source: 'PHB',
        types: ['EI'],
        entries: ['You can see normally in darkness.'],
      },
    ])
    const c = seedActive((ch) => {
      ch.classes = [{ name: 'Warlock', source: 'PHB', level: 2 }]
    })
    renderSection()

    expect(
      await screen.findByText('Class - Warlock eldritch invocations'),
    ).toBeInTheDocument()
    expect(screen.getByText('2 of 2 left')).toBeInTheDocument()
    // The unmet one is greyed with its reason and waits for the DM approval switch.
    expect(screen.getByLabelText('Show choices that are not available')).toBeChecked()
    const rowOf = () =>
      screen
        .getAllByText('Agonizing Blast')
        .map((el) => el.closest('tr'))
        .find((tr): tr is HTMLTableRowElement => tr !== null) as HTMLElement
    expect(
      within(rowOf()).getByText(
        /Needs The Eldritch Blast cantrip - allowed with DM approval/,
      ),
    ).toBeInTheDocument()
    expect(within(rowOf()).getByRole('button', { name: 'Choose' })).toBeDisabled()
    await user.click(screen.getByLabelText('Allow non-standard choices (DM approval)'))
    await user.click(within(rowOf()).getByRole('button', { name: 'Choose' }))
    expect(useCharacterStore.getState().characters[c.id].classOptions).toEqual({
      'class:Warlock|PHB|EI': ['Agonizing Blast|PHB'],
    })
  })
})
