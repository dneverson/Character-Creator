import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useContentStatus } from '../../content/library'
import { useContentSettings } from '../../content/settings'
import { fakeLibrary } from '../../test/fakeLibrary'
import { ContentNotice } from './ContentNotice'

vi.mock('../../content', async () => ({
  contentLibrary: (await import('../../test/fakeLibrary')).fakeLibrary,
}))

beforeEach(() => {
  vi.clearAllMocks()
  useContentSettings.setState({ fullContent: true })
  useContentStatus.setState({ activity: 'idle', unreachable: false })
})

describe('ContentNotice', () => {
  it('shows nothing while the source is fine', () => {
    const { container } = render(<ContentNotice />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows nothing on the free rules, whatever became of the source', () => {
    useContentSettings.setState({ fullContent: false })
    useContentStatus.setState({ unreachable: true })
    const { container } = render(<ContentNotice />)
    expect(container).toBeEmptyDOMElement()
  })

  it('says the source could not be reached and tries again when asked', async () => {
    const user = userEvent.setup()
    useContentStatus.setState({ unreachable: true })
    render(<ContentNotice />)

    expect(screen.getByRole('alert')).toHaveTextContent(/could not be reached/)
    expect(screen.getByRole('alert')).toHaveTextContent(/free rules/)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(fakeLibrary.retry).toHaveBeenCalledTimes(1)
  })

  it('survives a retry that fails outright', async () => {
    const user = userEvent.setup()
    fakeLibrary.retry.mockRejectedValueOnce(new Error('storage failed'))
    useContentStatus.setState({ unreachable: true })
    render(<ContentNotice />)

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('can be put away until the source next fails', async () => {
    const user = userEvent.setup()
    useContentStatus.setState({ unreachable: true })
    const { container } = render(<ContentNotice />)

    await user.click(screen.getByRole('button', { name: 'Close alert' }))
    expect(container).toBeEmptyDOMElement()

    // The source answers again, then fails again: the notice is back.
    act(() => useContentStatus.setState({ unreachable: false }))
    act(() => useContentStatus.setState({ unreachable: true }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
