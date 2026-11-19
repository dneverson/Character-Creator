import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadBookDocs } from '../../books/catalog'
import { loadBookText } from '../../books/load'
import { scan } from '../../books/outline'
import { useBookStore } from '../../books/state'
import { fixtureDoc, fixtureSections } from '../../test/bookFixture'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { EntryDetail } from './EntryDetail'
import type { Describe } from './facts'

vi.mock('../../books/catalog', () => ({ loadBookDocs: vi.fn() }))
vi.mock('../../books/load', () => ({ loadBookText: vi.fn() }))

interface Spell {
  name: string
  source: string
  page?: string
}

const describeSpells: Describe<Spell> = () => [
  {
    key: 'basics',
    title: 'Basics',
    facts: [
      { key: 'source', role: 'source', label: 'Source', text: (s) => s.source },
      { key: 'page', role: 'page', label: 'Page', text: (s) => s.page ?? '' },
    ],
  },
]

const packing: Spell = { name: 'Packing', source: 'TST', page: 'p. 4' }

function show(entry: Spell, style: string, name: React.ReactNode = entry.name) {
  localStorage.setItem('cc-detail-style', style)
  return render(
    <ThemeProvider>
      <EntryDetail entry={entry} describe={describeSpells} name={name} />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  useBookStore.setState({ open: false, place: null, request: 0 })
  vi.mocked(loadBookDocs).mockResolvedValue([fixtureDoc])
  vi.mocked(loadBookText).mockResolvedValue({
    sections: fixtureSections,
    scan: scan(fixtureSections),
  })
})

describe.each(['standard', 'book'])(
  'the open in book button of the %s detail',
  (style) => {
    it('opens the book at the entry, named for the entry and the book', async () => {
      show(packing, style)
      await userEvent.click(
        await screen.findByRole('button', { name: 'Open Packing in the Test Handbook' }),
      )
      await waitFor(() => expect(useBookStore.getState().open).toBe(true))
      expect(useBookStore.getState().place).toMatchObject({
        id: 'TST',
        anchor: 'packing',
        find: 'Packing',
      })
    })

    it('is not there for an entry with no source, or a source that is no book', async () => {
      show({ name: 'Packing', source: '' }, style)
      show({ name: 'Rope', source: 'NOPE' }, style)
      await waitFor(() => expect(loadBookDocs).toHaveBeenCalled())
      expect(screen.queryByRole('button', { name: /^Open / })).toBeNull()
    })

    it('is not there for a name that is not plain text', () => {
      show(packing, style, <em>Packing</em>)
      expect(screen.queryByRole('button', { name: /^Open / })).toBeNull()
    })

    it('goes by the name alone when the page is no number', async () => {
      show({ ...packing, page: 'unknown' }, style)
      await userEvent.click(await screen.findByRole('button', { name: /Open Packing/ }))
      await waitFor(() => expect(useBookStore.getState().open).toBe(true))
      expect(useBookStore.getState().place).toMatchObject({ anchor: 'packing' })
    })

    it('finds the page when the name is no heading', async () => {
      show({ name: 'Rope', source: 'TST', page: '10' }, style)
      await userEvent.click(await screen.findByRole('button', { name: /Open Rope/ }))
      await waitFor(() => expect(useBookStore.getState().open).toBe(true))
      expect(useBookStore.getState().place).toMatchObject({
        chapter: 1,
        anchor: 'packing',
      })
    })
  },
)
