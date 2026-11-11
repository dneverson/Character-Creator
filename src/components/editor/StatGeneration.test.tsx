import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StatGeneration } from './StatGeneration'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { useCharacterStore } from '../../character/store'
import { createCharacter } from '../../character/model'

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

function renderSection() {
  return render(
    <ThemeProvider>
      <StatGeneration />
    </ThemeProvider>,
  )
}

function active(id: string) {
  return useCharacterStore.getState().characters[id]
}

beforeEach(() => {
  localStorage.clear()
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('StatGeneration', () => {
  it('renders nothing without an active character', () => {
    const { container } = renderSection()
    expect(container).toBeEmptyDOMElement()
  })

  it('rolls a pool for a dice method and shows the generated scores', async () => {
    const user = userEvent.setup()
    const c = seedActive()
    renderSection()

    await user.click(screen.getByRole('button', { name: 'Roll' }))
    await waitFor(() => expect(active(c.id).statPool).toHaveLength(6))
    expect(screen.getByLabelText('Generated scores')).toBeInTheDocument()
  })

  it('rolls a matrix grid and renders the table', async () => {
    const user = userEvent.setup()
    const c = seedActive()
    renderSection()

    await user.selectOptions(screen.getByLabelText('Ability score method'), 'matrix')
    await user.click(screen.getByRole('button', { name: 'Roll Matrix' }))
    await waitFor(() => expect(active(c.id).statPool).toHaveLength(6))
    expect(screen.getByText(/become\s+your pool/i)).toBeInTheDocument()
  })

  it('lets the player pick which matrix line becomes the pool', async () => {
    const user = userEvent.setup()
    // Deterministic dice: every d6 in row r shows (r % 6) + 1, so row r's cells
    // each sum to 3*(r+1) and row totals climb 18, 36, 54, 72, 90, 108.
    // rollMatrix fills the 6x6 grid row-major, 3 dice per cell (18 dice/row).
    let call = 0
    vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((array) => {
      const rowIndex = Math.floor(call / 18) % 6
      ;(array as Uint8Array)[0] = rowIndex // 1 + (rowIndex % 6)
      call++
      return array
    })
    const c = seedActive()
    renderSection()

    await user.selectOptions(screen.getByLabelText('Ability score method'), 'matrix')
    await user.click(screen.getByRole('button', { name: 'Roll Matrix' }))

    // Default selection is the best line: row 6 (total 108), all cells 18.
    await waitFor(() => expect(active(c.id).statPool).toEqual([18, 18, 18, 18, 18, 18]))

    // Pick row 4 instead: each of its cells sums to 3*4 = 12.
    await user.click(screen.getByRole('button', { name: /Use row 4 \(total 72/ }))
    await waitFor(() => expect(active(c.id).statPool).toEqual([12, 12, 12, 12, 12, 12]))
  })

  it('restores the rolled matrix after the section is remounted', async () => {
    const user = userEvent.setup()
    const c = seedActive()
    const view = renderSection()

    await user.selectOptions(screen.getByLabelText('Ability score method'), 'matrix')
    await user.click(screen.getByRole('button', { name: 'Roll Matrix' }))
    await waitFor(() => expect(active(c.id).statPool).toHaveLength(6))
    expect(screen.getByRole('group', { name: 'Rolled score matrix' })).toBeInTheDocument()

    // Leaving and returning (reload/reopen) unmounts and remounts the section. The
    // grid must come back from the saved character, not vanish with local state.
    view.unmount()
    renderSection()

    expect(screen.getByRole('group', { name: 'Rolled score matrix' })).toBeInTheDocument()
    expect(active(c.id).statPool).toHaveLength(6)
  })

  it('renders a perfect 18 in gold in the matrix', async () => {
    const user = userEvent.setup()
    // Force every d6 to 6 so every cell sums to 18 (all cells are "best").
    vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((array) => {
      ;(array as Uint8Array)[0] = 5 // 1 + (5 % 6) = 6
      return array
    })
    seedActive()
    renderSection()

    await user.selectOptions(screen.getByLabelText('Ability score method'), 'matrix')
    await user.click(screen.getByRole('button', { name: 'Roll Matrix' }))

    // Scope to the grid: the chosen line is now also echoed as roll tiles below
    // it, so an unscoped "18" query would mix cell and tile elements. This test
    // asserts the matrix cells' own tint/colour, so it looks only inside them.
    const grid = await screen.findByRole('group', { name: 'Rolled score matrix' })
    const cells = within(grid).getAllByText('18')
    expect(cells.length).toBeGreaterThan(0)
    // The per-score gold survives even though every cell is on a best line.
    expect(cells.every((c) => c.classList.contains('score-perfect'))).toBe(true)
    // Cells are tinted by their own score, not by whether the line is best or
    // picked - a perfect 18 gets the gold cell tint regardless of selection.
    expect(cells.every((c) => c.classList.contains('score-tint--perfect'))).toBe(true)
    // "Best" never borrows the picked-line highlight class.
    expect(cells.every((c) => !c.classList.contains('table-primary'))).toBe(true)
    // Each line selector surfaces its average alongside the total.
    expect(screen.getAllByText(/avg 18\.0/).length).toBeGreaterThan(0)
    // No decorative glyphs - plain "Best" text flags the top lines instead.
    expect(screen.queryByText('★')).toBeNull()
    expect(screen.getAllByText('Best').length).toBeGreaterThan(0)
  })

  it('sets the standard array pool', async () => {
    const user = userEvent.setup()
    const c = seedActive()
    renderSection()

    await user.selectOptions(screen.getByLabelText('Ability score method'), 'array')
    await waitFor(() => expect(active(c.id).statPool).toEqual([15, 14, 13, 12, 10, 8]))
    expect(screen.getByText(/assign the values/i)).toBeInTheDocument()
  })

  it('switches to point buy and clears the pool', async () => {
    const user = userEvent.setup()
    const c = seedActive()
    renderSection()

    await user.selectOptions(screen.getByLabelText('Ability score method'), 'pointbuy')
    await waitFor(() => expect(active(c.id).statMethod).toBe('pointbuy'))
    expect(active(c.id).statPool).toHaveLength(0)
    expect(screen.getByText(/27-point buy/i)).toBeInTheDocument()
  })
})
