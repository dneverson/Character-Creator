// The reading pane: one chapter of a book drawn in the book's look, under a bar that holds
// the chapter's name, the way to the next and the previous chapter, and, while words are
// marked, the way from one match to the next (across chapters). The pane tells the reader
// which heading is at its top as it scrolls, and goes to a place when asked: a heading,
// or the first match at or after it.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Button from 'react-bootstrap/Button'
import { BookImage } from '../../books/BookImage'
import { chaptersWith } from '../../books/find'
import type { BookText } from '../../books/load'
import type { BookPlace } from '../../books/types'
import { Entries } from '../../text/Entries'
import { EntryContext, type ImageEntry } from '../../text/entryContext'
import { Icon } from '../Icon'

/** How far below the top of the pane a heading counts as the one being read. */
const READING_LINE = 96

interface Props {
  text: BookText
  chapter: number
  /** Where to go in the chapter, and the words to mark in it. */
  place: BookPlace
  /** Bumps each time a place is asked for, so asking for the same place goes again. */
  request: number
  words: readonly string[]
  onHeading: (anchor: string | null) => void
  onGo: (place: BookPlace) => void
  /** Shows the chapter list on a screen too narrow to keep it beside the text. */
  onChapters: () => void
}

export function BookPane({
  text,
  chapter,
  place,
  request,
  words,
  onHeading,
  onGo,
  onChapters,
}: Props) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null)
  const [match, setMatch] = useState({ count: 0, index: 0 })
  const wantLast = useRef(false)
  const section = text.sections[chapter]
  const title = text.scan.headings.find((h) => h.chapter === chapter && h.depth === 0)
  const chapters = text.scan.headings.filter((h) => h.depth === 0)
  const last = chapters.length - 1

  const renderImage = useCallback(
    (image: ImageEntry) => <BookImage image={image} root={root} />,
    [root],
  )
  const context = useMemo(
    () => ({ book: true, anchors: text.scan.anchors, words, renderImage }),
    [text, words, renderImage],
  )

  const marks = useCallback(
    () => [...(root?.querySelectorAll<HTMLElement>('mark.book-hit') ?? [])],
    [root],
  )
  const showMatch = useCallback(
    (index: number) => {
      const all = marks()
      all.forEach((mark, i) => mark.classList.toggle('is-current', i === index))
      all[index]?.scrollIntoView({ block: 'center' })
      setMatch({ count: all.length, index })
    },
    [marks],
  )

  // Go to the place asked for, once its chapter is drawn.
  useLayoutEffect(() => {
    if (!root) return
    const target = place.anchor ? document.getElementById(`book-${place.anchor}`) : null
    const all = marks()
    if (all.length > 0) {
      // The first match at or after the heading; the last one when stepping back in.
      const after = target
        ? all.findIndex(
            (mark) =>
              target.compareDocumentPosition(mark) & Node.DOCUMENT_POSITION_FOLLOWING,
          )
        : 0
      const index = wantLast.current ? all.length - 1 : Math.max(after, 0)
      wantLast.current = false
      showMatch(index)
      return
    }
    setMatch({ count: 0, index: 0 })
    if (target) target.scrollIntoView({ block: 'start' })
    else root.querySelector('.book-bars')?.scrollIntoView({ block: 'start' })
  }, [root, chapter, place.anchor, request, marks, showMatch, words])

  // Tell the reader which heading is at the top of the pane.
  useEffect(() => {
    if (!root) return
    let frame = 0
    const read = () => {
      frame = 0
      const line = root.getBoundingClientRect().top + READING_LINE
      let current: string | null = null
      for (const el of root.querySelectorAll<HTMLElement>('[data-anchor]')) {
        if (el.getBoundingClientRect().top > line) break
        current = el.dataset.anchor ?? null
      }
      onHeading(current)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read)
    }
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      root.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [root, chapter, onHeading])

  const goChapter = (to: number) => onGo({ ...place, chapter: to, anchor: null })

  /** One match on, or back; past the last match of the chapter it is the next chapter's. */
  const step = (direction: 1 | -1) => {
    const next = match.index + direction
    if (next >= 0 && next < match.count) return showMatch(next)
    const holding = chaptersWith(text.scan, words)
    const target =
      direction > 0
        ? (holding.find((c) => c > chapter) ?? holding[0])
        : ([...holding].reverse().find((c) => c < chapter) ?? holding[holding.length - 1])
    if (target === undefined || target === chapter) {
      return showMatch(direction > 0 ? 0 : match.count - 1)
    }
    wantLast.current = direction < 0
    onGo({ ...place, chapter: target, anchor: null })
  }

  return (
    <div className="book-pane" ref={setRoot} tabIndex={-1}>
      <div className="book-bars">
        <div className="book-bar" role="group" aria-label="Chapter">
          <Button
            variant="secondary"
            size="sm"
            className="book-bar-chapters"
            onClick={onChapters}
          >
            Chapters
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={chapter <= 0}
            aria-label="Previous chapter"
            onClick={() => goChapter(chapter - 1)}
          >
            <Icon name="back" />
          </Button>
          <span className="book-bar-title">{title?.name ?? `Part ${chapter + 1}`}</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={chapter >= last}
            aria-label="Next chapter"
            onClick={() => goChapter(chapter + 1)}
          >
            <Icon name="back" className="book-flip" />
          </Button>
        </div>
        {words.length > 0 && (
          <div className="book-bar book-matchbar" role="group" aria-label="Matches">
            <span role="status">
              {match.count === 0
                ? 'No match in this chapter'
                : `Match ${match.index + 1} of ${match.count} in this chapter`}
            </span>
            <Button variant="secondary" size="sm" onClick={() => step(-1)}>
              Previous match
            </Button>
            <Button variant="secondary" size="sm" onClick={() => step(1)}>
              Next match
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onGo({ ...place, find: null })}
            >
              Clear
            </Button>
          </div>
        )}
      </div>
      <article className="book-page" aria-label={title?.name}>
        <EntryContext.Provider value={context}>
          {section && <Entries entries={[section]} />}
        </EntryContext.Provider>
        <nav className="book-page-turn" aria-label="Chapters in order">
          <Button
            variant="secondary"
            disabled={chapter <= 0}
            onClick={() => goChapter(chapter - 1)}
          >
            Previous chapter
          </Button>
          <Button
            variant="secondary"
            disabled={chapter >= last}
            onClick={() => goChapter(chapter + 1)}
          >
            Next chapter
          </Button>
        </nav>
      </article>
    </div>
  )
}
