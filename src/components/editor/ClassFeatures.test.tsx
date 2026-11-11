import { render, screen } from '@testing-library/react'
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
import { settle } from '../../test/settle'

vi.mock('../../data/class', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/class')>()
  return {
    ...actual,
    loadClasses: vi.fn(),
    featuresForClass: vi.fn(),
  }
})
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
      { colLabels: ['Features'], rows: [['-'], ['Action Surge'], ['-']] },
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
    // The resolved features are shown.
    expect(screen.getByText('Fighting Style')).toBeInTheDocument()
    // "Action Surge" appears both as a feature and in the class table row.
    expect(screen.getAllByText('Action Surge').length).toBeGreaterThan(0)
    // The class table renders its column header.
    expect(screen.getByRole('columnheader', { name: 'Features' })).toBeInTheDocument()
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

    expect(await screen.findByText('+2')).toBeInTheDocument()
    expect(screen.getByText('+10 ft.')).toBeInTheDocument()
    expect(screen.getByText('2d6')).toBeInTheDocument()
    // A bare numeric cell is stringified.
    expect(screen.getByRole('cell', { name: '3' })).toBeInTheDocument()
    // The spell-progression group renders; the empty-row group does not.
    expect(screen.getByRole('columnheader', { name: 'Slots' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Blank' })).not.toBeInTheDocument()
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
})
