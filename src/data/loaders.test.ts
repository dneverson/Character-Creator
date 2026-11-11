import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadBooks } from './loaders'
import { fetchData } from './dataClient'
import type { BooksFile } from './types'

vi.mock('./dataClient', () => ({ fetchData: vi.fn() }))
const mockFetch = vi.mocked(fetchData)

beforeEach(() => {
  mockFetch.mockReset()
})

describe('loadBooks', () => {
  it('sorts core books first, then alphabetically by name', async () => {
    const file: BooksFile = {
      book: [
        { name: 'Xanathar', id: 'XGE', source: 'XGE', group: 'supplement' },
        { name: "Player's Handbook", id: 'PHB', source: 'PHB', group: 'core' },
        { name: "Dungeon Master's Guide", id: 'DMG', source: 'DMG', group: 'core' },
        { name: 'Acquisitions', id: 'AI', source: 'AI', group: 'supplement' },
      ],
    }
    mockFetch.mockResolvedValue(file)

    const books = await loadBooks()
    expect(books.map((b) => b.id)).toEqual(['DMG', 'PHB', 'AI', 'XGE'])
    expect(mockFetch).toHaveBeenCalledWith('books.json')
  })

  it('does not mutate the source array', async () => {
    const file: BooksFile = {
      book: [
        { name: 'B', id: 'B', source: 'B' },
        { name: 'A', id: 'A', source: 'A' },
      ],
    }
    mockFetch.mockResolvedValue(file)
    await loadBooks()
    expect(file.book.map((b) => b.id)).toEqual(['B', 'A'])
  })
})
