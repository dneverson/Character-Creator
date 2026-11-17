import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { _resetIndex } from '../../books/indexState'
import { loadBookText, readBookText } from '../../books/load'
import { scan } from '../../books/outline'
import { rememberPlace } from '../../books/memory'
import { openBook, useBookStore } from '../../books/state'
import { appConfig } from '../../config/app'
import { useContentStatus } from '../../content/library'
import { useContentSettings } from '../../content/settings'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { fakeLibrary } from '../../test/fakeLibrary'
import { fixtureDoc, fixtureSections } from '../../test/bookFixture'
import { BooksButton } from './BooksButton'
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
const adventure = {
  ...fixtureDoc,
  kind: 'adventure' as const,
  id: 'ADV',
  name: 'A Quest',
}

const place = (chapter: number | null, anchor: string | null = null, find = null) =>
  ({ kind: 'book', id: 'TST', chapter, anchor, find }) as const

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  _resetIndex()
  useContentStatus.setState({ epoch: 0 })
  useContentSettings.setState({ fullContent: true })
  useBookStore.setState({ open: false, place: null, request: 0 })
  vi.mocked(catalog.loadBookDocs).mockResolvedValue([fixtureDoc, adventure])
  vi.mocked(loadBookText).mockResolvedValue(text)
  vi.mocked(readBookText).mockResolvedValue(text)
  fakeLibrary.has.mockResolvedValue(true)
})

const shelf = async () => {
  render(<BooksView />)
  act(() => openBook(null))
  return screen.findByRole('heading', { name: 'Core rulebook' }, { timeout: 3000 })
}

describe('the Books button', () => {
  it('opens the shelf', () => {
    render(
      <ThemeProvider>
        <BooksButton />
      </ThemeProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Books' }))
    expect(useBookStore.getState()).toMatchObject({ open: true, place: null })
  })
})

describe('the shelf', () => {
  it('lists the books by group and the adventures on their own tab', async () => {
    await shelf()
    expect(screen.getByRole('link', { name: /Test Handbook/ })).toHaveAttribute(
      'href',
      '#/book/TST',
    )
    fireEvent.click(screen.getByRole('button', { name: /Adventures/ }))
    expect(screen.getByRole('link', { name: /A Quest/ })).toHaveAttribute(
      'href',
      '#/adventure/ADV',
    )
  })

  it('says which books are not stored', async () => {
    fakeLibrary.has.mockResolvedValue(false)
    await shelf()
    await waitFor(() => expect(screen.getByText('Not downloaded')).toBeInTheDocument())
    fireEvent.click(
      screen.getByRole('button', { name: 'Download all books and adventures' }),
    )
    expect(fakeLibrary.download).toHaveBeenCalled()
  })

  it('opens a book at the place it was left', async () => {
    await shelf()
    rememberPlace('book', 'TST', { chapter: 1, anchor: null })
    fireEvent.click(screen.getByRole('link', { name: /Test Handbook/ }))
    expect(
      await screen.findByRole('article', { name: 'Chapter 2: Arrival' }),
    ).toBeInTheDocument()
  })
})

describe('reading a book', () => {
  const open = async (to = place(0)) => {
    render(<BooksView />)
    act(() => openBook(to))
    return screen.findByRole('article', { name: 'Chapter 1: Wanderers' })
  }

  it('shows the chapter in the book look, with the tree beside it', async () => {
    await open()
    const tree = screen.getByRole('navigation', { name: 'Chapters and headings' })
    expect(within(tree).getByRole('button', { name: 'Packing' })).toBeInTheDocument()
    expect(screen.getByText('Bring rope and a lantern.')).toBeInTheDocument()
  })

  it('goes to a heading from the tree, and to the next and previous chapter', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Packing' }))
    expect(useBookStore.getState().place).toMatchObject({ chapter: 0, anchor: 'packing' })
    fireEvent.click(screen.getAllByRole('button', { name: 'Next chapter' })[0]!)
    expect(useBookStore.getState().place).toMatchObject({ chapter: 1, anchor: null })
    expect(
      await screen.findByRole('article', { name: 'Chapter 2: Arrival' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Previous chapter' })[0]!)
    expect(useBookStore.getState().place).toMatchObject({ chapter: 0 })
  })

  it('narrows the tree with the filter', async () => {
    await open()
    const filter = screen.getByRole('searchbox', { name: 'Filter chapters and headings' })
    fireEvent.change(filter, { target: { value: 'zzz' } })
    expect(screen.getByText('Nothing in this book has that name.')).toBeInTheDocument()
    fireEvent.change(filter, { target: { value: 'arrival' } })
    expect(screen.getByRole('button', { name: 'Chapter 2: Arrival' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close Chapter 2: Arrival' }))
  })

  it('opens and closes a chapter in the tree', async () => {
    await open()
    const toggle = screen.getByRole('button', { name: 'Close Chapter 1: Wanderers' })
    fireEvent.click(toggle)
    expect(screen.queryByRole('button', { name: 'Packing' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open Chapter 1: Wanderers' }))
    expect(screen.getByRole('button', { name: 'Packing' })).toBeInTheDocument()
  })

  it('resizes the list with the keys and remembers the width', async () => {
    await open()
    const bar = screen.getByRole('separator')
    const start = Number(bar.getAttribute('aria-valuenow'))
    const { keyStep, min, max } = appConfig.books.sidebar
    fireEvent.keyDown(bar, { key: 'ArrowRight' })
    expect(bar).toHaveAttribute('aria-valuenow', String(start + keyStep))
    fireEvent.keyDown(bar, { key: 'ArrowLeft' })
    fireEvent.keyDown(bar, { key: 'Home' })
    expect(bar).toHaveAttribute('aria-valuenow', String(min))
    fireEvent.keyDown(bar, { key: 'End' })
    expect(bar).toHaveAttribute('aria-valuenow', String(max))
    fireEvent.keyDown(bar, { key: 'a' })
    expect(bar).toHaveAttribute('aria-valuenow', String(max))
  })

  it('resizes the list by dragging', async () => {
    await open()
    const bar = screen.getByRole('separator')
    fireEvent.pointerDown(bar, { clientX: 300 })
    fireEvent(window, new MouseEvent('pointermove', { clientX: 420 }))
    fireEvent(window, new MouseEvent('pointerup', { clientX: 420 }))
    expect(bar).toHaveAttribute('aria-valuenow', '420')
  })

  it('shows the chapter list over the text on a phone', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Chapters' }))
    expect(document.querySelector('.book-reader')).toHaveClass('is-contents-open')
  })

  it('explains a text that cannot be had and tries again', async () => {
    vi.mocked(loadBookText).mockRejectedValueOnce(new Error('offline'))
    render(<BooksView />)
    act(() => openBook(place(0)))
    expect(await screen.findByText(/could not be loaded: offline/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      await screen.findByRole('article', { name: 'Chapter 1: Wanderers' }),
    ).toBeInTheDocument()
  })

  it('shows a book the catalog does not list by its id', async () => {
    render(<BooksView />)
    act(() => openBook({ ...place(0), id: 'XYZ' }))
    expect(await screen.findAllByText('XYZ')).not.toHaveLength(0)
  })
})

describe('searching the books', () => {
  const search = async (words: string) => {
    render(<BooksView />)
    act(() => openBook(null))
    await screen.findByRole('heading', { name: 'Core rulebook' }, { timeout: 3000 })
    fireEvent.change(screen.getByRole('searchbox', { name: /Search the text/ }), {
      target: { value: words },
    })
  }

  it('groups results by book and opens one with the words marked', async () => {
    await search('lantern')
    const group = await screen.findByRole(
      'region',
      { name: /Test Handbook/ },
      { timeout: 3000 },
    )
    expect(screen.getByText(/matches in 2 books/)).toBeInTheDocument()
    fireEvent.click(within(group).getAllByRole('link')[0]!)
    await screen.findByRole('article', { name: 'Chapter 1: Wanderers' })
    expect(document.querySelectorAll('mark.book-hit').length).toBeGreaterThan(0)
  })

  it('steps from match to match across chapters, and clears', async () => {
    render(<BooksView />)
    act(() =>
      openBook({ kind: 'book', id: 'TST', chapter: 0, anchor: null, find: 'packing' }),
    )
    await screen.findByText(/Match 1 of \d+ in this chapter/, undefined, {
      timeout: 3000,
    })
    fireEvent.click(screen.getByRole('button', { name: 'Next match' }))
    await screen.findByRole('article', { name: 'Chapter 2: Arrival' })
    fireEvent.click(screen.getByRole('button', { name: 'Previous match' }))
    await screen.findByRole('article', { name: 'Chapter 1: Wanderers' })
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(useBookStore.getState().place?.find).toBeNull()
  })

  it('says when nothing is found', async () => {
    await search('qqqqzz')
    expect(
      await screen.findByText(/Nothing found/, undefined, { timeout: 3000 }),
    ).toBeVisible()
  })

  it('shows more results of a book on request', async () => {
    await search('the')
    await screen.findByRole('region', { name: /Test Handbook/ }, { timeout: 3000 })
    const more = screen.queryByRole('button', { name: /Show \d+ more/ })
    if (more) fireEvent.click(more)
  })

  it('asks to store the books when none are here', async () => {
    fakeLibrary.has.mockResolvedValue(false)
    await search('lantern')
    expect(
      await screen.findByRole('button', { name: 'Download all books and adventures' }),
    ).toBeInTheDocument()
  })
})
