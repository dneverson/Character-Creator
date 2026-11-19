import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EntryContext } from '../text/entryContext'
import { fixtureDoc, fixtureSections } from '../test/bookFixture'
import { loadBookDocs } from './catalog'
import { loadBookText } from './load'
import { OpenInBook } from './OpenInBook'
import { scan } from './outline'
import { useBookStore } from './state'

vi.mock('./catalog', () => ({ loadBookDocs: vi.fn() }))
vi.mock('./load', () => ({ loadBookText: vi.fn() }))

const text = { sections: fixtureSections, scan: scan(fixtureSections) }
const name = 'Test Handbook'

const place = () => useBookStore.getState().place

beforeEach(() => {
  vi.clearAllMocks()
  useBookStore.setState({ open: false, place: null, request: 0 })
  vi.mocked(loadBookDocs).mockResolvedValue([fixtureDoc])
  vi.mocked(loadBookText).mockResolvedValue(text)
})

describe('OpenInBook', () => {
  it('goes to the heading of the entry name and marks the name', async () => {
    render(<OpenInBook source="TST" page={5} name="Packing" />)
    const button = await screen.findByRole('button', {
      name: `Open Packing in the ${name}`,
    })
    expect(button).toHaveTextContent('Open in book')
    await userEvent.click(button)
    await waitFor(() => expect(useBookStore.getState().open).toBe(true))
    expect(place()).toEqual({
      kind: 'book',
      id: 'TST',
      chapter: 0,
      anchor: 'packing',
      find: 'Packing',
    })
  })

  it('falls back to the heading on or before the page when the name is no heading', async () => {
    render(<OpenInBook source="tst" page={10} name="Rope" />)
    await userEvent.click(await screen.findByRole('button'))
    await waitFor(() => expect(place()).not.toBeNull())
    expect(place()).toMatchObject({ chapter: 1, anchor: 'packing', find: 'Rope' })
  })

  it('does not mark the name when asked not to, and says its own label', async () => {
    render(
      <OpenInBook source="TST" name={name} kind="book" mark={false}>
        Open book
      </OpenInBook>,
    )
    await userEvent.click(await screen.findByRole('button', { name: `Open the ${name}` }))
    await waitFor(() => expect(place()).not.toBeNull())
    expect(place()?.find).toBeNull()
  })

  it('still opens a book whose text is not stored, for the reader to explain', async () => {
    vi.mocked(loadBookText).mockRejectedValue(new Error('not stored'))
    render(<OpenInBook source="TST" page={4} name="Packing" />)
    await userEvent.click(await screen.findByRole('button'))
    await waitFor(() => expect(useBookStore.getState().open).toBe(true))
    expect(place()).toMatchObject({ kind: 'book', id: 'TST', find: 'Packing' })
  })

  it('reads no text before it is clicked', async () => {
    render(<OpenInBook source="TST" name="Packing" />)
    await screen.findByRole('button')
    expect(loadBookText).not.toHaveBeenCalled()
  })

  it('shows nothing for a source that is no book of the catalog', async () => {
    const { container } = render(<OpenInBook source="NOPE" name="Packing" />)
    await waitFor(() => expect(loadBookDocs).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('shows nothing when the catalog cannot be read', async () => {
    vi.mocked(loadBookDocs).mockRejectedValue(new Error('offline'))
    const { container } = render(<OpenInBook source="TST" name="Packing" />)
    await waitFor(() => expect(loadBookDocs).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('shows nothing when the source is a book but an adventure was meant', async () => {
    const { container } = render(
      <OpenInBook source="TST" kind="adventure" name="Packing" />,
    )
    await waitFor(() => expect(loadBookDocs).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('shows nothing inside the book the reader is in, whatever it is asked to open', async () => {
    const { container } = render(
      <EntryContext.Provider
        value={{ book: true, words: [], doc: { kind: 'book', id: 'TST' } }}
      >
        <OpenInBook source="TST" name="Packing" />
      </EntryContext.Provider>,
    )
    await waitFor(() => expect(loadBookDocs).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('still shows for an entry of another book than the one being read', async () => {
    render(
      <EntryContext.Provider
        value={{ book: true, words: [], doc: { kind: 'adventure', id: 'ADV' } }}
      >
        <OpenInBook source="TST" name="Packing" />
      </EntryContext.Provider>,
    )
    expect(await screen.findByRole('button')).toHaveTextContent('Open in book')
  })
})
