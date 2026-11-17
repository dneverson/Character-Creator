// The results of a search across the books on this device: grouped by book, each result
// with the place it is in and the words around the match. A result is a link to that place
// in the book, with the words marked there.

import { useState } from 'react'
import Badge from 'react-bootstrap/Badge'
import Button from 'react-bootstrap/Button'
import { appConfig } from '../../config/app'
import { BookLink } from '../../books/BookLink'
import { currentIndex, useIndexStatus } from '../../books/indexState'
import type { BookSearchResult } from '../../books/searchIndex'
import type { BookDoc } from '../../books/types'
import { StoreBooks } from './StoreBooks'

const plural = (count: number, one: string, many: string) =>
  `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`

function Status({
  result,
  docs,
}: {
  result: BookSearchResult
  docs: readonly BookDoc[]
}) {
  const { indexed, listed, building } = useIndexStatus()
  const found =
    result.total === 0
      ? `Nothing found in the ${plural(indexed, 'book', 'books')} on this device.`
      : `${plural(result.total, 'match', 'matches')} in ${plural(result.groups.length, 'book', 'books')}.`
  return (
    <p className="small text-body-secondary" role="status">
      {found}{' '}
      {building ? (
        `Reading the books for the search (${indexed} of ${listed} so far).`
      ) : indexed < listed ? (
        <>
          The search covers the {indexed} of {listed} books that are stored on this
          device. <StoreBooks docs={docs} allStored={false} />
        </>
      ) : null}
    </p>
  )
}

export function BookSearchResults({
  result,
  docs,
}: {
  result: BookSearchResult
  docs: readonly BookDoc[]
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const index = currentIndex()
  return (
    <div className="book-results">
      <Status result={result} docs={docs} />
      {result.groups.map(({ doc, hits, total }) => {
        const key = `${doc.kind}/${doc.id}`
        const shown = expanded.has(key)
          ? hits
          : hits.slice(0, appConfig.books.hitsPerBook)
        return (
          <section
            key={key}
            className="book-results-group"
            aria-labelledby={`hits-${key}`}
          >
            <h3 id={`hits-${key}`} className="book-results-title">
              {doc.name} <Badge bg="secondary">{total}</Badge>
            </h3>
            <ol className="book-hits">
              {shown.map((hit) => {
                const snippet = index.snippet(hit, result.words)
                return (
                  <li key={hit.block}>
                    <BookLink place={hit.place} className="book-hit-link">
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
            {hits.length > shown.length && (
              <Button
                variant="link"
                size="sm"
                onClick={() => setExpanded(new Set(expanded).add(key))}
              >
                Show {hits.length - shown.length} more
              </Button>
            )}
            {total > hits.length && expanded.has(key) && (
              <p className="small text-body-secondary mb-0">
                {total - hits.length} more matches are not listed. Narrow the search to
                see them.
              </p>
            )}
          </section>
        )
      })}
    </div>
  )
}
