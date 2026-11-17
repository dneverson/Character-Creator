import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchData } from '../data/dataClient'
import type { Book } from '../data/types'
import type { Entry } from '../text/Entries'
import { listedFor, listedIn } from './listed'

vi.mock('../data/dataClient', () => ({ fetchData: vi.fn() }))
const mockData = vi.mocked(fetchData)

const chapter = (name: string): Entry => ({ type: 'section', name, entries: [] })
const book = (contents: Book['contents']): Book => ({
  name: 'B',
  id: 'B',
  source: 'B',
  contents,
})

beforeEach(() => vi.clearAllMocks())

describe('the names the contents list', () => {
  it('are kept by the chapter of the text they belong to, as slugs', () => {
    const listed = listedIn(
      book([
        {
          name: 'Appendix',
          headers: [{ header: 'Giant Ape', statblock: true }, 'Notes'],
        },
        { name: 'Basics', headers: ['Using This Book'] },
      ]),
      [chapter('Chapter 1: Basics'), chapter('Appendix A: Appendix')],
    )
    expect([...(listed.get(1) ?? [])]).toEqual(['giant-ape', 'notes'])
    expect([...(listed.get(0) ?? [])]).toEqual(['using-this-book'])
  })

  it('go by position when the names differ and the chapters are as many', () => {
    const listed = listedIn(book([{ name: 'Introduction', headers: ['A'] }]), [
      chapter('How to Use a Monster'),
    ])
    expect([...(listed.get(0) ?? [])]).toEqual(['a'])
  })

  it('are left out when the chapter cannot be placed, or there are no contents', () => {
    const text = [chapter('One'), chapter('Two')]
    expect(listedIn(book([{ name: 'Zed', headers: ['A'] }]), text).size).toBe(0)
    expect(listedIn(undefined, text).size).toBe(0)
    expect(listedIn(book([{ name: 'One' }]), text).get(0)?.size).toBe(0)
  })
})

describe('the contents of a document, from the catalog', () => {
  const contents = [{ name: 'One', headers: ['A'] }]

  it('reads a book from the books and an adventure from the adventures', async () => {
    mockData.mockImplementation((path) =>
      Promise.resolve(
        path === 'books.json'
          ? { book: [{ id: 'B', contents }] }
          : { adventure: [{ id: 'B', contents: [{ name: 'One', headers: ['Z'] }] }] },
      ),
    )
    const sections = [chapter('One')]
    expect([...((await listedFor('book', 'B', sections)).get(0) ?? [])]).toEqual(['a'])
    expect([...((await listedFor('adventure', 'B', sections)).get(0) ?? [])]).toEqual([
      'z',
    ])
  })

  it('is no names when the catalog cannot be had or lacks the document', async () => {
    mockData.mockRejectedValueOnce(new Error('404'))
    expect((await listedFor('book', 'B', [chapter('One')])).size).toBe(0)
    mockData.mockResolvedValueOnce({ book: [] })
    expect((await listedFor('book', 'B', [chapter('One')])).size).toBe(0)
  })
})
