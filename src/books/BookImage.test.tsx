import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BookImage } from './BookImage'

/** An observer the test drives by hand. */
function installObserver() {
  const reports: ((visible: boolean) => void)[] = []
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: (entries: IntersectionObserverEntry[]) => void) {
        reports.push((isIntersecting) =>
          callback([{ isIntersecting } as IntersectionObserverEntry]),
        )
      }
      observe() {}
      disconnect() {}
    },
  )
  return reports
}

afterEach(() => vi.unstubAllGlobals())

const image = {
  type: 'image' as const,
  href: { type: 'internal', path: 'book/TST/map.webp' },
  title: 'The {@b old} road',
  credit: 'An Artist',
  width: 800,
  height: 400,
  imageType: 'map',
}

describe('BookImage', () => {
  it('reserves its space, and loads nothing until it is near', () => {
    const reports = installObserver()
    const { container } = render(<BookImage image={image} root={null} />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('Loading The old road')
    expect(container.querySelector('.book-figure-frame')).toHaveStyle({
      aspectRatio: '2',
    })
    act(() => reports[0](true))
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      expect.stringContaining('book/TST/map.webp'),
    )
  })

  it('shows its caption and who made the art', () => {
    installObserver()
    render(<BookImage image={image} root={null} />)
    expect(screen.getByText(/Art: An Artist/)).toBeInTheDocument()
    expect(screen.getByText('old').tagName).toBe('STRONG')
  })

  it('stops waiting once loaded', () => {
    const reports = installObserver()
    render(<BookImage image={image} root={null} />)
    act(() => reports[0](true))
    fireEvent.load(screen.getByRole('img'))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('tries the next host, then says in words that it could not be loaded', () => {
    const reports = installObserver()
    render(<BookImage image={image} root={null} />)
    act(() => reports[0](true))
    const sources: string[] = []
    for (let i = 0; i < 10 && screen.queryByRole('img'); i++) {
      const img = screen.getByRole('img')
      sources.push(img.getAttribute('src') ?? '')
      fireEvent.error(img)
    }
    expect(new Set(sources).size).toBe(sources.length)
    expect(sources.length).toBeGreaterThan(1)
    expect(screen.getByText('This picture could not be loaded.')).toBeInTheDocument()
  })

  it('says so when the text gives no address', () => {
    installObserver()
    render(<BookImage image={{ type: 'image' }} root={null} />)
    expect(screen.getByText('This picture is not in the content.')).toBeInTheDocument()
  })
})
