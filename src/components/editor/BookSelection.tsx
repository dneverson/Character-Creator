import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import Alert from 'react-bootstrap/Alert'
import Badge from 'react-bootstrap/Badge'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import Spinner from 'react-bootstrap/Spinner'
import { loadBooks } from '../../data/loaders'
import { loadBookContents } from '../../data/bookPages'
import { coverPath } from '../../data/covers'
import { coverUrls } from '../../content/covers'
import { useCoverThumb } from '../../content/useCoverThumb'
import { useActiveCharacter, useCharacterStore } from '../../character/store'
import { formatDateParts } from '../../ui/date'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useVisible } from '../../hooks/useVisible'
import { Abbr, AbbrText } from '../Abbr'
import { CoverImage } from '../CoverImage'
import { Icon } from '../Icon'
import { DataTable } from '../table/DataTable'
import type { Book, BookContentEntry, BookHeader } from '../../data/types'
import type { Column } from '../table/types'
import { EditorSection } from './EditorSection'

// 5etools `group` codes decoded to plain labels (tooltip-helpers rule: never show
// raw shorthand). Unknown codes fall back to a title-cased form of the code itself.
const GROUP_LABELS: Record<string, string> = {
  core: 'Core rulebook',
  screen: 'DM screen',
  setting: 'Campaign setting',
  'setting-alt': 'Campaign setting (alternate)',
  'organized-play': 'Organized play',
  supplement: 'Supplement',
  'supplement-alt': 'Supplement (alternate)',
  recipe: 'Cookbook',
  homecraft: 'Homecraft',
  other: 'Other',
}

function groupLabel(group: string | undefined): string | null {
  if (!group) return null
  return (
    GROUP_LABELS[group] ??
    group.replace(/(^|[-\s])([a-z])/g, (_, sep, c) => sep + c.toUpperCase())
  )
}

// Published dates are formatted app-wide by `formatDateParts` (src/ui/date): a
// full "2014-08-19" → "2014/08/19", a year-only "2020" stays "2020".

// A table-of-contents entry's chapter/appendix prefix, e.g. "Chapter 2" or
// "Appendix A". Front matter (no ordinal) has none.
function ordinalLabel(entry: BookContentEntry): string | null {
  const ordinal = entry.ordinal
  if (!ordinal) return null
  const kind = ordinal.type === 'appendix' ? 'Appendix' : 'Chapter'
  return ordinal.identifier === undefined ? kind : `${kind} ${ordinal.identifier}`
}

function headerText(header: BookHeader): string {
  return typeof header === 'string' ? header : header.header
}

function headerDepth(header: BookHeader): number {
  return typeof header === 'string' ? 0 : (header.depth ?? 0)
}

// The page a heading opens on, derived from the book text (src/data/bookPages.ts).
// Plain-string headers never carry one.
function headerPage(header: BookHeader): number | undefined {
  return typeof header === 'string' ? undefined : header.page
}

// Wrap every case-insensitive occurrence of `query` in `text` with <mark> so a
// contents search shows *where* it matched. An empty query returns the raw text.
function highlight(text: string, query: string): ReactNode {
  const q = query.trim().toLowerCase()
  if (!q) return text
  const lower = text.toLowerCase()
  const parts: ReactNode[] = []
  let from = 0
  let idx = lower.indexOf(q, from)
  let key = 0
  while (idx !== -1) {
    if (idx > from) parts.push(text.slice(from, idx))
    parts.push(<mark key={key++}>{text.slice(idx, idx + q.length)}</mark>)
    from = idx + q.length
    idx = lower.indexOf(q, from)
  }
  if (from < text.length) parts.push(text.slice(from))
  return parts
}

// A table row's cover: a small thumbnail at a fixed height so rows stay uniform.
// The thumbnail is only fetched once its row has been on screen, so a long grid
// loads the covers the user can see first. Clicking it enlarges the full cover in
// the same lightbox the detail pane uses; the full-resolution image only
// downloads when that lightbox opens.
function RowCover({ book }: { book: Book }) {
  const ref = useRef<HTMLSpanElement>(null)
  const path = coverPath(book.cover)
  const thumb = useCoverThumb(path, useVisible(ref))
  return (
    <span ref={ref} className="d-inline-block">
      {path ? (
        <CoverImage
          compact
          sources={coverUrls(path)}
          thumb={thumb}
          alt={`${book.name} cover`}
          className="rounded border"
          imgStyle={{ height: 40, width: 'auto', maxWidth: 32 }}
          rovingTarget
        />
      ) : (
        <span className="text-body-secondary">-</span>
      )}
    </span>
  )
}

// A book is identified for selection by its `source` code, which is exactly what
// `character.selectedBooks` stores - so the table's selection set maps 1:1 to it.
const columns: Column<Book>[] = [
  {
    key: 'cover',
    header: 'Cover',
    render: (b) => <RowCover book={b} />,
    sortable: false,
    filterable: false,
  },
  {
    key: 'name',
    header: 'Book',
    render: (b) => b.name,
    sortable: true,
    sortValue: (b) => b.name,
  },
  {
    key: 'source',
    header: 'Source',
    render: (b) => (
      <Badge bg="light" text="dark" className="border">
        <Abbr code={b.source} kind="source" />
      </Badge>
    ),
    // The cell renders <Abbr> (code is a prop, not children), so the default
    // text-of-cell derivation can't see it. Expose the code explicitly so the
    // column keeps its sort and facet filter.
    sortValue: (b) => b.source,
    filterValue: (b) => b.source,
  },
  {
    key: 'year',
    header: 'Year',
    render: (b) => b.published?.slice(0, 4) ?? '-',
    sortable: true,
    sortValue: (b) => b.published ?? '',
  },
]

const rowMeta = (b: Book) => ({ id: b.source, standard: true })

// One chapter/appendix in the contents list. Chapters with sub-headings are a
// collapse toggle (collapsed by default so the list stays scannable); chapters
// without are a plain static row. Page numbers, where derived, sit at the right.
function ChapterRow({
  entry,
  headers,
  query,
  open,
  onToggle,
}: {
  entry: BookContentEntry
  headers: BookHeader[]
  query: string
  open: boolean
  onToggle: () => void
}) {
  const label = ordinalLabel(entry)
  const hasHeaders = headers.length > 0
  const heading = (
    <span className="d-flex w-100 justify-content-between align-items-baseline gap-2">
      <span>
        {hasHeaders && (
          <Icon
            name="expand"
            className="d-inline-block me-2 text-body-secondary small"
            style={{
              transition: 'transform 0.15s ease',
              transform: open ? 'rotate(90deg)' : 'none',
            }}
          />
        )}
        {label && <span className="text-body-secondary me-2">{label}</span>}
        <span className="fw-semibold">{highlight(entry.name, query)}</span>
      </span>
      {typeof entry.page === 'number' && (
        <span className="text-body-secondary small text-nowrap">p. {entry.page}</span>
      )}
    </span>
  )
  return (
    <li className="border-bottom">
      {hasHeaders ? (
        <button
          type="button"
          className="btn btn-link w-100 text-start text-decoration-none text-body px-0 py-2"
          aria-expanded={open}
          onClick={onToggle}
        >
          {heading}
        </button>
      ) : (
        <div className="px-0 py-2">{heading}</div>
      )}
      {hasHeaders && open && (
        <ul className="list-unstyled mb-2 small">
          {headers.map((header, j) => (
            <li
              key={j}
              className="d-flex justify-content-between gap-2 py-1"
              style={{ paddingLeft: `${1 + headerDepth(header)}rem` }}
            >
              <span className="text-body-secondary">
                {highlight(headerText(header), query)}
              </span>
              {headerPage(header) !== undefined && (
                <span className="text-body-secondary small text-nowrap">
                  p. {headerPage(header)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

// The table of contents with a live title search. Typing filters to chapters and
// sub-headings whose title matches (matches are highlighted and force-expanded);
// otherwise chapters collapse and expand on click.
function BookContents({ contents }: { contents: BookContentEntry[] }) {
  const [query, setQuery] = useState('')
  const [openIdx, setOpenIdx] = useState<Set<number>>(new Set())
  const q = query.trim().toLowerCase()

  const view = useMemo(() => {
    return contents
      .map((entry, i) => {
        const headers = entry.headers ?? []
        const nameMatch = !q || entry.name.toLowerCase().includes(q)
        // When the chapter name itself matches, keep all its headers; otherwise
        // narrow to the headers that match the query.
        const shownHeaders =
          q && !nameMatch
            ? headers.filter((h) => headerText(h).toLowerCase().includes(q))
            : headers
        const keep = !q || nameMatch || shownHeaders.length > 0
        return { entry, i, headers: shownHeaders, keep }
      })
      .filter((v) => v.keep)
  }, [contents, q])

  const toggle = (i: number) =>
    setOpenIdx((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  // Indices of chapters that actually have sub-headings - the only rows that
  // collapse - so "Expand all" opens exactly those.
  const collapsibleIdx = useMemo(
    () => contents.map((_, i) => i).filter((i) => (contents[i].headers?.length ?? 0) > 0),
    [contents],
  )

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-2 gap-2">
        <h6 className="text-body-secondary mb-0">Contents</h6>
        <Form.Control
          size="sm"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search contents…"
          aria-label="Search book contents"
          style={{ maxWidth: '14rem' }}
        />
      </div>
      {collapsibleIdx.length > 0 && (
        <div className="d-flex gap-3 mb-2">
          <Button
            variant="link"
            size="sm"
            className="text-decoration-none p-0"
            onClick={() => setOpenIdx(new Set(collapsibleIdx))}
            // While searching every match is force-expanded, so the controls
            // would be no-ops; disable them until the search is cleared.
            disabled={q !== ''}
          >
            Expand all
          </Button>
          <Button
            variant="link"
            size="sm"
            className="text-decoration-none p-0"
            onClick={() => setOpenIdx(new Set())}
            disabled={q !== ''}
          >
            Collapse all
          </Button>
        </div>
      )}
      {view.length > 0 ? (
        <ul className="list-unstyled mb-0 small border-top">
          {view.map((v) => (
            <ChapterRow
              key={v.i}
              entry={v.entry}
              headers={v.headers}
              query={query}
              // A search result is always expanded so its match is visible.
              open={q !== '' || openIdx.has(v.i)}
              onToggle={() => toggle(v.i)}
            />
          ))}
        </ul>
      ) : (
        <p className="text-body-secondary small fst-italic mb-0">
          No sections match “{query}”.
        </p>
      )}
    </div>
  )
}

// The detail pane: the enlargeable cover, the published metadata, and the
// searchable, collapsible table of contents.
function BookDetail({ book }: { book: Book }) {
  const cover = coverPath(book.cover)
  const thumb = useCoverThumb(cover)
  // The contents are shown at once as the book list gives them; the page numbers
  // are worked out from the book's text and fill in when ready.
  const loadContents = useCallback(() => loadBookContents(book), [book])
  const { data: paged } = useAsyncData(loadContents)
  const contents = paged ?? book.contents ?? []
  const group = groupLabel(book.group)
  const published = formatDateParts(book.published)
  return (
    <div className="p-3">
      <div className="d-flex align-items-start gap-3 mb-3">
        {cover && (
          <CoverImage
            sources={coverUrls(cover)}
            thumb={thumb}
            alt={`${book.name} cover`}
            className="rounded border"
          />
        )}
        <div>
          <h5 className="mb-1">{book.name}</h5>
          <Badge bg="light" text="dark" className="border">
            <Abbr code={book.source} kind="source" />
          </Badge>
        </div>
      </div>

      <dl className="row mb-3 small">
        {book.author && (
          <>
            <dt className="col-4 col-sm-3 text-body-secondary fw-normal">Author</dt>
            <dd className="col-8 col-sm-9">
              <AbbrText text={book.author} />
            </dd>
          </>
        )}
        {group && (
          <>
            <dt className="col-4 col-sm-3 text-body-secondary fw-normal">Group</dt>
            <dd className="col-8 col-sm-9">
              <AbbrText text={group} />
            </dd>
          </>
        )}
        {published && (
          <>
            <dt className="col-4 col-sm-3 text-body-secondary fw-normal">Published</dt>
            <dd className="col-8 col-sm-9">{published}</dd>
          </>
        )}
        {book.coverCredit && (
          <>
            <dt className="col-4 col-sm-3 text-body-secondary fw-normal">Cover art</dt>
            <dd className="col-8 col-sm-9">{book.coverCredit}</dd>
          </>
        )}
      </dl>

      {contents.length > 0 && <BookContents contents={contents} />}
    </div>
  )
}

export function BookSelection() {
  const character = useActiveCharacter()
  const updateActive = useCharacterStore((s) => s.updateActive)
  const { data: books, error, loading } = useAsyncData(loadBooks)

  const selectedBooks = useMemo(
    () => character?.selectedBooks ?? [],
    [character?.selectedBooks],
  )

  return (
    <EditorSection
      title="Books"
      subtitle="Choose which sources (2014 and 2024) are available. All other menus filter to these."
      actions={<Badge bg="secondary">{selectedBooks.length} selected</Badge>}
    >
      {loading && (
        <div className="text-body-secondary">
          <Spinner size="sm" animation="border" className="me-2" />
          Loading books…
        </div>
      )}
      {error && <Alert variant="danger">Failed to load books: {error.message}</Alert>}

      {books && (
        <DataTable<Book>
          tableId="books"
          rows={books}
          columns={columns}
          rowMeta={rowMeta}
          selectionMode="multi"
          rowClick="focus"
          selectedIds={selectedBooks}
          onSelectionChange={(ids) => updateActive({ selectedBooks: ids })}
          searchText={(b) => `${b.name} ${b.source}`}
          searchPlaceholder="Filter books…"
          renderDetail={(b) => <BookDetail key={b.source} book={b} />}
          detailPlaceholder="Select a book to see its cover and full contents."
          detail={{ hiddenUntilFocus: true, toggleOnReclick: true, closable: true }}
          emptyLabel="No books match your search."
          ariaLabel="Available books"
        />
      )}
    </EditorSection>
  )
}
