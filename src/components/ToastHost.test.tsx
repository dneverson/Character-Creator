import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { appConfig } from '../config/app'
import { showToast, useToasts } from '../ui/toasts'
import { ToastHost } from './ToastHost'

beforeEach(() => useToasts.setState({ toasts: [] }))
afterEach(() => vi.useRealTimers())

describe('ToastHost', () => {
  it('shows a toast and announces it, and lets the user dismiss it', async () => {
    render(<ToastHost />)
    act(() => showToast('Signed in as a@example.test'))
    expect(screen.getByRole('alert')).toHaveTextContent('Signed in as a@example.test')
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('hides a toast by itself after the configured time', () => {
    vi.useFakeTimers()
    render(<ToastHost />)
    act(() => showToast('Your account was deleted.'))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    act(() => void vi.advanceTimersByTime(appConfig.toastMs + 1000))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
