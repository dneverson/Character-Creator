import { beforeEach, describe, expect, it, vi } from 'vitest'
import { _clearBookSources, lookup } from '../data/glossary'
import { loadBookDocs } from './catalog'

vi.mock('../data/dataClient', () => ({
  fetchData: async (path: string): Promise<unknown> =>
    path === 'books.json'
      ? { book: [] }
      : {
          adventure: [
            {
              id: 'UtHftLH',
              source: 'UtHftLH',
              name: 'Uni and the Hunt for the Lost Horn',
            },
          ],
        },
}))

describe('the catalog of books and adventures', () => {
  beforeEach(() => _clearBookSources())

  it('teaches the source lookup the name of each adventure', async () => {
    await loadBookDocs()
    expect(lookup('UtHftLH', 'source')?.full).toBe('Uni and the Hunt for the Lost Horn')
  })
})
