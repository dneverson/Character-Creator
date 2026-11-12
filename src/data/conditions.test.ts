import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadConditions } from './conditions'
import { fetchData } from './dataClient'

vi.mock('./dataClient', () => ({ fetchData: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  loadConditions.clear()
})

describe('loadConditions', () => {
  it('reads the name, book and text of each condition', async () => {
    vi.mocked(fetchData).mockResolvedValue({
      condition: [
        { name: 'Prone', source: 'PHB', page: 292, entries: ['A prone creature...'] },
      ],
    })
    expect(await loadConditions()).toEqual([
      { name: 'Prone', source: 'PHB', entries: ['A prone creature...'] },
    ])
  })
})
