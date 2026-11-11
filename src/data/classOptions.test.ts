import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchData } from './dataClient'
import { loadFightingStyleOptions } from './classOptions'

vi.mock('./dataClient', () => ({ fetchData: vi.fn() }))
const mockFetch = vi.mocked(fetchData)

beforeEach(() => {
  vi.clearAllMocks()
  loadFightingStyleOptions.clear()
})

describe('loadFightingStyleOptions', () => {
  it('keeps the fighting styles with the classes they are offered to, by name', async () => {
    mockFetch.mockResolvedValue({
      optionalfeature: [
        { name: 'Metamagic: Quickened Spell', source: 'PHB', featureType: ['MM'] },
        { name: 'Protection', source: 'PHB', featureType: ['FS:F', 'FS:P'] },
        { name: 'Archery', source: 'PHB', featureType: ['FS:F', 'FS:R'] },
        { name: 'Unlisted', source: 'PHB' },
      ],
    })
    expect(await loadFightingStyleOptions()).toEqual([
      { key: 'Archery|PHB', name: 'Archery', source: 'PHB', types: ['FS:F', 'FS:R'] },
      {
        key: 'Protection|PHB',
        name: 'Protection',
        source: 'PHB',
        types: ['FS:F', 'FS:P'],
      },
    ])
  })
})
