import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CharacterEditor } from './CharacterEditor'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { useCharacterStore } from '../../character/store'
import { createCharacter } from '../../character/model'
import { downloadCharacter } from '../../character/io'
import { exportCharacterPdf } from '../../pdf/exportPdf'
import { settle } from '../../test/settle'

vi.mock('../../character/io', () => ({ downloadCharacter: vi.fn() }))
vi.mock('../../pdf/exportPdf', () => ({ exportCharacterPdf: vi.fn() }))
// The real Hit Points section, with a switch that makes it fail to render.
const hitPoints = vi.hoisted(() => ({ fail: false }))
vi.mock('./HitPoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./HitPoints')>()
  const { createElement } = await import('react')
  return {
    HitPoints: () => {
      if (hitPoints.fail) throw new Error('hit dice are missing')
      return createElement(actual.HitPoints)
    },
  }
})
const mockDownload = vi.mocked(downloadCharacter)
const mockPdf = vi.mocked(exportCharacterPdf)

function seedActive() {
  const c = createCharacter('Tordek')
  useCharacterStore.setState({
    characters: { [c.id]: c },
    order: [c.id],
    activeId: c.id,
    view: 'editor',
  })
  return c
}

function renderEditor() {
  return render(
    <ThemeProvider>
      <CharacterEditor />
    </ThemeProvider>,
  )
}

function state() {
  return useCharacterStore.getState()
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  hitPoints.fail = false
  mockPdf.mockResolvedValue(undefined)
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

describe('CharacterEditor', () => {
  it('renders nothing without an active character', async () => {
    const { container } = renderEditor()
    expect(container).toBeEmptyDOMElement()
    // Still nothing once the content names have loaded.
    await settle()
    expect(container).toBeEmptyDOMElement()
  })

  it('orders the sections along the build flow', async () => {
    seedActive()
    // Settle the sections' data loads so they do not update after the test.
    await act(async () => renderEditor())
    // Class Features and Wild Shape only appear once a (Druid) class is chosen.
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(titles).toEqual([
      'Books',
      'Class & Level',
      'Race / Species',
      'Background',
      'Ability Scores',
      'Feats & Ability Score Improvements',
      'Skills',
      'Proficiencies',
      'Hit Points',
      'Combat',
      'Spells',
      'Equipment',
    ])
  })

  it('renames, exports JSON, and returns to the list', async () => {
    const user = userEvent.setup()
    const c = seedActive()
    renderEditor()

    const name = screen.getByLabelText('Character name')
    await user.type(name, '!')
    await waitFor(() => expect(state().characters[c.id].name).toBe('Tordek!'))

    await user.click(screen.getByRole('button', { name: 'Export JSON' }))
    expect(mockDownload).toHaveBeenCalledWith(expect.objectContaining({ id: c.id }))

    await user.click(screen.getByRole('button', { name: 'Characters' }))
    await waitFor(() => expect(state().view).toBe('list'))
  })

  it('exports a PDF and surfaces export errors', async () => {
    const user = userEvent.setup()
    seedActive()
    renderEditor()

    await user.click(screen.getByRole('button', { name: 'Export PDF' }))
    await waitFor(() => expect(mockPdf).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('PDF export failed')).not.toBeInTheDocument()

    mockPdf.mockRejectedValueOnce(new Error('no fonts'))
    await user.click(screen.getByRole('button', { name: 'Export PDF' }))
    expect(await screen.findByText('no fonts')).toBeInTheDocument()
  })

  it('collapses and expands every section from the toolbar', async () => {
    const user = userEvent.setup()
    seedActive()
    renderEditor()

    const headers = () =>
      screen
        .getAllByRole('heading', { level: 2 })
        .map((h) => h.closest('[aria-expanded]')?.getAttribute('aria-expanded'))
    expect(headers().every((v) => v === 'true')).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Collapse all' }))
    expect(headers().every((v) => v === 'false')).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Expand all' }))
    expect(headers().every((v) => v === 'true')).toBe(true)
  })

  it('contains a failing section and keeps the others usable', async () => {
    // React reports the caught render error to the console; that report is expected here.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    hitPoints.fail = true
    seedActive()
    await act(async () => renderEditor())

    expect(
      screen.getByRole('heading', { name: 'Hit Points could not be displayed' }),
    ).toBeInTheDocument()
    expect(screen.getByText('hit dice are missing')).toBeInTheDocument()
    // The sections around it still render, and so does the toolbar.
    expect(screen.getByRole('heading', { name: 'Skills' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Spells' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export JSON' })).toBeInTheDocument()
    consoleError.mockRestore()
  })

  it('shows a generic message when a non-Error is thrown', async () => {
    const user = userEvent.setup()
    seedActive()
    mockPdf.mockRejectedValueOnce('boom')
    renderEditor()

    await user.click(screen.getByRole('button', { name: 'Export PDF' }))
    expect(await screen.findByText('PDF export failed')).toBeInTheDocument()
  })
})
