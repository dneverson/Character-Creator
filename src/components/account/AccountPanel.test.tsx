import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAccountStore } from '../../cloud/account'
import { useSyncStatus } from '../../cloud/sync'
import { legalConfig } from '../../config/legal'
import { useLegalStore } from '../../legal/state'
import { alice, fakeAccount, resetAccountState } from '../../test/accountFixtures'
import { formatLongDate, formatMediumDateTime } from '../../ui/date'
import { AccountPanel } from './AccountPanel'

beforeEach(() => {
  resetAccountState()
  useLegalStore.setState({ page: 'account' })
})

describe('the Account page, signed out', () => {
  it('shows the sign-in card as the page, and no settings', () => {
    render(<AccountPanel account={fakeAccount()} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
    expect(screen.queryByText('Profile')).not.toBeInTheDocument()
    expect(screen.queryByText(/Last updated/)).not.toBeInTheDocument()
  })

  it('sends the code for the address', async () => {
    const account = fakeAccount()
    render(<AccountPanel account={account} />)
    await userEvent.type(screen.getByLabelText('Email address'), 'a@example.test')
    await userEvent.click(screen.getByRole('button', { name: 'Email me a sign-in code' }))
    expect(account.sendLink).toHaveBeenCalledWith('a@example.test')
  })

  it('goes back by closing the page', async () => {
    render(<AccountPanel account={fakeAccount()} />)
    await userEvent.click(screen.getByRole('button', { name: /Back/ }))
    expect(useLegalStore.getState().page).toBeNull()
  })
})

describe('how the account and data are handled', () => {
  it('is collapsed, with the approved text unchanged inside and a link to the policy', async () => {
    render(<AccountPanel account={fakeAccount()} />)
    const toggle = screen.getByRole('button', {
      name: 'How your account and data are handled',
    })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const { intro, sections } = legalConfig.pages.account
    expect(screen.getByText(intro)).toBeInTheDocument()
    for (const section of sections) {
      expect(
        screen.getByRole('heading', { level: 3, name: new RegExp(section.heading) }),
      ).toBeInTheDocument()
    }
    expect(screen.getByText(/"Delete account" button/)).toBeInTheDocument()
    expect(
      screen.getByText(/stored on your own device are not touched/),
    ).toBeInTheDocument()
    const links = screen.getAllByRole('link', { name: 'Privacy policy' })
    expect(links).toHaveLength(2)
    for (const link of links) expect(link).toHaveAttribute('href', '#/privacy')
  })
})

describe('the Account page, signed in', () => {
  beforeEach(() => useAccountStore.setState({ session: alice }))

  it('has the profile, the cloud saving and the delete card, in that order', () => {
    render(<AccountPanel account={fakeAccount()} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Account' })).toBeInTheDocument()
    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent)
    expect(headings.slice(0, 3)).toEqual(['Profile', 'Cloud saving', 'Delete account'])
  })

  it('shows the email and the date the account was made when it is known', () => {
    const createdAt = new Date(2026, 4, 3, 10, 30).getTime()
    useAccountStore.setState({ session: { ...alice, createdAt } })
    render(<AccountPanel account={fakeAccount()} />)
    expect(screen.getByText('alice@example.test')).toBeInTheDocument()
    expect(screen.getByText('Member since')).toBeInTheDocument()
    expect(screen.getByText(formatLongDate(createdAt))).toBeInTheDocument()
  })

  it('leaves out "Member since" when the date is not known', () => {
    render(<AccountPanel account={fakeAccount()} />)
    expect(screen.queryByText('Member since')).not.toBeInTheDocument()
  })

  it('signs out', async () => {
    const account = fakeAccount()
    render(<AccountPanel account={account} />)
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(account.signOut).toHaveBeenCalled()
  })

  it('shows how the saving is going, when it last worked, and syncs on request', async () => {
    const at = Date.now()
    useSyncStatus.setState({ state: 'idle', lastSyncedAt: at })
    const account = fakeAccount()
    render(<AccountPanel account={account} />)
    expect(screen.getByRole('status')).toHaveTextContent('Saved to cloud')
    expect(screen.queryByText(/Last synced/)).not.toBeInTheDocument()
    await userEvent.hover(screen.getByText('Saved to cloud just now'))
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      `Last synced ${formatMediumDateTime(at)}`,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Sync now' }))
    expect(account.syncNow).toHaveBeenCalled()
  })

  it.each([
    ['syncing', 'Saving...'],
    ['offline', 'Offline - will save when back online'],
    ['error', 'Could not save - try again'],
  ] as const)('says when the saving is %s', (state, text) => {
    useSyncStatus.setState({ state })
    render(<AccountPanel account={fakeAccount()} />)
    expect(screen.getByRole('status')).toHaveTextContent(text)
  })

  it('locks Sync now while a sync runs', () => {
    useSyncStatus.setState({ state: 'syncing' })
    render(<AccountPanel account={fakeAccount()} />)
    expect(screen.getByRole('button', { name: 'Sync now' })).toBeDisabled()
  })

  it('shows what went wrong and locks the buttons while the account is busy', () => {
    useAccountStore.setState({ busy: true, error: 'Signing out failed. Try again.' })
    render(<AccountPanel account={fakeAccount()} />)
    expect(screen.getByText('Signing out failed. Try again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDisabled()
  })
})

describe('deleting the account', () => {
  beforeEach(() => useAccountStore.setState({ session: alice }))

  const open = async (account = fakeAccount()) => {
    render(<AccountPanel account={account} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    return { account, dialog: await screen.findByRole('dialog') }
  }

  it('says plainly what goes and what stays, and deletes nothing yet', async () => {
    const { account, dialog } = await open()
    expect(dialog).toHaveAccessibleName('Delete your account?')
    expect(dialog).toHaveTextContent('Your account and your email address.')
    expect(dialog).toHaveTextContent('Every copy of your characters in the cloud.')
    expect(dialog).toHaveTextContent('The characters stored on this device.')
    expect(dialog).toHaveTextContent('This cannot be undone.')
    expect(account.deleteAccount).not.toHaveBeenCalled()
  })

  it('keeps the red button off until the account email is typed', async () => {
    const { account, dialog } = await open()
    const red = within(dialog).getByRole('button', { name: 'Delete my account' })
    expect(red).toBeDisabled()
    const field = within(dialog).getByLabelText(/To confirm, type your email address/)
    await userEvent.type(field, 'alice@example')
    expect(red).toBeDisabled()
    await userEvent.type(field, '.test')
    expect(red).toBeEnabled()
    await userEvent.click(red)
    expect(account.deleteAccount).toHaveBeenCalledTimes(1)
  })

  it('takes the email in any case and with spaces around it, and submits with Enter', async () => {
    const { account, dialog } = await open()
    const field = within(dialog).getByLabelText(/To confirm, type your email address/)
    await userEvent.type(field, '  ALICE@example.TEST {Enter}')
    expect(account.deleteAccount).toHaveBeenCalledTimes(1)
  })

  it('does not delete on Enter before the email matches', async () => {
    const { account, dialog } = await open()
    const field = within(dialog).getByLabelText(/To confirm, type your email address/)
    await userEvent.type(field, 'someone@else.test{Enter}')
    expect(account.deleteAccount).not.toHaveBeenCalled()
  })

  it('cancels', async () => {
    const { account, dialog } = await open()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(account.deleteAccount).not.toHaveBeenCalled()
  })

  it('shows a spinner and cannot be left while deleting', async () => {
    const { dialog } = await open()
    act(() => useAccountStore.setState({ busy: true }))
    const red = await within(dialog).findByRole('button', { name: 'Deleting...' })
    expect(red).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(
      within(dialog).queryByRole('button', { name: 'Close' }),
    ).not.toBeInTheDocument()
  })

  it('shows why the deletion failed, in the window', async () => {
    const { dialog } = await open()
    act(() =>
      useAccountStore.setState({ error: 'The account could not be deleted. Try again.' }),
    )
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'could not be deleted',
    )
    expect(screen.getAllByText(/could not be deleted/)).toHaveLength(1)
  })
})
