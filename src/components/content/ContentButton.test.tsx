import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useContentStatus } from '../../content/library'
import { useContentSettings } from '../../content/settings'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { ContentButton } from './ContentButton'

vi.mock('../../content', async () => ({
  contentLibrary: (await import('../../test/fakeLibrary')).fakeLibrary,
}))

function renderButton() {
  return render(
    <ThemeProvider>
      <ContentButton />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  useContentStatus.setState({
    activity: 'idle',
    done: 0,
    total: 0,
    complete: false,
    unreachable: false,
  })
})

describe('ContentButton', () => {
  it('names the content in use', () => {
    renderButton()
    const button = screen.getByRole('button', { name: 'Book content: Free rules' })
    expect(button).toHaveTextContent('Free rules')
    expect(button.querySelector('.bi-book-fill')).not.toBeNull()
  })

  it('shows a spinner and the count while a download runs', () => {
    useContentSettings.setState({ fullContent: true })
    useContentStatus.setState({ activity: 'downloading', done: 3, total: 10 })
    renderButton()
    const button = screen.getByRole('button', { name: 'Book content: Downloading 3/10' })
    expect(button.querySelector('.spinner-border')).not.toBeNull()
  })

  it('warns when the source cannot be reached', () => {
    useContentSettings.setState({ fullContent: true })
    useContentStatus.setState({ unreachable: true })
    renderButton()
    const button = screen.getByRole('button', {
      name: 'Book content: Source unreachable',
    })
    expect(button.querySelector('.bi-exclamation-triangle-fill')).not.toBeNull()
  })

  it('opens and closes the Book content window', async () => {
    const user = userEvent.setup()
    renderButton()
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(screen.getByRole('button', { name: /Book content/ }))
    expect(
      await screen.findByRole('dialog', { name: 'Book content' }),
    ).toBeInTheDocument()

    // The window fades out before it leaves the page.
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
