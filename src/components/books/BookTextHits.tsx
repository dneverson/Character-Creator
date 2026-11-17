// The text matches of a search inside the open book, under the chapter and heading names that
// match: the same search and index as the top box, scoped to this one book. Each match is a
// link to its place with the words marked, in the order the book reads.

import { useMemo } from 'react'
import { BookLink } from '../../books/BookLink'
import { currentIndex, useIndexStatus } from '../../books/indexState'
import type { BookDoc } from '../../books/types'

interface Props {
  doc: Pick<BookDoc, 'kind' | 'id'>
  /** The words typed, once they have settled. */
  text: string
  /** Called when a match is chosen, so a phone can close the chapter list. */
  onPick: () => void
}

export function BookTextHits({ doc, text, onPick }: Props) {
  const version = useIndexStatus((status) => status.version)
  const building = useIndexStatus((status) => status.building)
  const result = useMemo(() => {
    // The index grows as books are added, so the same words can find more.
    void version
    return currentIndex().search(text, doc)
  }, [text, doc, version])
  if (result.words.length === 0) return null
  const hits = result.groups[0]?.hits.toSorted((a, b) => a.block - b.block) ?? []
  const total = result.total
  const index = currentIndex()
  const pending = !index.has(doc.kind, doc.id)

  return (
    <section className="book-results book-text-hits" aria-label="Matches in the text">
      <h3 className="book-results-title">In the text</h3>
      <p className="small text-body-secondary" role="status">
        {pending
          ? building
            ? 'Reading this book for the search...'
            : 'This book is not in the search yet.'
          : total === 0
            ? 'Nothing found in the text of this book.'
            : `${total.toLocaleString('en-US')} ${total === 1 ? 'match' : 'matches'} in the text.`}
      </p>
      <ol className="book-hits">
        {hits.map((hit) => {
          const snippet = index.snippet(hit, result.words)
          return (
            <li key={hit.block}>
              <BookLink place={hit.place} className="book-hit-link" onOpen={onPick}>
                <span className="book-hit-where">
                  {hit.chapter}
                  {hit.heading.depth > 0 ? ` - ${hit.heading.name}` : ''}
                </span>
                {snippet && (
                  <span className="book-hit-text">
                    {snippet.before}
                    <mark className="book-hit">{snippet.match}</mark>
                    {snippet.after}
                  </span>
                )}
              </BookLink>
            </li>
          )
        })}
      </ol>
      {total > hits.length && (
        <p className="small text-body-secondary mb-0">
          {total - hits.length} more matches are not listed. Narrow the search to see
          them.
        </p>
      )}
    </section>
  )
}
