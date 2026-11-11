import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchData } from './dataClient'
import { editionOfPublished, loadBookEditions, ONE_RULES_FROM } from './edition'

vi.mock('./dataClient', () => ({ fetchData: vi.fn() }))
const mockFetch = vi.mocked(fetchData)

beforeEach(() => mockFetch.mockReset())

describe('editionOfPublished', () => {
  it('is the 2024 edition from the day the 2024 Player Handbook came out', () => {
    expect(editionOfPublished(ONE_RULES_FROM)).toBe('one')
    expect(editionOfPublished('2026-01-01')).toBe('one')
    expect(editionOfPublished('2024-09-16')).toBe('classic')
    expect(editionOfPublished('2014-08-19')).toBe('classic')
  })

  it('takes a book with no date for the 2014 edition', () => {
    expect(editionOfPublished(undefined)).toBe('classic')
  })
})

describe('loadBookEditions', () => {
  it('answers by the date each book was published, and 2014 for a book it does not list', async () => {
    mockFetch.mockResolvedValue({
      book: [
        { source: 'PHB', published: '2014-08-19' },
        { source: 'XPHB', published: '2024-09-17' },
      ],
    })
    const editionOfBook = await loadBookEditions()
    expect(editionOfBook('PHB')).toBe('classic')
    expect(editionOfBook('XPHB')).toBe('one')
    expect(editionOfBook('NOPE')).toBe('classic')
  })

  it('copes with a books file that has no list', async () => {
    mockFetch.mockResolvedValue({})
    expect((await loadBookEditions())('PHB')).toBe('classic')
  })
})
