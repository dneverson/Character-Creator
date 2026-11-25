import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAccountStore } from '../../cloud/account'
import { useSyncStatus } from '../../cloud/sync'
import { alice, fakeAccount, resetAccountState } from '../../test/accountFixtures'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { AccountButton } from './AccountButton'
import { SignInModal } from './SignInModal'
import { useSignInModal } from './signInModalState'

beforeEach(() => {
  resetAccountState()
  useSignInModal.setState({ open: false })
})
afterEach(() => vi.useRealTimers())

function renderButton(account = fakeAccount()) {
  render(
    <ThemeProvider>
      <AccountButton account={account} />
      <SignInModal account={account} />
    </ThemeProvider>,
  )
  return account
}

const menuButton = () => screen.getByRole('button', { name: /Account menu/ })

describe('AccountButton, signed out', () => {
  it('opens the sign-in window and leaves the page where it is', async () => {
    const hash = window.location.hash
    renderButton()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAccessibleName('Sign in')
    expect(window.location.hash).toBe(hash)
  })

  it('closes the window with its close button', async () => {
    renderButton()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await screen.findByRole('dialog')
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(useSignInModal.getState().open).toBe(false)
  })

  it('closes the window by itself once the user is signed in', async () => {
    renderButton()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await screen.findByRole('dialog')
    act(() => useAccountStore.setState({ session: alice }))
    expect(useSignInModal.getState().open).toBe(false)
    expect(menuButton()).toBeInTheDocument()
  })
})

describe('AccountButton, signed in', () => {
  beforeEach(() => useAccountStore.setState({ session: alice }))

  it('shows the initial of the account in a circle, named for the screen reader', () => {
    renderButton()
    expect(menuButton()).toHaveTextContent('A')
    expect(menuButton()).toHaveAccessibleName(
      'Account menu, signed in as alice@example.test',
    )
  })

  it('shows a question mark for an account whose address is blank', () => {
    useAccountStore.setState({ session: { userId: 'u2', email: ' ' } })
    renderButton()
    expect(menuButton()).toHaveTextContent('?')
  })

  it('lists the email, how the saving is going, and the actions', async () => {
    useSyncStatus.setState({ state: 'idle', lastSyncedAt: Date.now() - 120_000 })
    renderButton()
    await userEvent.click(menuButton())
    expect(screen.getByText('alice@example.test')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Saved to cloud 2 minutes ago')
    expect(screen.getByRole('button', { name: 'Sync now' })).toBeEnabled()
    expect(screen.getByRole('link', { name: 'Account settings' })).toHaveAttribute(
      'href',
      '#/account',
    )
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it.each([
    ['syncing', 'Saving...'],
    ['offline', 'Offline - will save when back online'],
    ['error', 'Could not save - try again'],
  ] as const)('says when the saving is %s', async (state, text) => {
    useSyncStatus.setState({ state })
    renderButton()
    await userEvent.click(menuButton())
    expect(screen.getByRole('status')).toHaveTextContent(text)
  })

  it('cannot start another sync while one is running', async () => {
    useSyncStatus.setState({ state: 'syncing' })
    renderButton()
    await userEvent.click(menuButton())
    expect(screen.getByRole('button', { name: 'Sync now' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('keeps the time up to date while the menu is open', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    useSyncStatus.setState({ state: 'idle', lastSyncedAt: Date.now() })
    renderButton()
    await userEvent.click(menuButton())
    expect(screen.getByRole('status')).toHaveTextContent('just now')
    act(() => void vi.advanceTimersByTime(3 * 60_000))
    expect(screen.getByRole('status')).toHaveTextContent('3 minutes ago')
  })

  it('syncs and signs out from the menu', async () => {
    const account = renderButton()
    await userEvent.click(menuButton())
    await userEvent.click(screen.getByRole('button', { name: 'Sync now' }))
    expect(account.syncNow).toHaveBeenCalled()
    await userEvent.click(menuButton())
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(account.signOut).toHaveBeenCalled()
  })

  it('cannot sign out while the account is busy', async () => {
    useAccountStore.setState({ busy: true })
    renderButton()
    await userEvent.click(menuButton())
    expect(screen.getByRole('button', { name: 'Sign out' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })
})
