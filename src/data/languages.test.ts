import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchData } from './dataClient'
import { loadLanguages } from './languages'

vi.mock('./dataClient', () => ({ fetchData: vi.fn() }))
const mockFetch = vi.mocked(fetchData)

beforeEach(() => {
  vi.clearAllMocks()
  loadLanguages.clear()
})

describe('loadLanguages', () => {
  it('reads each language once, with the type each book gives it', async () => {
    mockFetch.mockResolvedValue({
      language: [
        { name: 'Elvish', source: 'PHB', type: 'standard' },
        { name: 'Draconic', source: 'PHB', type: 'exotic' },
        { name: 'Draconic', source: 'XPHB', type: 'standard' },
        { name: 'Draconic', source: 'DMG', type: 'standard' },
        { name: 'Signs', source: 'PHB' },
      ],
    })
    expect(await loadLanguages()).toMatchObject([
      {
        name: 'Draconic',
        entries: [
          { source: 'PHB', type: 'exotic' },
          { source: 'XPHB', type: 'standard' },
          { source: 'DMG', type: 'standard' },
        ],
      },
      { name: 'Elvish', entries: [{ source: 'PHB', type: 'standard' }] },
      { name: 'Signs', entries: [{ source: 'PHB', type: 'standard' }] },
    ])
  })

  it('keeps the script and the typical speakers of a language', async () => {
    mockFetch.mockResolvedValue({
      language: [
        {
          name: 'Dwarvish',
          source: 'PHB',
          type: 'standard',
          script: 'Dwarvish',
          typicalSpeakers: ['Dwarves'],
        },
        { name: 'Dwarvish', source: 'XPHB', typicalSpeakers: ['Dwarves', 'Gnomes'] },
      ],
    })
    expect(await loadLanguages()).toMatchObject([
      { name: 'Dwarvish', script: 'Dwarvish', speakers: ['Dwarves', 'Gnomes'] },
    ])
  })
})
