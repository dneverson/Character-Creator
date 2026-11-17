import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { EntryContext } from '../text/entryContext'
import { TaggedText } from '../text/TaggedText'
import { BookLink } from './BookLink'
import { useBookStore } from './state'
import type { BookPlace } from './types'

const place: BookPlace = { kind: 'book', id: 'PHB', chapter: 2, anchor: 'a', find: null }

beforeEach(() => useBookStore.setState({ open: false, place: null, request: 0 }))

describe('BookLink', () => {
  it('is a real address that opens the reader there', () => {
    render(<BookLink place={place}>Chapter</BookLink>)
    const link = screen.getByRole('link', { name: 'Chapter' })
    expect(link).toHaveAttribute('href', '#/book/PHB/2/a')
    fireEvent.click(link)
    expect(useBookStore.getState()).toMatchObject({ open: true, place })
  })

  it('leaves a click meant for a new tab to the browser', () => {
    render(<BookLink place={place}>Chapter</BookLink>)
    fireEvent.click(screen.getByRole('link'), { ctrlKey: true })
    fireEvent.click(screen.getByRole('link'), { button: 1 })
    expect(useBookStore.getState().open).toBe(false)
  })
})

describe('a book tag in a text', () => {
  const inReader = (text: string) =>
    render(
      <EntryContext.Provider value={{ book: true, words: [] }}>
        <TaggedText text={text} />
      </EntryContext.Provider>,
    )

  it('is a link to its place in the reader', () => {
    inReader('See {@book chapter 3|PHB|3|Spell Slots} and {@adventure the start|CoS|0}.')
    expect(screen.getByRole('link', { name: 'chapter 3' })).toHaveAttribute(
      'href',
      '#/book/PHB/3/spell-slots',
    )
    expect(screen.getByRole('link', { name: 'the start' })).toHaveAttribute(
      'href',
      '#/adventure/CoS/0',
    )
  })

  it('is plain text outside the reader', () => {
    render(<TaggedText text="See {@book chapter 3|PHB|3}." />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('See chapter 3.')).toBeInTheDocument()
  })
})

describe('the styling tags', () => {
  it.each([
    ['{@i slanted}', 'EM'],
    ['{@italic slanted}', 'EM'],
    ['{@b heavy}', 'STRONG'],
    ['{@bold heavy}', 'STRONG'],
    ['{@u under}', 'U'],
    ['{@s gone}', 'S'],
    ['{@strike gone}', 'S'],
    ['{@sup raised}', 'SUP'],
  ])('%s is drawn as %s', (text, element) => {
    const { container } = render(<TaggedText text={text} />)
    expect(container.firstElementChild?.tagName).toBe(element)
  })

  it('draws a note, and styles inside styles', () => {
    const { container } = render(<TaggedText text="{@note Take {@b care}.}" />)
    expect(container.querySelector('span.entry-note strong')?.textContent).toBe('care')
  })

  it('leaves a tag it does not know as its text', () => {
    render(<TaggedText text="{@unknown thing|x}" />)
    expect(screen.getByText('thing')).toBeInTheDocument()
  })
})
