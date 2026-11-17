import { beforeEach, describe, expect, it } from 'vitest'
import { appConfig } from '../config/app'
import {
  clampColumn,
  clampSidebar,
  recallColumnWidth,
  rememberColumnWidth,
  recallPlace,
  recallSidebarWidth,
  rememberPlace,
  rememberSidebarWidth,
} from './memory'

beforeEach(() => localStorage.clear())

describe('the place each book was left at', () => {
  it('is nothing for a book not read yet', () => {
    expect(recallPlace('book', 'PHB')).toBeNull()
  })

  it('is kept per book and per kind', () => {
    rememberPlace('book', 'PHB', { chapter: 2, anchor: 'a' })
    rememberPlace('adventure', 'PHB', { chapter: 5, anchor: null })
    expect(recallPlace('book', 'PHB')).toEqual({ chapter: 2, anchor: 'a' })
    expect(recallPlace('adventure', 'PHB')).toEqual({ chapter: 5, anchor: null })
  })

  it('is not read from what is not a place', () => {
    localStorage.setItem('cc-book-places', '{"book/PHB":{"chapter":-3,"anchor":null}}')
    expect(recallPlace('book', 'PHB')).toBeNull()
    localStorage.setItem('cc-book-places', '[1]')
    expect(recallPlace('book', 'PHB')).toBeNull()
    localStorage.setItem('cc-book-places', 'not json')
    expect(recallPlace('book', 'PHB')).toBeNull()
  })
})

describe('the width of the chapter list', () => {
  const { min, max, width } = appConfig.books.sidebar

  it('starts at the default', () => {
    expect(recallSidebarWidth()).toBe(width)
  })

  it('is remembered, rounded', () => {
    rememberSidebarWidth(321.6)
    expect(recallSidebarWidth()).toBe(322)
  })

  it('stays within the limits, however it was stored', () => {
    expect(clampSidebar(1)).toBe(min)
    expect(clampSidebar(99999)).toBe(max)
    localStorage.setItem('cc-book-sidebar', '99999')
    expect(recallSidebarWidth()).toBe(max)
    localStorage.setItem('cc-book-sidebar', 'wide')
    expect(recallSidebarWidth()).toBe(width)
  })
})

describe('the width of the text column', () => {
  it('is the default until one is chosen, and is kept within its bounds', () => {
    const { width, min, max } = appConfig.books.column
    expect(recallColumnWidth()).toBe(width)
    rememberColumnWidth(900.4)
    expect(recallColumnWidth()).toBe(900)
    expect(clampColumn(1)).toBe(min)
    expect(clampColumn(99999)).toBe(max)
    localStorage.setItem('cc-book-column', 'wide')
    expect(recallColumnWidth()).toBe(width)
    localStorage.setItem('cc-book-column', '99999')
    expect(recallColumnWidth()).toBe(max)
  })
})
