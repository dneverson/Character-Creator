// The chapters of an open book as a tree: each chapter opens to the headings in it. The box
// above it searches the book: the tree narrows to the chapters and headings whose names hold
// the words typed, and under it come the matches in the text (see BookTextHits). Every row is
// a button or a link, so the list is reached with the keyboard in reading order.

import { useMemo, useState } from 'react'
import Form from 'react-bootstrap/Form'
import { appConfig } from '../../config/app'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { Icon } from '../Icon'
import type { Heading } from '../../books/outline'
import type { BookDoc } from '../../books/types'
import { BookTextHits } from './BookTextHits'

/** The deepest indent a heading gets; deeper ones sit at this depth. */
const MAX_INDENT = 4

/** The page a heading starts on, at the right edge of its row, when the text marks one. */
function PageNumber({ page }: { page: number | undefined }) {
  return page === undefined ? null : (
    <span className="book-tree-page" aria-hidden="true">
      {page}
    </span>
  )
}

interface Props {
  doc: Pick<BookDoc, 'kind' | 'id'>
  headings: readonly Heading[]
  /** The chapter that is open, and the heading the reader is at in it (null: its top). */
  chapter: number
  current: string | null
  onGo: (chapter: number, anchor: string | null) => void
  /** Called when a match in the text is chosen. */
  onPick: () => void
}

export function BookOutline({ doc, headings, chapter, current, onGo, onPick }: Props) {
  const [filter, setFilter] = useState('')
  const typed = useDebouncedValue(filter, appConfig.books.searchDelayMs)
  // Chapters the reader opened or closed by hand; the open chapter is open until closed.
  const [toggled, setToggled] = useState<ReadonlyMap<number, boolean>>(new Map())
  const words = filter.toLowerCase().split(/\s+/).filter(Boolean)

  const chapters = useMemo(() => {
    const byChapter = new Map<number, { title: Heading; inside: Heading[] }>()
    for (const heading of headings) {
      const entry = byChapter.get(heading.chapter)
      if (heading.depth === 0 && !entry) {
        byChapter.set(heading.chapter, { title: heading, inside: [] })
      } else if (entry) entry.inside.push(heading)
    }
    return [...byChapter.values()]
  }, [headings])

  const matches = (heading: Heading) =>
    words.every((word) => heading.name.toLowerCase().includes(word))

  const shown = chapters.flatMap(({ title, inside }) => {
    if (words.length === 0)
      return [
        { title, inside, open: toggled.get(title.chapter) ?? title.chapter === chapter },
      ]
    const found = inside.filter(matches)
    return matches(title) || found.length > 0
      ? [{ title, inside: matches(title) ? inside : found, open: true }]
      : []
  })

  return (
    <nav className="book-outline" aria-label="Chapters and headings">
      <Form.Control
        type="search"
        size="sm"
        className="book-outline-filter"
        aria-label="Search this book"
        placeholder="Search this book"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      {shown.length === 0 ? (
        <p className="small text-body-secondary mt-2 mb-0">
          No chapter or heading has that name.
        </p>
      ) : (
        <ul className="book-tree">
          {shown.map(({ title, inside, open }) => {
            const here = title.chapter === chapter
            return (
              <li key={title.chapter}>
                <div className="book-tree-row">
                  <button
                    type="button"
                    className={`book-tree-toggle${open ? ' is-open' : ''}`}
                    aria-expanded={open}
                    aria-label={`${open ? 'Close' : 'Open'} ${title.name}`}
                    disabled={inside.length === 0}
                    onClick={() => setToggled(new Map(toggled).set(title.chapter, !open))}
                  >
                    <Icon name="expand" />
                  </button>
                  <button
                    type="button"
                    className={`book-tree-link book-tree-chapter${here && current === null ? ' is-current' : ''}`}
                    aria-current={here && current === null ? 'location' : undefined}
                    onClick={() => onGo(title.chapter, null)}
                  >
                    <span>{title.name}</span>
                    <PageNumber page={title.page} />
                  </button>
                </div>
                {open && inside.length > 0 && (
                  <ul className="book-tree-inside">
                    {inside.map((heading) => {
                      const isCurrent = here && current === heading.anchor
                      return (
                        <li key={heading.anchor}>
                          <button
                            type="button"
                            className={`book-tree-link${heading.box ? ' is-box' : ''}${isCurrent ? ' is-current' : ''}`}
                            style={{
                              paddingLeft: `${Math.min(heading.depth, MAX_INDENT) * 0.75}rem`,
                            }}
                            aria-current={isCurrent ? 'location' : undefined}
                            onClick={() => onGo(heading.chapter, heading.anchor)}
                          >
                            <span>{heading.name}</span>
                            <PageNumber page={heading.page} />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {words.length > 0 && <BookTextHits doc={doc} text={typed} onPick={onPick} />}
    </nav>
  )
}
