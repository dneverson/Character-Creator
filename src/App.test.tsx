import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { ThemeProvider } from './theme/ThemeProvider'
import { useCharacterStore } from './character/store'
import type { Book } from './data/types'

// Mock the data loader so the test doesn't hit the network/filesystem.
const SAMPLE_BOOKS: Book[] = [
  { name: "Player's Handbook (2014)", id: 'PHB', source: 'PHB', group: 'core' },
  { name: "Player's Handbook (2024)", id: 'XPHB', source: 'XPHB', group: 'core' },
]
vi.mock('./data/loaders', () => ({
  loadBooks: () => Promise.resolve(SAMPLE_BOOKS),
}))

// The real editor, with a switch that makes it fail to render.
const editor = vi.hoisted(() => ({ fail: false }))
vi.mock('./components/editor/CharacterEditor', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./components/editor/CharacterEditor')>()
  const { createElement } = await import('react')
  return {
    CharacterEditor: () => {
      if (editor.fail) throw new Error('editor broke')
      return createElement(actual.CharacterEditor)
    },
  }
})

function renderApp() {
  return render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  editor.fail = false
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

describe('App flow', () => {
  it('creates a character and opens the single-scroll editor', async () => {
    const user = userEvent.setup()
    renderApp()

    expect(screen.getByRole('heading', { name: 'My Characters' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /New Character/i }))

    // Editor is shown with the Books section.
    expect(screen.getByRole('button', { name: /Characters/i })).toBeInTheDocument()
    expect(await screen.findByText("Player's Handbook (2014)")).toBeInTheDocument()
  })

  it('toggles a book and reflects it in the active character', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: /New Character/i }))

    // Ticking the 2024 PHB row's checkbox selects that book (a row-body click
    // only focuses the detail pane under the table's `rowClick="focus"` mode).
    const xphb = await screen.findByText("Player's Handbook (2024)")
    const row = xphb.closest('tr')
    if (!row) throw new Error('row for XPHB not found')
    await user.click(within(row).getByRole('checkbox'))
    await waitFor(() => {
      const active = useCharacterStore.getState()
      const id = active.activeId!
      expect(active.characters[id].selectedBooks).toContain('XPHB')
    })
  })

  it('shows the sheet of the open character and switches back to the editor', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: /New Character/i }))
    await user.click(screen.getByRole('button', { name: 'Sheet' }))
    expect(useCharacterStore.getState().view).toBe('sheet')
    expect(screen.getByRole('heading', { name: 'New Character', level: 1 })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(useCharacterStore.getState().view).toBe('editor')
    expect(await screen.findByText("Player's Handbook (2014)")).toBeInTheDocument()
  })

  it('offers a way back to the list when the editor fails to render', async () => {
    const user = userEvent.setup()
    // React reports the caught render error to the console; that report is expected here.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    editor.fail = true
    renderApp()
    await user.click(screen.getByRole('button', { name: /New Character/i }))

    expect(
      screen.getByRole('heading', { name: 'This page could not be displayed' }),
    ).toBeInTheDocument()
    // The navbar and footer survive the failure.
    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back to characters' }))
    expect(screen.getByRole('heading', { name: 'My Characters' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    consoleError.mockRestore()
  })
})
