import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { useCharacterStore } from '../../character/store'

vi.mock('../../data/loaders', () => ({ loadBooks: () => Promise.resolve([]) }))

function renderApp() {
  return render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

function activeAbilities() {
  const s = useCharacterStore.getState()
  return s.characters[s.activeId!].abilities
}

describe('Ability scores flow', () => {
  it('point buy: increment spends points and raises the score', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: /New Character/i }))

    await user.selectOptions(screen.getByLabelText('Ability score method'), 'pointbuy')
    expect(screen.getByText(/points remaining/i)).toBeInTheDocument()

    // Strength starts at 8; one click on 10 costs 2 points.
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Strength score' })).getByRole(
        'radio',
        { name: '10' },
      ),
    )

    await waitFor(() => expect(activeAbilities().str.base).toBe(10))
  })

  it('standard array: assigning a value updates the total', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: /New Character/i }))

    await user.selectOptions(screen.getByLabelText('Ability score method'), 'array')
    // Choose the score, then the ability it goes to.
    await user.click(screen.getByRole('button', { name: '15' }))
    await user.click(screen.getByRole('button', { name: 'Strength base score' }))

    await waitFor(() => expect(activeAbilities().str.base).toBe(15))
  })
})
