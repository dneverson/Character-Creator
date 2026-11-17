// The shelf: every book and adventure of the catalog with its cover, grouped as the catalog
// groups them and oldest first. A book that is not stored on this device says so; opening it
// downloads it. One button stores them all, which also lets the search read them.

import { useEffect, useMemo, useRef, useState } from 'react'
import Alert from 'react-bootstrap/Alert'
import Badge from 'react-bootstrap/Badge'
import Nav from 'react-bootstrap/Nav'
import { contentLibrary } from '../../content'
import { useContentStatus } from '../../content/library'
import { useContentSummary } from '../../content/summary'
import { useCoverThumb } from '../../content/useCoverThumb'
import { useVisible } from '../../hooks/useVisible'
import { BookLink } from '../../books/BookLink'
import { docPath } from '../../books/catalog'
import { shelfGroups } from '../../books/shelf'
import type { BookDoc, DocKind } from '../../books/types'
import { formatDateParts } from '../../ui/date'
import { StoreBooks } from './StoreBooks'

/** The keys (kind/id) of the documents whose text is stored on this device. */
function useStored(docs: readonly BookDoc[]): ReadonlySet<string> {
  const stored = useContentStatus((status) => status.stored)
  const epoch = useContentStatus((status) => status.epoch)
  const [keys, setKeys] = useState<ReadonlySet<string>>(new Set())
  useEffect(() => {
    let active = true
    Promise.all(
      docs.map(async (doc) =>
        (await contentLibrary.has(docPath(doc.kind, doc.id)))
          ? `${doc.kind}/${doc.id}`
          : '',
      ),
    ).then((found) => {
      if (active) setKeys(new Set(found.filter(Boolean)))
    })
    return () => {
      active = false
    }
  }, [docs, stored, epoch])
  return keys
}

function Cover({ doc }: { doc: BookDoc }) {
  const frame = useRef<HTMLSpanElement>(null)
  const near = useVisible(frame, { rootMargin: '300px 0px' })
  const thumb = useCoverThumb(doc.cover, near)
  return (
    <span ref={frame} className="book-card-cover">
      {thumb.status === 'ready' ? (
        <img src={thumb.url} alt="" loading="lazy" />
      ) : (
        <span className="book-card-nocover">
          {thumb.status === 'loading' ? '' : 'No cover'}
        </span>
      )}
    </span>
  )
}

const KIND_LABELS: Record<DocKind, string> = { book: 'Books', adventure: 'Adventures' }

export function BookShelf({ docs }: { docs: readonly BookDoc[] }) {
  const [kind, setKind] = useState<DocKind>('book')
  const stored = useStored(docs)
  const summary = useContentSummary()
  const groups = useMemo(() => shelfGroups(docs, kind), [docs, kind])
  const counts = { book: 0, adventure: 0 }
  for (const doc of docs) counts[doc.kind]++
  const here = docs.filter((doc) => stored.has(`${doc.kind}/${doc.id}`)).length

  return (
    <div className="book-shelf">
      {summary.state === 'free' ? (
        <Alert variant="info" className="book-shelf-note">
          <StoreBooks docs={docs} allStored={false} />
        </Alert>
      ) : (
        <p className="book-shelf-note small text-body-secondary">
          {here} of {docs.length} are stored on this device; the rest download when
          opened. <StoreBooks docs={docs} allStored={here === docs.length} />
        </p>
      )}
      <Nav
        variant="tabs"
        className="mb-3"
        activeKey={kind}
        onSelect={(key) => setKind(key === 'adventure' ? 'adventure' : 'book')}
      >
        {(['book', 'adventure'] as const).map((k) => (
          <Nav.Item key={k}>
            <Nav.Link as="button" type="button" eventKey={k}>
              {KIND_LABELS[k]} ({counts[k]})
            </Nav.Link>
          </Nav.Item>
        ))}
      </Nav>
      {groups.length === 0 && (
        <p className="text-body-secondary">
          There are no {KIND_LABELS[kind].toLowerCase()} to show.
        </p>
      )}
      {groups.map((group) => (
        <section key={group.group} aria-labelledby={`shelf-${group.group || 'other'}`}>
          <h2 id={`shelf-${group.group || 'other'}`} className="book-shelf-group">
            {group.label}
          </h2>
          <ul className="book-cards">
            {group.docs.map((doc) => (
              <li key={doc.id}>
                <BookLink
                  className="book-card"
                  place={{
                    kind: doc.kind,
                    id: doc.id,
                    chapter: null,
                    anchor: null,
                    find: null,
                  }}
                >
                  <Cover doc={doc} />
                  <span className="book-card-name">{doc.name}</span>
                  <span className="book-card-meta">
                    {formatDateParts(doc.published)}
                    {doc.storyline ? `${doc.published ? ', ' : ''}${doc.storyline}` : ''}
                  </span>
                  {!stored.has(`${doc.kind}/${doc.id}`) && (
                    <Badge bg="secondary" className="book-card-badge">
                      Not downloaded
                    </Badge>
                  )}
                </BookLink>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
