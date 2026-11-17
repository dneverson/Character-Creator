import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useBookStore } from '../../books/state'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { BooksButton } from './BooksButton'

afterEach(() => useBookStore.getState().closeBooks())

describe('BooksButton', () => {
  it('opens the shelf with a click and with the key, and names the key', () => {
    render(
      <ThemeProvider>
        <BooksButton />
      </ThemeProvider>,
    )
    const button = screen.getByRole('button', { name: 'Books' })
    expect(button).toHaveAttribute('aria-keyshortcuts', 'b')
    fireEvent.keyDown(document.body, { key: 'b' })
    expect(useBookStore.getState()).toMatchObject({ open: true, place: null })
    useBookStore.getState().closeBooks()
    fireEvent.click(button)
    expect(useBookStore.getState().open).toBe(true)
  })

  it('leaves a reader that is open where it is', () => {
    render(
      <ThemeProvider>
        <BooksButton />
      </ThemeProvider>,
    )
    const place = {
      kind: 'book' as const,
      id: 'PHB',
      chapter: 2,
      anchor: null,
      find: null,
    }
    useBookStore.getState().openBook(place)
    fireEvent.keyDown(document.body, { key: 'b' })
    expect(useBookStore.getState().place).toEqual(place)
  })
})
