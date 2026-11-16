import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchData } from './dataClient'
import { loadBookEditions } from './edition'
import { loadRewards } from './rewards'

vi.mock('./dataClient', () => ({ fetchData: vi.fn() }))
vi.mock('./edition', () => ({ loadBookEditions: vi.fn() }))
const mockFetch = vi.mocked(fetchData)

beforeEach(() => {
  mockFetch.mockReset()
  loadRewards.clear()
  vi.mocked(loadBookEditions).mockResolvedValue((source: string) =>
    source === 'XDMG' ? 'one' : 'classic',
  )
})

describe('loadRewards', () => {
  it('reads every reward with its key, kind and edition, by name', async () => {
    mockFetch.mockResolvedValue({
      reward: [
        { name: 'Boon of Speed', source: 'DMG', type: 'Boon', entries: ['Fast.'] },
        {
          name: 'Charm of Restoration',
          source: 'XDMG',
          additionalSpells: [
            { innate: { _: { limited: { '1': ['lesser restoration'] } } } },
          ],
        },
      ],
    })
    const rewards = await loadRewards()
    expect(rewards.map((r) => [r.key, r.type, r.edition, r.entries.length])).toEqual([
      ['Boon of Speed|DMG', 'Boon', 'classic', 1],
      ['Charm of Restoration|XDMG', 'Other', 'one', 0],
    ])
    expect(rewards[0].additionalSpells).toBeUndefined()
    expect(rewards[1].additionalSpells).toHaveLength(1)
  })

  it('is empty when the content has no rewards file', async () => {
    mockFetch.mockRejectedValue(new Error('404'))
    expect(await loadRewards()).toEqual([])
  })
})
