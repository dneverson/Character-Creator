import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from './ThemeProvider'
import { useTheme } from './theme-context'

function Probe() {
  const { mode, resolved, setMode } = useTheme()
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="resolved">{resolved}</span>
      <button onClick={() => setMode('dark')}>dark</button>
      <button onClick={() => setMode('light')}>light</button>
      <button onClick={() => setMode('auto')}>auto</button>
    </div>
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
  document.documentElement.removeAttribute('data-bs-theme')
})

describe('ThemeProvider', () => {
  it('applies the selected theme to the document and persists it', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )

    await user.click(screen.getByText('dark'))
    expect(screen.getByTestId('mode')).toHaveTextContent('dark')
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark')
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark')
    expect(localStorage.getItem('cc-theme')).toBe('dark')
  })

  it('restores a persisted theme on mount', () => {
    localStorage.setItem('cc-theme', 'light')
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('mode')).toHaveTextContent('light')
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('light')
  })

  it('follows the system preference in auto mode and reacts to changes', async () => {
    let onChange: (() => void) | null = null
    const mql = {
      matches: true,
      addEventListener: (_: string, cb: () => void) => {
        onChange = cb
      },
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => mql),
    )

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )

    // Default mode is auto; a dark system preference resolves to dark.
    expect(screen.getByTestId('mode')).toHaveTextContent('auto')
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark')

    // The OS flipping to light drives the resolved theme without a mode change.
    mql.matches = false
    await act(async () => {
      onChange?.()
    })
    expect(screen.getByTestId('resolved')).toHaveTextContent('light')
  })

  it('clears storage when switching back to auto', async () => {
    const user = userEvent.setup()
    localStorage.setItem('cc-theme', 'dark')
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )

    await user.click(screen.getByText('auto'))
    expect(screen.getByTestId('mode')).toHaveTextContent('auto')
    expect(localStorage.getItem('cc-theme')).toBeNull()
  })

  it('tolerates localStorage failures on read and write', async () => {
    const user = userEvent.setup()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    // A throwing read falls back to auto instead of crashing.
    expect(screen.getByTestId('mode')).toHaveTextContent('auto')

    // A throwing write is swallowed; the in-memory mode still updates.
    await user.click(screen.getByText('dark'))
    expect(screen.getByTestId('mode')).toHaveTextContent('dark')
  })

  it('throws when useTheme is used outside a provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useTheme())).toThrow(/within a ThemeProvider/)
    spy.mockRestore()
  })
})
