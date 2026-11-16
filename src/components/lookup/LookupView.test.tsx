import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLookupIndex } from '../../lookup/data'
import { loadResolver } from '../../lookup/references'
import { buildIndex, type LookupIndex } from '../../lookup/search'
import { useLookupStore } from '../../lookup/state'
import type { LookupKind, LookupRow } from '../../lookup/types'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { LookupButton } from './LookupButton'
import { LookupView } from './LookupView'

vi.mock('../../lookup/data', () => ({ useLookupIndex: vi.fn() }))
vi.mock('../../lookup/references', () => ({ loadResolver: vi.fn() }))

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
/** A row the index does not hold, as an item a variant makes is. */
const MADE = make('item', '+1 Longsword', 'A sword with a bonus.', 'DMG')
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
  vi.mocked(loadResolver).mockResolvedValue({
    find: () => undefined,
    byId: (id) => [...ROWS, MADE].find((row) => row.id === id),
  })
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

  it('does not open with "/" while typing in a select or an editable element', async () => {
    const user = userEvent.setup()
    renderLookup()
    const select = document.body.appendChild(document.createElement('select'))
    const editable = document.body.appendChild(document.createElement('div'))
    editable.setAttribute('contenteditable', 'true')
    editable.tabIndex = 0
    for (const field of [select, editable]) {
      field.focus()
      await user.keyboard('/')
      expect(useLookupStore.getState().open).toBe(false)
    }
    select.remove()
    editable.remove()
  })

  it('gives the focus back to the button that opened it', async () => {
    const user = userEvent.setup()
    renderLookup()
    const opener = screen.getByRole('button', { name: 'Lookup' })
    await user.click(opener)
    expect(await screen.findByRole('searchbox')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(useLookupStore.getState().open).toBe(false))
    await waitFor(() => expect(opener).toHaveFocus())
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

  it('heads the rows with an entry the index does not hold, until the search changes', async () => {
    const user = userEvent.setup()
    renderLookup()
    act(() => useLookupStore.getState().openLookup(MADE.id))
    expect(await screen.findByDisplayValue('+1 Longsword')).toBeInTheDocument()
    expect(await screen.findByText(/A sword with a bonus\./)).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('0 matches.'),
    )
    const table = screen.getByRole('table', { name: 'Lookup results' })
    expect(within(table).getAllByRole('row')).toHaveLength(2)
    await user.type(screen.getByRole('searchbox'), 'x')
    expect(within(table).queryByText('+1 Longsword')).toBeNull()
  })

  it('closes the detail pane on Escape first, and the lookup on the next', async () => {
    const user = userEvent.setup()
    renderLookup()
    await user.click(screen.getByRole('button', { name: 'Lookup' }))
    await user.selectOptions(await screen.findByLabelText('Kind of entry'), 'Condition')
    await user.click(screen.getByText('Prone'))
    expect(
      await screen.findByRole('button', { name: 'Close details' }),
    ).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('button', { name: 'Close details' })).toBeNull()
    expect(useLookupStore.getState().open).toBe(true)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(useLookupStore.getState().open).toBe(false))
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
