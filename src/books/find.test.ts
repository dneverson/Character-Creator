import { describe, expect, it } from 'vitest'
import { fixtureSections } from '../test/bookFixture'
import { chaptersWith } from './find'
import { scan } from './outline'

const book = scan(fixtureSections)

describe('chaptersWith', () => {
  it('lists the chapters whose text holds every word, in order', () => {
    expect(chaptersWith(book, ['packing'])).toEqual([0, 1])
    expect(chaptersWith(book, ['second', 'pack'])).toEqual([1])
    expect(chaptersWith(book, ['lant', 'bur'])).toEqual([0])
  })

  it('lists none when no block holds all the words, or there are no words', () => {
    expect(chaptersWith(book, ['dragon', 'lantern'])).toEqual([])
    expect(chaptersWith(book, [])).toEqual([])
  })
})
