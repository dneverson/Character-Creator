import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { _resetIndex } from '../../books/indexState'
import { loadBookText, readBookText } from '../../books/load'
import { scan } from '../../books/outline'
import { openBook, useBookStore } from '../../books/state'
import { useContentStatus } from '../../content/library'
import { useContentSettings } from '../../content/settings'
import { fixtureDoc, fixtureSections } from '../../test/bookFixture'
import { fakeLibrary } from '../../test/fakeLibrary'
import { BooksView } from './BooksView'

vi.mock('../../content', async () => ({
  contentLibrary: (await import('../../test/fakeLibrary')).fakeLibrary,
}))
vi.mock('../../books/load', () => ({ loadBookText: vi.fn(), readBookText: vi.fn() }))
vi.mock('../../books/catalog', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../books/catalog')>()),
  loadBookDocs: vi.fn(),
}))
vi.mock('../../content/useCoverThumb', () => ({
  useCoverThumb: () => ({ status: 'none' }),
}))

const catalog = await import('../../books/catalog')
const text = { sections: fixtureSections, scan: scan(fixtureSections) }

beforeEach(() => {
  vi.clearAllMocks()
  _resetIndex()
  useContentStatus.setState({ epoch: 0 })
  useContentSettings.setState({ fullContent: false })
  useBookStore.setState({ open: false, place: null, request: 0 })
  vi.mocked(catalog.loadBookDocs).mockResolvedValue([fixtureDoc])
  vi.mocked(loadBookText).mockRejectedValue(new Error('not stored'))
  vi.mocked(readBookText).mockRejectedValue(new Error('not stored'))
  fakeLibrary.has.mockResolvedValue(false)
})

describe('the books with only the free rules in use', () => {
  it('offers the full content on the shelf', async () => {
    render(<BooksView />)
    act(() => openBook(null))
    const button = await screen.findByRole(
      'button',
      { name: 'Download the full content' },
      { timeout: 3000 },
    )
    fireEvent.click(button)
    expect(fakeLibrary.enable).toHaveBeenCalled()
  })

  it('says a book is part of the full content, and offers it', async () => {
    render(<BooksView />)
    act(() => openBook({ kind: 'book', id: 'TST', chapter: 0, anchor: null, find: null }))
    expect(await screen.findByText(/part of the full content/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Download the full content' }))
    expect(fakeLibrary.enable).toHaveBeenCalled()
  })
})

describe('reading position', () => {
  it('tells the reader which heading is at the top while scrolling', async () => {
    useContentSettings.setState({ fullContent: true })
    vi.mocked(loadBookText).mockResolvedValue(text)
    render(<BooksView />)
    act(() => openBook({ kind: 'book', id: 'TST', chapter: 0, anchor: null, find: null }))
    await screen.findByRole('article', { name: 'Chapter 1: Wanderers' })
    const pane = document.querySelector('.book-pane')!
    fireEvent.scroll(pane)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Packing' })).toBeInTheDocument(),
    )
  })

  it("shows more of a book's results on request", async () => {
    useContentSettings.setState({ fullContent: true })
    fakeLibrary.has.mockResolvedValue(true)
    const long = [
      {
        type: 'section',
        name: 'Dragons',
        entries: Array.from({ length: 6 }, (_, i) => 'A dragon sleeps in cave ' + i),
      },
    ]
    vi.mocked(readBookText).mockResolvedValue({ sections: long, scan: scan(long) })
    render(<BooksView />)
    act(() => openBook(null))
    await screen.findByRole('heading', { name: 'Core rulebook' }, { timeout: 3000 })
    fireEvent.change(screen.getByRole('searchbox', { name: /Search the text/ }), {
      target: { value: 'dragon' },
    })
    await screen.findByRole('region', { name: /Test Handbook/ }, { timeout: 3000 })
    const links = () => screen.getAllByRole('link', { name: /Dragons/ })
    const before = links().length
    fireEvent.click(await screen.findByRole('button', { name: /Show [0-9]+ more/ }))
    expect(links().length).toBeGreaterThan(before)
  })
})
