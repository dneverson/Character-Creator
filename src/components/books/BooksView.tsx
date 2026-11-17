// The book reader: a full-screen window over whatever view is open, like Quick lookup. It
// shows the shelf, or a book at a place, with one search box that searches every book
// stored on this device. Its place is in the address bar (src/books/address.ts).

import { useEffect, useMemo, useState } from 'react'
import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import Modal from 'react-bootstrap/Modal'
import Spinner from 'react-bootstrap/Spinner'
import { appConfig } from '../../config/app'
import { useContentStatus } from '../../content/library'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { loadBookDocs } from '../../books/catalog'
import { currentIndex, syncIndex, useIndexStatus } from '../../books/indexState'
import { openBook, useBookStore } from '../../books/state'
import type { BookDoc, BookPlace } from '../../books/types'
import { Icon } from '../Icon'
import './books.css'
import { BookReader } from './BookReader'
import { BookSearchResults } from './BookSearchResults'
import { BookShelf } from './BookShelf'

/** The document a place is in; one the catalog does not list is shown by its id. */
function docOf(docs: readonly BookDoc[], place: BookPlace): BookDoc {
  return (
    docs.find((doc) => doc.kind === place.kind && doc.id === place.id) ?? {
      kind: place.kind,
      id: place.id,
      name: place.id,
      cover: null,
    }
  )
}

function Content() {
  const place = useBookStore((s) => s.place)
  const request = useBookStore((s) => s.request)
  const { data: docs, error } = useAsyncData(loadBookDocs)
  const stored = useContentStatus((status) => status.stored)
  const version = useIndexStatus((status) => status.version)
  const [text, setText] = useState('')
  const typed = useDebouncedValue(text, appConfig.books.searchDelayMs)
  const searching = typed.trim().length >= appConfig.books.minSearchChars

  // Every book stored on this device joins the search; one stored later is added too.
  useEffect(() => {
    if (docs) void syncIndex(docs)
  }, [docs, stored])
  const result = useMemo(() => {
    // The index grows as books are added, so the same words can find more.
    void version
    return searching ? currentIndex().search(typed) : null
  }, [searching, typed, version])
  const results =
    result && docs ? <BookSearchResults result={result} docs={docs} /> : null
  const doc = docs && place ? docOf(docs, place) : null

  return (
    <>
      <div className="books-toolbar">
        {place && (
          <Button variant="secondary" size="sm" onClick={() => openBook(null)}>
            <Icon name="back" /> Shelf
          </Button>
        )}
        {doc && <span className="books-toolbar-title">{doc.name}</span>}
        <Form.Control
          type="search"
          className="books-search"
          aria-label="Search the text of every book on this device"
          placeholder="Search the text of the books"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      {error && (
        <Alert variant="danger">Could not load the list of books: {error.message}</Alert>
      )}
      {!docs && !error && (
        <div className="text-body-secondary p-3" role="status">
          <Spinner size="sm" animation="border" className="me-2" />
          Loading the list of books...
        </div>
      )}
      {docs && place && doc && (
        <BookReader doc={doc} place={place} request={request} results={results} />
      )}
      {docs && !place && (
        <div className="books-scroll">{results ?? <BookShelf docs={docs} />}</div>
      )}
    </>
  )
}

export function BooksView() {
  const open = useBookStore((s) => s.open)
  const closeBooks = useBookStore((s) => s.closeBooks)
  return (
    <Modal
      show={open}
      fullscreen
      onHide={closeBooks}
      className="books-modal"
      aria-label={`${appConfig.name} books`}
    >
      <Modal.Header closeButton>
        <Modal.Title>Books</Modal.Title>
      </Modal.Header>
      <Modal.Body className="books-body">{open && <Content />}</Modal.Body>
    </Modal>
  )
}
