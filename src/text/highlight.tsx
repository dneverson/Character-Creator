// Marking the words of a search in a piece of text: every word of the text that starts with
// one of the words is wrapped in <mark>.

import type { ReactNode } from 'react'

const escapeRegExp = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** What marks a word that starts with one of `words`; it also counts the marks of a text. */
export const wordPattern = (words: readonly string[]): RegExp =>
  new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${words.map(escapeRegExp).join('|')})[\\p{L}\\p{N}]*`,
    'giu',
  )

/** The text with each word that starts with one of `words` marked; the text itself if none. */
export function markWords(text: string, words: readonly string[]): ReactNode {
  if (words.length === 0 || !text) return text
  const pattern = wordPattern(words)
  const parts: ReactNode[] = []
  let at = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > at) parts.push(text.slice(at, match.index))
    parts.push(
      <mark key={match.index} className="book-hit">
        {match[0]}
      </mark>,
    )
    at = match.index + match[0].length
  }
  if (parts.length === 0) return text
  if (at < text.length) parts.push(text.slice(at))
  return <>{parts}</>
}
