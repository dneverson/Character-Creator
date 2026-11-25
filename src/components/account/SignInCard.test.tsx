import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAccountStore } from '../../cloud/account'
import { appConfig } from '../../config/app'
import { fakeAccount, resetAccountState } from '../../test/accountFixtures'
import { SignInCard } from './SignInCard'

beforeEach(resetAccountState)
afterEach(() => vi.useRealTimers())

const email = () => screen.getByLabelText('Email address')

describe('sign-in, step one: the address', () => {
  it('says why, asks for the address with the right field hints, and has the focus', () => {
    render(<SignInCard account={fakeAccount()} headingLevel={2} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByText(/Keep your characters in the cloud/)).toHaveTextContent(
      'Optional - the app works fully without an account.',
    )
    expect(email()).toHaveAttribute('type', 'email')
    expect(email()).toHaveAttribute('autocomplete', 'email')
    expect(email()).toHaveFocus()
  })

  it('can be the heading of the page', () => {
    render(<SignInCard account={fakeAccount()} headingLevel={1} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument()
  })

  it('sends the code for the trimmed address', async () => {
    const account = fakeAccount()
    render(<SignInCard account={account} headingLevel={2} />)
    await userEvent.type(email(), ' alice@example.test ')
    await userEvent.click(screen.getByRole('button', { name: 'Email me a sign-in code' }))
    expect(account.sendLink).toHaveBeenCalledWith('alice@example.test')
  })

  it('asks for an address when there is none, and then clears the message', async () => {
    const account = fakeAccount()
    render(<SignInCard account={account} headingLevel={2} />)
    await userEvent.click(screen.getByRole('button', { name: 'Email me a sign-in code' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your email address.')
    expect(email()).toHaveAttribute('aria-invalid', 'true')
    expect(account.sendLink).not.toHaveBeenCalled()
    await userEvent.type(email(), 'a')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('says so when the address is not an address', async () => {
    const account = fakeAccount()
    render(<SignInCard account={account} headingLevel={2} />)
    await userEvent.type(email(), 'not-an-email')
    await userEvent.click(screen.getByRole('button', { name: 'Email me a sign-in code' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address')
    expect(account.sendLink).not.toHaveBeenCalled()
  })

  it('shows what the server said under the field', () => {
    useAccountStore.setState({ step: 'failed', error: 'The code could not be sent.' })
    render(<SignInCard account={fakeAccount()} headingLevel={2} />)
    expect(screen.getByRole('alert')).toHaveTextContent('The code could not be sent.')
    expect(email()).toHaveAccessibleDescription('The code could not be sent.')
  })

  it('shows a spinner and locks the button while sending', () => {
    useAccountStore.setState({ step: 'sending' })
    render(<SignInCard account={fakeAccount()} headingLevel={2} />)
    expect(screen.getByRole('button', { name: 'Sending...' })).toBeDisabled()
  })

  it('links the terms and the privacy policy, and closes a window around it on the way', async () => {
    const onNavigate = vi.fn()
    render(
      <SignInCard account={fakeAccount()} headingLevel={2} onNavigate={onNavigate} />,
    )
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '#/terms')
    await userEvent.click(screen.getByRole('link', { name: 'Privacy policy' }))
    expect(screen.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute(
      'href',
      '#/privacy',
    )
    expect(onNavigate).toHaveBeenCalled()
    expect(screen.getByText(/13 or older/)).toBeInTheDocument()
  })
})

describe('sign-in, step two: the code', () => {
  const sentNow = (extra: object = {}) =>
    useAccountStore.setState({
      step: 'sent',
      codeSent: true,
      sentTo: 'alice@example.test',
      sentAt: Date.now(),
      ...extra,
    })

  it('says where the code went and offers one box for each digit', () => {
    sentNow()
    render(<SignInCard account={fakeAccount()} headingLevel={2} titleId="t" />)
    expect(
      screen.getByRole('heading', { level: 2, name: 'Check your email' }),
    ).toHaveAttribute('id', 't')
    expect(screen.getByText(/We sent a 6-digit code to/)).toHaveTextContent(
      'alice@example.test',
    )
    expect(screen.getByRole('group', { name: '6-digit code' })).toBeInTheDocument()
    expect(screen.getAllByRole('textbox')).toHaveLength(appConfig.cloud.codeLength)
    expect(
      screen.getByText('Or open the link in the email on this device.'),
    ).toBeVisible()
  })

  it('checks the code as soon as the sixth digit is typed', async () => {
    sentNow()
    const account = fakeAccount()
    render(<SignInCard account={account} headingLevel={2} />)
    await userEvent.keyboard('123456')
    expect(account.verifyCode).toHaveBeenCalledWith('123456')
  })

  it('shows that it is checking, with the boxes locked', () => {
    sentNow({ step: 'verifying' })
    render(<SignInCard account={fakeAccount()} headingLevel={2} />)
    expect(screen.getByRole('status')).toHaveTextContent('Checking your code...')
    expect(screen.getAllByRole('textbox')[0]).toBeDisabled()
  })

  it('says a wrong code is wrong, clears the boxes and puts the cursor back', async () => {
    sentNow()
    const account = fakeAccount()
    render(<SignInCard account={account} headingLevel={2} />)
    await userEvent.keyboard('111111')
    expect(screen.getAllByRole('textbox')[5]).toHaveValue('1')
    act(() =>
      useAccountStore.setState({
        step: 'sent',
        error: 'That code did not work. Check it or send a new one.',
      }),
    )
    expect(screen.getByRole('alert')).toHaveTextContent('That code did not work.')
    const boxes = screen.getAllByRole('textbox')
    for (const box of boxes) expect(box).toHaveValue('')
    expect(boxes[0]).toHaveFocus()
    expect(boxes[0]).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows a failure to send a new code', () => {
    sentNow({ step: 'failed', error: 'The code could not be sent.' })
    render(<SignInCard account={fakeAccount()} headingLevel={2} />)
    expect(screen.getByRole('alert')).toHaveTextContent('The code could not be sent.')
  })

  it('counts down before another code can be asked for', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0))
    sentNow({ sentAt: Date.now() - 18_000 })
    render(<SignInCard account={fakeAccount()} headingLevel={2} />)
    const resend = screen.getByRole('button', { name: /Send a new code/ })
    expect(resend).toHaveTextContent('Send a new code in 42 s')
    expect(resend).toBeDisabled()
    act(() => void vi.advanceTimersByTime(41_000))
    expect(resend).toHaveTextContent('Send a new code in 1 s')
    act(() => void vi.advanceTimersByTime(1000))
    expect(resend).toHaveTextContent('Send a new code')
    expect(resend).not.toHaveTextContent(' s')
    expect(resend).toBeEnabled()
  })

  it('sends a new code to the same address when asked, and says so', async () => {
    sentNow({ sentAt: Date.now() - appConfig.cloud.resendSeconds * 1000 - 1000 })
    const account = fakeAccount()
    render(<SignInCard account={account} headingLevel={2} />)
    await userEvent.click(screen.getByRole('button', { name: 'Send a new code' }))
    expect(account.sendLink).toHaveBeenCalledWith('alice@example.test')
    expect(screen.getByRole('status')).toHaveTextContent('We sent a new code.')
  })

  it('shows that a new code is being sent', () => {
    sentNow({ step: 'sending', sentAt: null })
    render(<SignInCard account={fakeAccount()} headingLevel={2} />)
    expect(screen.getByRole('button', { name: 'Sending...' })).toBeDisabled()
  })

  it('goes back to the address with it kept in the field', async () => {
    const account = fakeAccount()
    account.backToEmail = vi.fn(() =>
      useAccountStore.setState({ step: 'idle', codeSent: false, sentAt: null }),
    )
    sentNow()
    render(<SignInCard account={account} headingLevel={2} />)
    await userEvent.click(screen.getByRole('button', { name: 'Use a different email' }))
    expect(account.backToEmail).toHaveBeenCalled()
    expect(email()).toHaveValue('alice@example.test')
  })
})
