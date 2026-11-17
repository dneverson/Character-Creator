// An open book: the chapter list beside the reading pane. The list can be resized (by drag
// or with the arrow keys; its width is remembered) and, on a phone, is shown over the text
// when asked for. The chapter and heading the reader is at are remembered for the book.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import Button from 'react-bootstrap/Button'
import Nav from 'react-bootstrap/Nav'
import Spinner from 'react-bootstrap/Spinner'
import { appConfig } from '../../config/app'
import { contentLibrary } from '../../content'
import { useContentStatus } from '../../content/library'
import { useContentSummary } from '../../content/summary'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { inBackground } from '../content/inBackground'
import { editionOf } from '../../books/edition'
import { loadBookText, type BookText } from '../../books/load'
import {
  clampColumn,
  clampSidebar,
  recallColumnWidth,
  recallPlace,
  recallSidebarWidth,
  rememberColumnWidth,
  rememberPlace,
  rememberSidebarWidth,
} from '../../books/memory'
import { searchWords } from '../../books/searchIndex'
import { openBook } from '../../books/state'
import type { BookDoc, BookPlace } from '../../books/types'
import { BookOutline } from './BookOutline'
import { BookPane } from './BookPane'

type Loaded =
  | { key: string; status: 'loading' }
  | { key: string; status: 'ready'; text: BookText }
  | { key: string; status: 'failed'; error: Error }

/** The text of a document: loading, ready, or failed. It is read again when asked to retry. */
function useBookText(doc: BookDoc, attempt: number): Loaded {
  const epoch = useContentStatus((status) => status.epoch)
  const key = `${doc.kind}/${doc.id}/${epoch}/${attempt}`
  const [loaded, setLoaded] = useState<Loaded>({ key, status: 'loading' })
  useEffect(() => {
    let active = true
    loadBookText(doc.kind, doc.id).then(
      (text) => active && setLoaded({ key, status: 'ready', text }),
      (error: unknown) =>
        active &&
        setLoaded({
          key,
          status: 'failed',
          error: error instanceof Error ? error : new Error(String(error)),
        }),
    )
    return () => {
      active = false
    }
  }, [doc.kind, doc.id, key])
  return loaded.key === key ? loaded : { key, status: 'loading' }
}

/** What stands where the text would be when it cannot be had, and what can be done. */
function Unavailable({
  doc,
  error,
  onRetry,
}: {
  doc: BookDoc
  error: Error
  onRetry: () => void
}) {
  const summary = useContentSummary()
  return (
    <div className="book-unavailable" role="alert">
      {summary.state === 'free' ? (
        <>
          <h2>{doc.name}</h2>
          <p>
            The text of this {doc.kind} is part of the full content, and only the free
            rules are in use. Downloading the full content stores the books in this
            browser.
          </p>
          <Button variant="primary" onClick={() => inBackground(contentLibrary.enable())}>
            Download the full content
          </Button>
        </>
      ) : (
        <>
          <h2>{doc.name}</h2>
          <p>
            This {doc.kind} could not be loaded: {error.message}
          </p>
          <Button variant="primary" onClick={onRetry}>
            Try again
          </Button>
        </>
      )}
    </div>
  )
}

/** A screen too narrow to keep the chapter list beside the text (the style sheet's too). */
const PHONE = '(max-width: 767.98px)'

interface Props {
  doc: BookDoc
  place: BookPlace
  request: number
  /** The results of the search across the books, shown in a tab of the list. */
  results: ReactNode | null
}

export function BookReader({ doc, place, request, results }: Props) {
  const [attempt, setAttempt] = useState(0)
  const loaded = useBookText(doc, attempt)
  const [tab, setTab] = useState<'chapters' | 'results'>('chapters')
  const [width, setWidth] = useState(recallSidebarWidth)
  const [column, setColumn] = useState(recallColumnWidth)
  const [listOpen, setListOpen] = useState(false)
  const phone = useMediaQuery(PHONE)
  // The heading the reader is at: it moves as the text scrolls.
  const [current, setCurrent] = useState<{ chapter: number; anchor: string | null }>({
    chapter: 0,
    anchor: null,
  })
  const box = useRef<HTMLDivElement>(null)

  // Searching makes the results the list; clearing the search brings the chapters back.
  const showing = results ? tab : 'chapters'
  const [hadResults, setHadResults] = useState(false)
  if (hadResults !== (results !== null)) {
    setHadResults(results !== null)
    setTab(results !== null ? 'results' : 'chapters')
    // On a phone the list is hidden: the results it now holds are shown at once.
    if (results !== null && phone) setListOpen(true)
  }

  const text = loaded.status === 'ready' ? loaded.text : null
  const chapters = text?.sections.length ?? 0
  // A place without a chapter is where the book was left, or its start.
  const at = useMemo(() => {
    if (place.chapter !== null) return place
    const left = recallPlace(doc.kind, doc.id)
    return { ...place, chapter: left?.chapter ?? 0, anchor: left?.anchor ?? null }
  }, [place, doc.kind, doc.id])
  const chapter = Math.min(Math.max(at.chapter ?? 0, 0), Math.max(chapters - 1, 0))
  const words = useMemo(() => searchWords(place.find ?? ''), [place.find])

  // Where a chapter or heading was asked for is where the book is left, and the outline
  // shows it until the text has scrolled there and says where it is.
  const asked = at.anchor
  const askedKey = `${doc.kind}/${doc.id}/${chapter}/${asked}/${request}`
  const [shown, setShown] = useState(askedKey)
  if (shown !== askedKey) {
    setShown(askedKey)
    setCurrent({ chapter, anchor: asked })
  }
  useEffect(() => {
    if (text) rememberPlace(doc.kind, doc.id, { chapter, anchor: asked })
  }, [text, doc.kind, doc.id, chapter, asked])

  const onHeading = useCallback(
    (to: number, anchor: string | null) => {
      setCurrent((now) =>
        now.chapter === to && now.anchor === anchor ? now : { chapter: to, anchor },
      )
      rememberPlace(doc.kind, doc.id, { chapter: to, anchor })
    },
    [doc.kind, doc.id],
  )
  const go = useCallback((to: BookPlace) => {
    setListOpen(false)
    openBook(to)
  }, [])
  const goTo = (to: number, anchor: string | null) =>
    go({ ...place, chapter: to, anchor })

  const changeColumn = (next: number) => {
    const clamped = clampColumn(next)
    setColumn(clamped)
    rememberColumnWidth(clamped)
  }
  const resize = (next: number, remember: boolean) => {
    const clamped = clampSidebar(next)
    setWidth(clamped)
    if (remember) rememberSidebarWidth(clamped)
  }
  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    const left = box.current?.getBoundingClientRect().left ?? 0
    const move = (e: globalThis.PointerEvent) => resize(e.clientX - left, false)
    const stop = (e: globalThis.PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      resize(e.clientX - left, true)
    }
    event.preventDefault()
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }
  const onSeparatorKey = (event: KeyboardEvent) => {
    const { min, max, keyStep } = appConfig.books.sidebar
    const to =
      event.key === 'ArrowLeft'
        ? width - keyStep
        : event.key === 'ArrowRight'
          ? width + keyStep
          : event.key === 'Home'
            ? min
            : event.key === 'End'
              ? max
              : null
    if (to === null) return
    event.preventDefault()
    resize(to, true)
  }

  return (
    <div
      ref={box}
      className={`book-reader${listOpen ? ' is-contents-open' : ''}`}
      style={{ ['--book-contents-width' as string]: `${width}px` }}
    >
      <aside className="book-contents" aria-label={`${doc.name}: chapters`}>
        {results && (
          <Nav
            variant="tabs"
            className="book-contents-tabs"
            activeKey={showing}
            onSelect={(key) => setTab(key === 'results' ? 'results' : 'chapters')}
          >
            <Nav.Item>
              <Nav.Link as="button" type="button" eventKey="chapters">
                Chapters
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link as="button" type="button" eventKey="results">
                Results
              </Nav.Link>
            </Nav.Item>
          </Nav>
        )}
        {showing === 'results' && results ? (
          <div className="book-contents-body">{results}</div>
        ) : text ? (
          <div className="book-contents-body">
            <BookOutline
              doc={doc}
              headings={text.scan.headings}
              chapter={current.chapter}
              current={current.anchor}
              onGo={goTo}
              onPick={() => setListOpen(false)}
            />
          </div>
        ) : null}
      </aside>
      <div
        className="book-separator"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the chapter list"
        aria-valuenow={width}
        aria-valuemin={appConfig.books.sidebar.min}
        aria-valuemax={appConfig.books.sidebar.max}
        tabIndex={0}
        onPointerDown={startDrag}
        onKeyDown={onSeparatorKey}
      />
      <section className="book-main" aria-label={doc.name} data-edition={editionOf(doc)}>
        {loaded.status === 'loading' && (
          <div className="book-loading" role="status">
            <Spinner animation="border" size="sm" className="me-2" />
            Opening {doc.name}...
          </div>
        )}
        {loaded.status === 'failed' && (
          <Unavailable
            doc={doc}
            error={loaded.error}
            onRetry={() => setAttempt(attempt + 1)}
          />
        )}
        {text && (
          <BookPane
            text={text}
            chapter={current.chapter}
            place={{ ...at, chapter }}
            request={request}
            words={words}
            onHeading={onHeading}
            onGo={go}
            column={column}
            onColumn={changeColumn}
            onChapters={() => setListOpen(!listOpen)}
          />
        )}
      </section>
    </div>
  )
}
