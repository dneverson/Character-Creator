import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchData } from './dataClient'
import {
  isRepeatable,
  loadClassOptions,
  progressionCount,
  readProgressions,
  requiredAt,
} from './classOptions'

vi.mock('./dataClient', () => ({ fetchData: vi.fn() }))
const mockFetch = vi.mocked(fetchData)

beforeEach(() => {
  vi.clearAllMocks()
  loadClassOptions.clear()
})

describe('loadClassOptions', () => {
  it('keeps every option that has a feature type, by name, with what it teaches', async () => {
    mockFetch.mockResolvedValue({
      optionalfeature: [
        { name: 'Quickened Spell', source: 'PHB', featureType: ['MM'] },
        { name: 'Protection', source: 'PHB', featureType: ['FS:F', 'FS:P'] },
        {
          name: 'Archery',
          source: 'PHB',
          featureType: ['FS:F', 'FS:R'],
          entries: ['You gain a +2 bonus to attack rolls you make with ranged weapons.'],
        },
        {
          name: 'Superior Technique',
          source: 'TCE',
          featureType: ['FS:F'],
          entries: [],
          optionalfeatureProgression: [
            { name: 'Maneuvers', featureType: ['MV:B'], progression: { '*': 1 } },
          ],
        },
        { name: 'Unlisted', source: 'PHB' },
      ],
    })
    expect(await loadClassOptions()).toEqual([
      {
        key: 'Archery|PHB',
        name: 'Archery',
        source: 'PHB',
        types: ['FS:F', 'FS:R'],
        entries: ['You gain a +2 bonus to attack rolls you make with ranged weapons.'],
      },
      {
        key: 'Protection|PHB',
        name: 'Protection',
        source: 'PHB',
        types: ['FS:F', 'FS:P'],
        entries: [],
      },
      {
        key: 'Quickened Spell|PHB',
        name: 'Quickened Spell',
        source: 'PHB',
        types: ['MM'],
        entries: [],
      },
      {
        key: 'Superior Technique|TCE',
        name: 'Superior Technique',
        source: 'TCE',
        types: ['FS:F'],
        entries: [],
        optionalfeatureProgression: [
          { name: 'Maneuvers', featureType: ['MV:B'], progression: { '*': 1 } },
        ],
      },
    ])
  })
})

describe('readProgressions', () => {
  it('reads both shapes of the count and the options known outright', () => {
    expect(
      readProgressions([
        { name: 'Eldritch Invocations', featureType: ['EI'], progression: [0, 2, 'x'] },
        {
          name: 'Elemental Disciplines',
          featureType: ['ED'],
          progression: { '3': 2, '6': 'x' },
          required: { '3': ['Elemental Attunement|PHB', 4], '6': 'none' },
        },
      ]),
    ).toEqual([
      { name: 'Eldritch Invocations', featureType: ['EI'], progression: [0, 2, 0] },
      {
        name: 'Elemental Disciplines',
        featureType: ['ED'],
        progression: { '3': 2 },
        required: { '3': ['Elemental Attunement|PHB'], '6': [] },
      },
    ])
  })

  it('drops what is not a progression', () => {
    expect(readProgressions(undefined)).toEqual([])
    expect(
      readProgressions([
        'text',
        { name: 'No types', featureType: [], progression: [1] },
        { name: 'No count', featureType: ['EI'] },
        { featureType: ['EI'], progression: [1] },
      ]),
    ).toEqual([])
  })
})

describe('progressionCount', () => {
  it('reads a list by level, from 1', () => {
    const list = [0, 2, 2, 2, 3]
    expect(progressionCount(list, 0)).toBe(0)
    expect(progressionCount(list, 1)).toBe(0)
    expect(progressionCount(list, 2)).toBe(2)
    expect(progressionCount(list, 5)).toBe(3)
    expect(progressionCount(list, 20)).toBe(3)
  })

  it('reads levels as the total known from that level on', () => {
    const levels = { '3': 3, '7': 5, '10': 7, '15': 9 }
    expect(progressionCount(levels, 2)).toBe(0)
    expect(progressionCount(levels, 3)).toBe(3)
    expect(progressionCount(levels, 9)).toBe(5)
    expect(progressionCount(levels, 20)).toBe(9)
  })

  it('gives a feat its count at every level', () => {
    expect(progressionCount({ '*': 2 }, 1)).toBe(2)
  })
})

describe('requiredAt', () => {
  it('knows the options required by the level', () => {
    const p = {
      name: 'Elemental Disciplines',
      featureType: ['ED'],
      progression: { '3': 2 },
      required: { '3': ['Elemental Attunement|PHB'] },
    }
    expect(requiredAt(p, 2)).toEqual([])
    expect(requiredAt(p, 3)).toEqual(['Elemental Attunement|PHB'])
    expect(requiredAt({ ...p, required: undefined }, 3)).toEqual([])
  })
})

describe('isRepeatable', () => {
  it('finds a Repeatable block at any depth', () => {
    expect(isRepeatable({ entries: ['Plain.'] })).toBe(false)
    expect(
      isRepeatable({
        entries: [
          {
            type: 'entries',
            entries: [{ type: 'entries', name: 'Repeatable', entries: [] }],
          },
        ],
      }),
    ).toBe(true)
  })
})
