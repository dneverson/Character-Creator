import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CoverImage } from './CoverImage'

const ALT = "Player's Handbook cover"
const SOURCES = ['https://cdn.example/phb.webp', 'https://raw.example/phb.webp']

/** The image fetching the full cover out of sight, while it is still loading. */
function preloader(container: HTMLElement): HTMLImageElement {
  return container.querySelector('img[hidden]') as HTMLImageElement
}

describe('CoverImage', () => {
  it('opens a lightbox on click and closes it again', async () => {
    const user = userEvent.setup()
    const { container } = render(<CoverImage sources={SOURCES} alt={ALT} />)
    fireEvent.load(preloader(container))

    // Only the inline image is present initially.
    expect(screen.getAllByAltText(ALT)).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: /Enlarge/i }))

    // The modal adds a second copy of the same image.
    await waitFor(() => expect(screen.getAllByAltText(ALT)).toHaveLength(2))

    // Clicking the enlarged image closes the lightbox.
    await user.click(screen.getByRole('button', { name: /Close enlarged image/i }))
    await waitFor(() => expect(screen.getAllByAltText(ALT)).toHaveLength(1))
  })

  it('shows a spinner, never a blank, while the image is on its way', () => {
    const { container } = render(<CoverImage sources={SOURCES} alt={ALT} />)

    expect(screen.getByRole('status')).toHaveTextContent(`Loading ${ALT}`)
    expect(screen.queryByAltText(ALT)).toBeNull()

    fireEvent.load(preloader(container))
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByAltText(ALT)).toHaveAttribute('src', SOURCES[0])
  })

  it('tries the next source when one fails', () => {
    const { container } = render(<CoverImage sources={SOURCES} alt={ALT} />)

    fireEvent.error(preloader(container))
    expect(preloader(container)).toHaveAttribute('src', SOURCES[1])

    fireEvent.load(preloader(container))
    expect(screen.getByAltText(ALT)).toHaveAttribute('src', SOURCES[1])
  })

  it('says so when no source has the image', () => {
    const { container } = render(<CoverImage sources={SOURCES} alt={ALT} />)
    fireEvent.error(preloader(container))
    fireEvent.error(preloader(container))

    expect(screen.getByText(`${ALT} not available`)).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('button', { name: /Enlarge/i })).toBeNull()
  })

  it('shows the thumbnail until the full image has arrived', () => {
    const { container } = render(
      <CoverImage
        sources={SOURCES}
        alt={ALT}
        thumb={{ status: 'ready', url: 'blob:thumb' }}
      />,
    )
    expect(screen.getByAltText(ALT)).toHaveAttribute('src', 'blob:thumb')

    fireEvent.load(preloader(container))
    expect(screen.getByAltText(ALT)).toHaveAttribute('src', SOURCES[0])
  })

  it('keeps the thumbnail when the full image cannot be had', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <CoverImage
        sources={SOURCES}
        alt={ALT}
        thumb={{ status: 'ready', url: 'blob:thumb' }}
      />,
    )
    fireEvent.error(preloader(container))
    fireEvent.error(preloader(container))
    expect(screen.getByAltText(ALT)).toHaveAttribute('src', 'blob:thumb')

    // Enlarging explains why there is nothing bigger to see.
    await user.click(screen.getByRole('button', { name: /Enlarge/i }))
    expect(
      await screen.findByText('The full-size cover could not be loaded.'),
    ).toBeInTheDocument()
  })

  it('waits for a thumbnail that is still loading before giving up', () => {
    const { container } = render(
      <CoverImage sources={SOURCES} alt={ALT} thumb={{ status: 'loading' }} />,
    )
    fireEvent.error(preloader(container))
    fireEvent.error(preloader(container))
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

describe('CoverImage, compact', () => {
  it('shows only the thumbnail and leaves the full image alone', () => {
    const { container } = render(
      <CoverImage
        compact
        sources={SOURCES}
        alt={ALT}
        thumb={{ status: 'ready', url: 'blob:thumb' }}
      />,
    )
    expect(screen.getByAltText(ALT)).toHaveAttribute('src', 'blob:thumb')
    expect(container.querySelectorAll('img')).toHaveLength(1)
  })

  it('shows a spinner while the thumbnail loads', () => {
    render(
      <CoverImage compact sources={SOURCES} alt={ALT} thumb={{ status: 'loading' }} />,
    )
    expect(screen.getByRole('status')).toHaveTextContent(`Loading ${ALT}`)
  })

  it('shows a placeholder when there is no thumbnail to be had', () => {
    const { rerender } = render(
      <CoverImage
        compact
        sources={SOURCES}
        alt={ALT}
        thumb={{ status: 'unavailable' }}
      />,
    )
    expect(screen.getByText(`${ALT} not available`)).toBeInTheDocument()

    rerender(<CoverImage compact sources={SOURCES} alt={ALT} />)
    expect(screen.getByText(`${ALT} not available`)).toBeInTheDocument()
  })

  it('fetches the full image when enlarged, with a spinner until it arrives', async () => {
    const user = userEvent.setup()
    render(
      <CoverImage
        compact
        rovingTarget
        sources={SOURCES}
        alt={ALT}
        thumb={{ status: 'ready', url: 'blob:thumb' }}
      />,
    )
    const enlarge = screen.getByRole('button', { name: /Enlarge/i })
    // In a grid the row is the tab stop; the image is reached with the arrow keys.
    expect(enlarge).toHaveAttribute('tabindex', '-1')
    expect(enlarge).toHaveAttribute('data-nav-target', 'image')

    await user.click(enlarge)
    const dialog = await screen.findByRole('dialog')
    const full = dialog.querySelector('img') as HTMLImageElement
    expect(full).toHaveAttribute('src', SOURCES[0])
    expect(full).not.toBeVisible()
    expect(dialog.querySelector('[role="status"]')).not.toBeNull()

    // The first host fails; the second answers.
    fireEvent.error(full)
    expect(dialog.querySelector('img')).toHaveAttribute('src', SOURCES[1])
    fireEvent.load(dialog.querySelector('img') as HTMLImageElement)
    expect(dialog.querySelector('img')).toBeVisible()
    expect(dialog.querySelector('[role="status"]')).toBeNull()
  })

  it('starts afresh when it is given another image', () => {
    const { container, rerender } = render(<CoverImage sources={SOURCES} alt={ALT} />)
    fireEvent.error(preloader(container))
    fireEvent.error(preloader(container))
    expect(screen.getByText(`${ALT} not available`)).toBeInTheDocument()

    rerender(<CoverImage sources={['https://cdn.example/mm.webp']} alt="Other cover" />)
    expect(preloader(container)).toHaveAttribute('src', 'https://cdn.example/mm.webp')
  })
})
