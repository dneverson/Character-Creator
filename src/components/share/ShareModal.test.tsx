import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCharacter } from '../../character/model'
import { useCharacterStore } from '../../character/store'
import { useAccountStore } from '../../cloud/account'
import { CharacterNotInCloudError, CloudOfflineError } from '../../cloud/backend'
import { alice, fakeAccount, resetAccountState } from '../../test/accountFixtures'
import { useToasts } from '../../ui/toasts'
import { ShareModal } from './ShareModal'
import { useShareModal } from './shareModalState'

const TOKEN = '0123456789abcdef0123456789abcdef'
const LINK = `${window.location.origin}${import.meta.env.BASE_URL}#/shared/${TOKEN}`
const character = createCharacter('Tordek')

function open(signedIn = true) {
  resetAccountState()
  if (signedIn) useAccountStore.setState({ session: alice })
  useCharacterStore.setState({
    characters: { [character.id]: character },
    order: [character.id],
    activeId: null,
    view: 'list',
  })
  useShareModal.setState({ characterId: character.id })
}

const toasts = () => useToasts.getState().toasts.map((t) => t.message)

beforeEach(() => {
  useToasts.setState({ toasts: [] })
  useShareModal.setState({ characterId: null })
})

describe('the Share window', () => {
  it('is closed until a Share button opens it', () => {
    resetAccountState()
    render(<ShareModal account={fakeAccount()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('names the character, and starts with sharing off', async () => {
    open()
    const account = fakeAccount()
    render(<ShareModal account={account} />)
    expect(
      await screen.findByRole('dialog', { name: 'Share Tordek' }),
    ).toBeInTheDocument()
    const toggle = await screen.findByRole('switch', {
      name: 'Anyone with the link can view',
    })
    expect(toggle).not.toBeChecked()
    expect(account.getShare).toHaveBeenCalledWith(character.id)
    expect(screen.queryByRole('textbox', { name: 'Link' })).not.toBeInTheDocument()
    expect(screen.getByText(/They cannot change yours\./)).toHaveTextContent(
      'can save their own copy',
    )
  })

  it('makes a link when switched on, and shows it with a Copy link button', async () => {
    open()
    const account = fakeAccount()
    vi.mocked(account.createShare).mockResolvedValue(TOKEN)
    render(<ShareModal account={account} />)
    await userEvent.click(
      await screen.findByRole('switch', { name: 'Anyone with the link can view' }),
    )
    expect(account.createShare).toHaveBeenCalledWith(character.id)
    const field = await screen.findByRole('textbox', { name: 'Link' })
    expect(field).toHaveValue(LINK)
    expect(field).toHaveAttribute('readonly')
    expect(screen.getByRole('switch')).toBeChecked()
  })

  it('shows a link that already exists, and copies it', async () => {
    open()
    const account = fakeAccount()
    vi.mocked(account.getShare).mockResolvedValue(TOKEN)
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    render(<ShareModal account={account} />)
    expect(await screen.findByRole('textbox', { name: 'Link' })).toHaveValue(LINK)
    await userEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(writeText).toHaveBeenCalledWith(LINK)
    expect(toasts()).toContain('Link copied')
  })

  it('says so, with the link selected, when the browser will not copy', async () => {
    open()
    const account = fakeAccount()
    vi.mocked(account.getShare).mockResolvedValue(TOKEN)
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn(async () => {
          throw new Error('denied')
        }),
      },
      configurable: true,
    })
    render(<ShareModal account={account} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Copy link' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be copied/)
    expect(toasts()).not.toContain('Link copied')
  })

  it('stops sharing from the switch or the button, and says so', async () => {
    open()
    const account = fakeAccount()
    vi.mocked(account.getShare).mockResolvedValue(TOKEN)
    render(<ShareModal account={account} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Stop sharing' }))
    expect(account.stopShare).toHaveBeenCalledWith(character.id)
    await waitFor(() => expect(screen.getByRole('switch')).not.toBeChecked())
    expect(toasts()).toContain('Sharing stopped')
    expect(screen.queryByRole('textbox', { name: 'Link' })).not.toBeInTheDocument()

    vi.mocked(account.createShare).mockResolvedValue('f'.repeat(32))
    await userEvent.click(screen.getByRole('switch'))
    expect(await screen.findByRole('textbox', { name: 'Link' })).toHaveValue(
      LINK.replace(TOKEN, 'f'.repeat(32)),
    )
    await userEvent.click(screen.getByRole('switch'))
    await waitFor(() => expect(account.stopShare).toHaveBeenCalledTimes(2))
  })

  it('disables the switch while the cloud is working', async () => {
    open()
    const account = fakeAccount()
    let finish: (token: string) => void = () => {}
    vi.mocked(account.createShare).mockReturnValue(
      new Promise<string>((resolve) => (finish = resolve)),
    )
    render(<ShareModal account={account} />)
    await userEvent.click(
      await screen.findByRole('switch', { name: 'Anyone with the link can view' }),
    )
    expect(screen.getByRole('switch')).toBeDisabled()
    expect(screen.getByText('Making the link...')).toBeInTheDocument()
    finish(TOKEN)
    await screen.findByRole('textbox', { name: 'Link' })
    expect(screen.getByRole('switch')).toBeEnabled()
  })

  it('says why a link could not be made, in plain words', async () => {
    open()
    const account = fakeAccount()
    render(<ShareModal account={account} />)
    const toggle = await screen.findByRole('switch')
    vi.mocked(account.createShare).mockRejectedValueOnce(new CharacterNotInCloudError())
    await userEvent.click(toggle)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /not in your cloud copy yet/,
    )
    vi.mocked(account.createShare).mockRejectedValueOnce(new CloudOfflineError())
    await userEvent.click(screen.getByRole('switch'))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/could not be reached/),
    )
    vi.mocked(account.createShare).mockRejectedValueOnce(new Error('no'))
    await userEvent.click(screen.getByRole('switch'))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/could not be changed/),
    )
    expect(screen.getByRole('switch')).not.toBeChecked()
  })

  it('offers a retry when it cannot tell whether the character is shared', async () => {
    open()
    const account = fakeAccount()
    vi.mocked(account.getShare).mockRejectedValueOnce(new Error('no'))
    render(<ShareModal account={account} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be changed/)
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('switch')).toBeInTheDocument()
    expect(account.getShare).toHaveBeenCalledTimes(2)
  })

  it('asks a visitor to sign in first, and carries on once they are in', async () => {
    open(false)
    const account = fakeAccount()
    render(<ShareModal account={account} />)
    expect(await screen.findByText(/Sharing needs an account/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Email me a sign-in code' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    act(() => useAccountStore.setState({ session: alice }))
    expect(
      await screen.findByRole('switch', { name: 'Anyone with the link can view' }),
    ).toBeInTheDocument()
  })

  it('closes with its close button', async () => {
    open()
    render(<ShareModal account={fakeAccount()} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Close' }))
    expect(useShareModal.getState().characterId).toBeNull()
  })
})
