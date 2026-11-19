import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Heading } from '../../books/outline'
import { BookOutline } from './BookOutline'

const doc = { kind: 'book', id: 'TST' } as const
const headings: Heading[] = [
  { chapter: 0, anchor: 'one', name: 'One', depth: 0, box: false },
  { chapter: 0, anchor: 'ape', name: 'Ape', depth: 1, box: false },
  { chapter: 0, anchor: 'bat', name: 'Bat', depth: 1, box: false },
]

/** A list box 100px high whose rows stand 40px apart, scrolled by `body.scrollTop`. */
function layout() {
  const rect = vi
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockImplementation(function (this: Element) {
      const body = this.closest<HTMLElement>('.book-contents-body')
      let top = 0
      let height = 0
      if (this === body) height = 100
      else if (body && this.tagName === 'BUTTON' && this.textContent) {
        const rows = [...body.querySelectorAll('button.book-tree-link')]
        top = rows.indexOf(this) * 40 - body.scrollTop
        height = 30
      }
      return { top, bottom: top + height, height } as DOMRect
    })
  return rect
}

afterEach(() => vi.restoreAllMocks())

const show = (current: string | null, following = true) => (
  <div className="book-contents-body">
    <BookOutline
      doc={doc}
      headings={headings}
      chapter={0}
      current={current}
      onGo={() => {}}
      onPick={() => {}}
      following={following}
    />
  </div>
)

const body = () => document.querySelector<HTMLElement>('.book-contents-body')!

describe('the list following the heading at the reading line', () => {
  it('scrolls by the least that brings the highlighted line into view', () => {
    layout()
    const { rerender } = render(show(null))
    expect(body().scrollTop).toBe(0)
    // Rows: One (0), Ape (40), Bat (80, bottom 110 past the 100px box).
    rerender(show('bat'))
    expect(body().scrollTop).toBe(10)
    rerender(show('ape'))
    expect(body().scrollTop).toBe(10)
    body().scrollTop = 200
    rerender(show(null))
    expect(body().scrollTop).toBe(0)
  })

  it('does not move under a pointer over it, and follows after it leaves', () => {
    layout()
    const { rerender } = render(show(null))
    const nav = screen.getByRole('navigation', { name: 'Chapters and headings' })
    fireEvent.pointerEnter(nav)
    rerender(show('bat'))
    expect(body().scrollTop).toBe(0)
    fireEvent.pointerLeave(nav)
    rerender(show('ape'))
    rerender(show('bat'))
    expect(body().scrollTop).toBe(10)
  })

  it('does not move while a touch or the wheel is on it, nor while its box has focus', () => {
    layout()
    const { rerender } = render(show(null))
    const nav = screen.getByRole('navigation', { name: 'Chapters and headings' })
    for (const [start, end] of [
      [() => fireEvent.touchStart(nav), () => fireEvent.touchEnd(nav)],
      [() => fireEvent.wheel(nav), () => fireEvent.pointerLeave(nav)],
      [() => fireEvent.touchStart(nav), () => fireEvent.touchCancel(nav)],
    ] as const) {
      body().scrollTop = 0
      start()
      rerender(show('bat'))
      expect(body().scrollTop).toBe(0)
      end()
      rerender(show(null))
    }
    const box = screen.getByRole('searchbox', { name: 'Search this book' })
    fireEvent.focus(box)
    rerender(show('bat'))
    expect(body().scrollTop).toBe(0)
    fireEvent.blur(box)
    rerender(show(null))
    rerender(show('bat'))
    expect(body().scrollTop).toBe(10)
  })

  it('leaves a button that is not the box alone when it takes focus', () => {
    layout()
    const { rerender } = render(show(null))
    fireEvent.focus(screen.getByRole('button', { name: 'Bat' }))
    rerender(show('bat'))
    expect(body().scrollTop).toBe(10)
    fireEvent.blur(screen.getByRole('button', { name: 'Bat' }))
  })

  it('does not follow while the list is hidden, and does when it is shown', () => {
    layout()
    const { rerender } = render(show('bat', false))
    expect(body().scrollTop).toBe(0)
    rerender(show('bat', true))
    expect(body().scrollTop).toBe(10)
  })

  it('does nothing when the box has no height (a hidden drawer)', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 0,
      height: 0,
    } as DOMRect)
    render(show('bat'))
    expect(body().scrollTop).toBe(0)
  })
})
