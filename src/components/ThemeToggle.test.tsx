import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { ThemeToggle } from './ThemeToggle'
import { ThemeProvider } from '../theme/ThemeProvider'

beforeEach(() => {
  localStorage.clear()
})

describe('ThemeToggle', () => {
  it('defaults to System and switches the active theme when an option is picked', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    )

    // With no stored preference the toggle starts on System.
    const toggle = screen.getByRole('button', { name: 'Theme: System' })
    await user.click(toggle)

    // Selecting Dark updates the toggle label and the document theme (light branch).
    await user.click(screen.getByRole('button', { name: /Dark/i }))
    expect(screen.getByRole('button', { name: 'Theme: Dark' })).toBeInTheDocument()
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark')

    // Selecting Light exercises the secondary branch.
    await user.click(screen.getByRole('button', { name: 'Theme: Dark' }))
    await user.click(screen.getByRole('button', { name: /Light/i }))
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('light')
  })
})
