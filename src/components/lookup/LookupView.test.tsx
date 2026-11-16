import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLookupIndex } from '../../lookup/data'
import { buildIndex, type LookupIndex } from '../../lookup/search'
import { useLookupStore } from '../../lookup/state'
import type { LookupKind, LookupRow } from '../../lookup/types'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { LookupButton } from './LookupButton'
import { LookupView } from './LookupView'

vi.mock('../../lookup/data', () => ({ useLookupIndex: vi.fn() }))

const make = (
  kind: LookupKind,
  name: string,
  text: string,
  source = 'PHB',
  context?: string,
): LookupRow => ({
  id: `${kind}:${name}|${source}`.toLowerCase(),
  kind,
  name,
  ...(context && { context }),
  source,
  edition: 'classic',
  subject: {
    type: 'text',
    value: {
      name,
      source,
      page: 290,
      edition: 'classic',
      facts: [{ label: 'Gained', value: 'Level 2' }],
      entries: [text],
    },
  },
})

const ROWS = [
  make('class', 'Druid', 'Priests of the natural world.'),
  make('spell', 'Moonbeam', 'A silvery beam. Druid circles favor it.'),
  make('condition', 'Prone', 'A prone creature crawls.'),
  make('classFeature', 'Wild Shape', 'Assume a beast shape.', 'PHB', 'Druid 2'),
]
let index: LookupIndex

beforeAll(async () => {
  index = await buildIndex(ROWS, 1000)
})

function renderLookup() {
  return render(
    <ThemeProvider>
      <LookupButton />
      <LookupView />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  useLookupStore.setState({ open: false, entryId: null, request: 0 })
  vi.mocked(useLookupIndex).mockReturnValue({ data: index, error: null, loading: false })
})

describe('Quick lookup', () => {
  it('opens from the header button and says what it holds', async () => {
    const user = userEvent.setup()
    renderLookup()
    expect(screen.queryByRole('searchbox')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Lookup' }))
    expect(await screen.findByRole('searchbox')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Type to search 4 entries')
    expect(screen.getByText('Nothing to show yet.')).toBeInTheDocument()
  })

  it('opens with the "/" key unless a field has the focus', async () => {
    const user = userEvent.setup()
    renderLookup()
    const field = document.body.appendChild(document.createElement('input'))
    field.focus()
    await user.keyboard('/')
    expect(useLookupStore.getState().open).toBe(false)
    field.blur()
    await user.keyboard('{Control>}/{/Control}')
    expect(useLookupStore.getState().open).toBe(false)
    await user.keyboard('/')
    expect(useLookupStore.getState().open).toBe(true)
    field.remove()
  })

  it('searches names and text, shows the book, the kind and where the text matches', async () => {
    const user = userEvent.setup()
    renderLookup()
    await user.click(screen.getByRole('button', { name: 'Lookup' }))
    await user.type(await screen.findByRole('searchbox'), 'druid')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('3 matches'))
    const table = screen.getByRole('table', { name: 'Lookup results' })
    const body = within(table).getAllByRole('row').slice(1)
    expect(body.map((r) => within(r).getAllByRole('cell')[1].textContent)).toEqual([
      'Druid',
      'Wild ShapeDruid 2',
      'Moonbeam',
    ])
    const moon = body[2]
    expect(within(moon).getByText('Druid', { selector: 'mark' })).toBeInTheDocument()
    expect(within(moon).getByText('Spell')).toBeInTheDocument()
    expect(within(moon).getByText('PHB')).toBeInTheDocument()
  })

  it('filters by kind and opens an entry in the detail pane beside the table', async () => {
    const user = userEvent.setup()
    renderLookup()
    await user.click(screen.getByRole('button', { name: 'Lookup' }))
    await user.selectOptions(await screen.findByLabelText('Kind of entry'), 'Condition')
    expect(screen.getByRole('status')).toHaveTextContent('1 match.')
    await user.click(screen.getByText('Prone'))
    expect(await screen.findByText('A prone creature crawls.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close details' })).toBeInTheDocument()
  })

  it('opens on the entry a reference names, and again on another', async () => {
    renderLookup()
    act(() => useLookupStore.getState().openLookup('spell:moonbeam|phb'))
    expect(await screen.findByDisplayValue('Moonbeam')).toBeInTheDocument()
    expect(await screen.findByText(/A silvery beam\./)).toBeInTheDocument()
    act(() => useLookupStore.getState().openLookup('condition:prone|phb'))
    expect(await screen.findByDisplayValue('Prone')).toBeInTheDocument()
    expect(await screen.findByText('A prone creature crawls.')).toBeInTheDocument()
  })

  it('says so while the search is prepared, when it cannot be, and when nothing matches', async () => {
    const user = userEvent.setup()
    vi.mocked(useLookupIndex).mockReturnValue({ data: null, error: null, loading: true })
    renderLookup()
    await user.click(screen.getByRole('button', { name: 'Lookup' }))
    expect(await screen.findByText('Preparing the search...')).toBeInTheDocument()
    vi.mocked(useLookupIndex).mockReturnValue({
      data: null,
      error: new Error('offline'),
      loading: false,
    })
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await user.keyboard('/')
    expect(
      await screen.findByText(/Could not load the rules: offline/),
    ).toBeInTheDocument()
    vi.mocked(useLookupIndex).mockReturnValue({
      data: index,
      error: null,
      loading: false,
    })
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await user.keyboard('/')
    await user.type(await screen.findByRole('searchbox'), 'zzz')
    expect(await screen.findByText('Nothing matches.')).toBeInTheDocument()
  })
})
