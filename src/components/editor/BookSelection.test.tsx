import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BookSelection } from './BookSelection'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { useCharacterStore } from '../../character/store'
import { createCharacter } from '../../character/model'
import { loadBooks } from '../../data/loaders'
import { loadBookContents } from '../../data/bookPages'
import type { Book } from '../../data/types'

vi.mock('../../data/loaders', () => ({ loadBooks: vi.fn() }))
vi.mock('../../data/bookPages', () => ({ loadBookContents: vi.fn() }))
// Cover thumbnails come from browser storage or the content source; here each one
// is ready at once, under a URL that names its cover.
vi.mock('../../content', () => ({
  coverLibrary: {
    peek: () => undefined,
    load: (path: string) => Promise.resolve(`thumb:${path}`),
  },
}))
const mockBooks = vi.mocked(loadBooks)
const mockContents = vi.mocked(loadBookContents)

const books = [
  { id: 'PHB', name: "Player's Handbook", source: 'PHB', published: '2014-08-19' },
  { id: 'XGE', name: 'Xanathar’s Guide', source: 'XGE', published: '2017-11-21' },
]

function seedActive(selectedBooks: string[] = ['PHB']) {
  const c = createCharacter('Tordek')
  c.selectedBooks = selectedBooks
  useCharacterStore.setState({
    characters: { [c.id]: c },
    order: [c.id],
    activeId: c.id,
    view: 'editor',
  })
  return c
}

function renderSection() {
  return render(
    <ThemeProvider>
      <BookSelection />
    </ThemeProvider>,
  )
}

function activeBooks(id: string) {
  return useCharacterStore.getState().characters[id].selectedBooks
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mockBooks.mockResolvedValue(books)
  // Unless a test says otherwise, the book text adds no page numbers.
  mockContents.mockImplementation((book) => Promise.resolve(book.contents ?? []))
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

describe('BookSelection', () => {
  const rowCheckbox = (label: string) => {
    const row = screen.getByText(label).closest('tr')
    if (!row) throw new Error(`row for ${label} not found`)
    return within(row).getByRole('checkbox')
  }

  it('toggles selection via the row checkbox and filters by query', async () => {
    const user = userEvent.setup()
    const c = seedActive(['PHB'])
    renderSection()

    expect(await screen.findByText("Player's Handbook")).toBeInTheDocument()

    // The checkbox toggles a book on…
    await user.click(rowCheckbox('Xanathar’s Guide'))
    await waitFor(() => expect(activeBooks(c.id)).toContain('XGE'))

    // …and toggles the pre-selected PHB off.
    await user.click(rowCheckbox("Player's Handbook"))
    await waitFor(() => expect(activeBooks(c.id)).not.toContain('PHB'))

    // Search narrows the list and the empty state appears for no match.
    await user.type(screen.getByPlaceholderText(/Filter books/i), 'zzz')
    expect(await screen.findByText(/No books match/i)).toBeInTheDocument()
  })

  it('a row-body click focuses without changing selection', async () => {
    const user = userEvent.setup()
    const c = seedActive([])
    renderSection()

    // Clicking the row body shows its detail pane but selects nothing.
    await user.click(await screen.findByText("Player's Handbook"))
    await waitFor(() => expect(activeBooks(c.id)).toHaveLength(0))
  })

  it('selects all and clears all', async () => {
    const user = userEvent.setup()
    const c = seedActive(['PHB'])
    renderSection()
    await screen.findByText("Player's Handbook")

    await user.click(screen.getByRole('checkbox', { name: 'Select all rows' }))
    await waitFor(() => expect(activeBooks(c.id).sort()).toEqual(['PHB', 'XGE']))

    await user.click(screen.getByRole('checkbox', { name: 'Select all rows' }))
    await waitFor(() => expect(activeBooks(c.id)).toHaveLength(0))
  })

  it('surfaces a loader error', async () => {
    seedActive()
    mockBooks.mockRejectedValue(new Error('nope'))
    renderSection()
    expect(await screen.findByText(/Failed to load books: nope/i)).toBeInTheDocument()
  })
})

describe('BookSelection detail pane', () => {
  const richBooks: Book[] = [
    {
      id: 'PHB',
      name: "Player's Handbook",
      source: 'PHB',
      published: '2014-08-19',
      author: 'Wizards RPG Team',
      group: 'core',
      coverCredit: 'Tyler Jacobson',
      cover: { type: 'internal', path: 'covers/PHB.webp' },
      contents: [
        {
          name: 'Introduction',
          page: 4,
          headers: ['Worlds of Adventure', { header: 'How to Play', depth: 1, page: 6 }],
        },
        {
          name: 'Races',
          ordinal: { type: 'chapter', identifier: 2 },
          headers: ['Choosing a Race'],
        },
        { name: 'Fake Appendix', ordinal: { type: 'appendix', identifier: 'A' } },
        { name: 'Closing', ordinal: { type: 'chapter' } },
      ],
    },
    {
      id: 'SB',
      name: 'Sourcebook',
      source: 'SB',
      published: '2020',
      group: 'weird-code',
      contents: [{ name: 'Only Section' }],
    },
  ]

  beforeEach(() => {
    mockBooks.mockResolvedValue(richBooks)
  })

  it('shows a cover thumbnail in the grid, or a dash when absent', async () => {
    seedActive([])
    renderSection()
    // The book with an internal cover gets its stored thumbnail…
    expect(await screen.findByAltText("Player's Handbook cover")).toHaveAttribute(
      'src',
      'thumb:covers/PHB.webp',
    )
    // …while the cover-less book renders a placeholder, not an image.
    expect(screen.queryByAltText('Sourcebook cover')).toBeNull()
  })

  it('enlarges the cover from the grid thumbnail in a lightbox', async () => {
    const user = userEvent.setup()
    const c = seedActive([])
    renderSection()

    // Only the grid thumbnail exists before any book is focused.
    expect(await screen.findByAltText("Player's Handbook cover")).toBeInTheDocument()

    // Clicking the thumbnail enlarges it without focusing/selecting the row.
    await user.click(screen.getByRole('button', { name: /Enlarge Player's Handbook/i }))
    await waitFor(() =>
      expect(screen.getAllByAltText("Player's Handbook cover")).toHaveLength(2),
    )
    expect(activeBooks(c.id)).toHaveLength(0)
  })

  it('renders full book details when a book is focused', async () => {
    const user = userEvent.setup()
    seedActive([])
    renderSection()

    await user.click(await screen.findByText("Player's Handbook"))

    // Metadata, with the group code decoded and the date formatted. The
    // embedded "RPG" acronym is wrapped for its tooltip, so match on the field.
    expect(await screen.findByText(/Wizards/)).toHaveTextContent('Wizards RPG Team')
    expect(screen.getByText('Core rulebook')).toBeInTheDocument()
    expect(screen.getByText('2014/08/19')).toBeInTheDocument()
    expect(screen.getByText('Tyler Jacobson')).toBeInTheDocument()
    // Both the grid thumbnail and the detail-pane hero use the same alt text.
    expect(screen.getAllByAltText("Player's Handbook cover")).toHaveLength(2)
    // The table of contents: front matter, a numbered chapter, an appendix.
    expect(screen.getByText('Introduction')).toBeInTheDocument()
    expect(screen.getByText('Chapter 2')).toBeInTheDocument()
    expect(screen.getByText('Appendix A')).toBeInTheDocument()
    // A derived chapter page number is shown.
    expect(screen.getByText('p. 4')).toBeInTheDocument()
  })

  it('collapses chapters by default and expands them on click, showing page numbers', async () => {
    const user = userEvent.setup()
    seedActive([])
    renderSection()

    await user.click(await screen.findByText("Player's Handbook"))

    // Sub-headings are hidden until their chapter is expanded.
    expect(screen.queryByText('How to Play')).toBeNull()

    const chapter = screen.getByRole('button', { name: /Introduction/i })
    expect(chapter).toHaveAttribute('aria-expanded', 'false')
    await user.click(chapter)

    expect(chapter).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('How to Play')).toBeInTheDocument()
    // The sub-heading's own derived page number renders too.
    expect(screen.getByText('p. 6')).toBeInTheDocument()
  })

  it('shows the contents at once and fills in the page numbers when they are ready', async () => {
    const user = userEvent.setup()
    seedActive([])
    let finish: (contents: NonNullable<Book['contents']>) => void = () => undefined
    mockContents.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    renderSection()

    await user.click(await screen.findByText('Sourcebook'))

    // The chapter is listed before its page number is known.
    expect(await screen.findByText('Only Section')).toBeInTheDocument()
    expect(screen.queryByText('p. 12')).toBeNull()
    expect(mockContents).toHaveBeenCalledWith(richBooks[1])

    finish([{ name: 'Only Section', page: 12 }])
    expect(await screen.findByText('p. 12')).toBeInTheDocument()
  })

  it('keeps the contents without page numbers when they cannot be worked out', async () => {
    const user = userEvent.setup()
    seedActive([])
    mockContents.mockRejectedValue(new Error('offline'))
    renderSection()

    await user.click(await screen.findByText('Sourcebook'))
    expect(await screen.findByText('Only Section')).toBeInTheDocument()
  })

  it('searches contents by title, auto-expanding and filtering to matches', async () => {
    const user = userEvent.setup()
    seedActive([])
    renderSection()

    await user.click(await screen.findByText("Player's Handbook"))
    await user.type(screen.getByLabelText(/Search book contents/i), 'race')

    // A non-matching chapter drops out of the list…
    expect(screen.queryByText('Introduction')).toBeNull()
    // …while the matching chapter is shown, auto-expanded, with the hit
    // highlighted (the <mark> splits the title text, so match on the marks).
    const marks = screen.getAllByText('Race')
    expect(marks.length).toBeGreaterThan(0)
    expect(marks.every((m) => m.tagName === 'MARK')).toBe(true)
  })

  it('enlarges the cover in a lightbox on click', async () => {
    const user = userEvent.setup()
    seedActive([])
    renderSection()

    await user.click(await screen.findByText("Player's Handbook"))
    // Grid thumbnail + detail hero.
    expect(screen.getAllByAltText("Player's Handbook cover")).toHaveLength(2)

    // Both the grid thumbnail and the detail hero offer an enlarge button; the
    // detail hero is the second one in document order.
    const enlargeButtons = screen.getAllByRole('button', { name: /Enlarge/i })
    expect(enlargeButtons).toHaveLength(2)
    await user.click(enlargeButtons[1])
    // The lightbox adds a third copy of the cover image.
    await waitFor(() =>
      expect(screen.getAllByAltText("Player's Handbook cover")).toHaveLength(3),
    )
  })

  it('falls back for unknown group codes and non-ISO dates', async () => {
    const user = userEvent.setup()
    seedActive([])
    renderSection()

    await user.click(await screen.findByText('Sourcebook'))

    expect(await screen.findByText('Weird-Code')).toBeInTheDocument()
    // The non-ISO date passes through verbatim; it shows in both the Year column
    // and the detail pane's Published row.
    expect(screen.getAllByText('2020')).toHaveLength(2)
    expect(screen.getByText('Only Section')).toBeInTheDocument()
  })
})
