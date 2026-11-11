import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useContentSettings } from '../../content/settings'
import { fakeLibrary } from '../../test/fakeLibrary'
import { ContentPrompt } from './ContentPrompt'

vi.mock('../../content', async () => ({
  contentLibrary: (await import('../../test/fakeLibrary')).fakeLibrary,
}))

beforeEach(() => {
  vi.clearAllMocks()
  // The visitor has not chosen yet.
  useContentSettings.setState({ fullContent: null })
})

describe('ContentPrompt', () => {
  it('asks nothing when the app downloads automatically', () => {
    render(<ContentPrompt mode="automatic" />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('follows the configured mode by default', () => {
    render(<ContentPrompt />)
    // The app ships in automatic mode; switching the config to 'prompt' turns
    // this question on.
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('asks once, saying what downloading means', () => {
    render(<ContentPrompt mode="prompt" />)
    const dialog = screen.getByRole('dialog', { name: 'Download the full book content?' })
    expect(dialog).toHaveTextContent(/hosts only the free rules/)
    expect(dialog).toHaveTextContent(/does not host it/)
  })

  it('downloads the full content when the visitor accepts', async () => {
    const user = userEvent.setup()
    render(<ContentPrompt mode="prompt" />)
    await user.click(screen.getByRole('button', { name: 'Download the full content' }))
    expect(fakeLibrary.enable).toHaveBeenCalledTimes(1)
  })

  it('stays on the free rules when the visitor declines', async () => {
    const user = userEvent.setup()
    render(<ContentPrompt mode="prompt" />)
    await user.click(screen.getByRole('button', { name: 'Use the free rules only' }))
    expect(fakeLibrary.disable).toHaveBeenCalledTimes(1)
  })

  it('is not asked again once the visitor has chosen', () => {
    useContentSettings.setState({ fullContent: false })
    render(<ContentPrompt mode="prompt" />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
