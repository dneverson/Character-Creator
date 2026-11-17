import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchData, fetchDataUncached } from '../data/dataClient'
import { fixtureFile } from '../test/bookFixture'
import { docPath, loadBookDocs } from './catalog'
import { _clearBookTexts, loadBookText, readBookText, sectionsOf } from './load'

vi.mock('../data/dataClient', () => ({
  fetchData: vi.fn(),
  fetchDataUncached: vi.fn(),
}))
const mockData = vi.mocked(fetchData)
const mockText = vi.mocked(fetchDataUncached)

beforeEach(() => {
  vi.clearAllMocks()
  _clearBookTexts()
  loadBookDocs.clear()
})

describe('the catalog of documents', () => {
  it('names the text file of a book and of an adventure', () => {
    expect(docPath('book', 'PHB')).toBe('book/book-phb.json')
    expect(docPath('adventure', 'CoS')).toBe('adventure/adventure-cos.json')
  })

  it('lists every book, then every adventure', async () => {
    mockData.mockImplementation((path) =>
      Promise.resolve(
        path === 'books.json'
          ? { book: [{ id: 'PHB', name: "Player's Handbook", group: 'core', cover: {} }] }
          : { adventure: [{ id: 'CoS', name: 'Curse', storyline: 'Strahd' }] },
      ),
    )
    const docs = await loadBookDocs()
    expect(docs.map((d) => [d.kind, d.id, d.name])).toEqual([
      ['book', 'PHB', "Player's Handbook"],
      ['adventure', 'CoS', 'Curse'],
    ])
    expect(docs[1].storyline).toBe('Strahd')
  })

  it('lists only the books when there is no adventure catalog', async () => {
    mockData.mockImplementation((path) =>
      path === 'books.json'
        ? Promise.resolve({ book: [{ id: 'PHB', name: 'P' }] })
        : Promise.reject(new Error('404')),
    )
    expect((await loadBookDocs()).map((d) => d.id)).toEqual(['PHB'])
  })

  it('tolerates a catalog with no list', async () => {
    mockData.mockResolvedValue({})
    expect(await loadBookDocs()).toEqual([])
  })
})

describe('the text of a document', () => {
  beforeEach(() => mockText.mockResolvedValue(fixtureFile))

  it('reads the chapters of a text file, or nothing from another file', () => {
    expect(sectionsOf(fixtureFile, 'TST')).toHaveLength(2)
    expect(sectionsOf({ other: 1 }, 'TST')).toBeNull()
  })

  it('is read with what it holds', async () => {
    const text = await readBookText('book', 'TST')
    expect(mockText).toHaveBeenCalledWith('book/book-tst.json')
    expect(text.sections).toHaveLength(2)
    expect(text.scan.headings).toHaveLength(5)
  })

  it('is an error for a file that is not a book text', async () => {
    mockText.mockResolvedValue({ nothing: true })
    await expect(readBookText('book', 'TST')).rejects.toThrow('not a book text')
  })

  it('is read once while it is among the last few read', async () => {
    const first = await loadBookText('book', 'TST')
    expect(await loadBookText('book', 'TST')).toBe(first)
    expect(mockText).toHaveBeenCalledTimes(1)
  })

  it('lets the oldest go after the last few', async () => {
    for (const id of ['A', 'B', 'C', 'D']) await loadBookText('book', id)
    expect(mockText).toHaveBeenCalledTimes(4)
    await loadBookText('book', 'D')
    expect(mockText).toHaveBeenCalledTimes(4)
    await loadBookText('book', 'A')
    expect(mockText).toHaveBeenCalledTimes(5)
  })

  it('does not keep a failure', async () => {
    mockText.mockRejectedValueOnce(new Error('offline'))
    await expect(loadBookText('book', 'TST')).rejects.toThrow('offline')
    await expect(loadBookText('book', 'TST')).resolves.toBeTruthy()
  })
})
