import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { markWords } from './highlight'

function marked(text: string, words: string[]) {
  const { container } = render(<p>{markWords(text, words)}</p>)
  return [...container.querySelectorAll('mark')].map((m) => m.textContent)
}

describe('markWords', () => {
  it('marks each word that starts with a searched word', () => {
    expect(marked('The dragon, dragons and a Dragonborn', ['dragon'])).toEqual([
      'dragon',
      'dragons',
      'Dragonborn',
    ])
  })

  it('marks only the start of a word', () => {
    expect(marked('Wyvern and dragon', ['rag'])).toEqual([])
  })

  it('marks every searched word', () => {
    expect(marked('red dragon', ['red', 'drag'])).toEqual(['red', 'dragon'])
  })

  it('takes characters that mean something to a pattern as they are', () => {
    expect(marked('a (b) c', ['(b'])).toEqual(['(b'])
    expect(marked('abc a.c', ['a.c'])).toEqual(['a.c'])
  })

  it('gives the text back when there is nothing to mark', () => {
    expect(markWords('plain', [])).toBe('plain')
    expect(markWords('', ['a'])).toBe('')
    expect(markWords('plain', ['zzz'])).toBe('plain')
  })

  it('keeps the text around a mark', () => {
    const { container } = render(<p>{markWords('before dragon after', ['dragon'])}</p>)
    expect(container.textContent).toBe('before dragon after')
  })
})
