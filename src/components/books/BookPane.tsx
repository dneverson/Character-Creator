// The reading pane: the whole book as one page that scrolls from its first line to its last.
// Only the pieces near the reader are drawn (see src/books/units.ts); the rest are empty
// boxes of the height they had when last drawn, so the scroll bar is the book's. A bar at
// the top holds the chapter the reader is in, the way to the next and the previous chapter
// (shortcuts, not the only way on), and, while words are marked, the way from one match to
// the next. The pane tells the reader which heading is at its reading line as it scrolls,
// and goes to a place when asked: a heading, or the first match at or after it.

import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import Button from 'react-bootstrap/Button'
import { appConfig } from '../../config/app'
import { BookImage } from '../../books/BookImage'
import { BookStatblock } from '../../books/BookStatblock'
import { anchorDomId, headingKey } from '../../books/outline'
import type { BookText } from '../../books/load'
import type { BookPlace } from '../../books/types'
import { flowOf, matchesOf, type Flow, type Unit } from '../../books/units'
import { EntryPiece, PartTitle } from '../../text/Entries'
import {
  EntryContext,
  type AnchorProps,
  type EntryContextValue,
  type ImageEntry,
  type StatblockEntry,
} from '../../text/entryContext'
import { Icon } from '../Icon'
import { landingOffset, lineAt, readingLine } from './readingLine'
import { BookPageBox } from './BookPageBox'
import { BookWidthControl } from './BookWidthControl'

const NO_SUBSCRIPTION = () => () => {}
const NO_MARK = () => null

/** Frames a jump keeps correcting itself while pieces above it are drawn and measured. */
const SETTLE_FRAMES = 300
/** Frames the place has to hold still before a jump is done. */
const STILL_FRAMES = 45

/** What the reader does to take the scroll from the pane. */
const TAKE_OVER = ['wheel', 'touchstart', 'keydown', 'pointerdown']

/** What the pieces share: who is near enough to draw, and how tall each piece was. */
class View {
  /** No way to tell what is near (a test browser): every piece is drawn. */
  readonly all = typeof IntersectionObserver === 'undefined'
  private readonly heights = new Map<number, number>()
  private readonly els: (HTMLElement | null)[] = []
  private readonly sets = new Map<Element, (near: boolean) => void>()
  private readonly listeners = new Set<() => void>()
  private readonly observer: IntersectionObserver | null
  private current: Mark | null = null

  /** The book the view is of: heights are by piece, so a new book is a new view. */
  readonly flow: Flow
  /** The width of the column the heights were taken at, so a new width starts afresh. */
  readonly column: number

  constructor(root: Element, flow: Flow, column: number) {
    this.flow = flow
    this.column = column
    this.observer = this.all
      ? null
      : new IntersectionObserver(
          (entries) => {
            for (const entry of entries)
              this.sets.get(entry.target)?.(entry.isIntersecting)
          },
          { root, rootMargin: `${appConfig.books.drawnMargin}% 0px` },
        )
  }

  watch(el: Element, set: (near: boolean) => void): () => void {
    this.sets.set(el, set)
    this.observer?.observe(el)
    return () => {
      this.sets.delete(el)
      this.observer?.unobserve(el)
    }
  }

  close(): void {
    this.observer?.disconnect()
  }

  heightOf(index: number): number | undefined {
    return this.heights.get(index)
  }

  measured(index: number, height: number): void {
    this.heights.set(index, height)
  }

  put(index: number, el: HTMLElement | null): void {
    this.els[index] = el
  }

  piece(index: number): HTMLElement | null | undefined {
    return this.els[index]
  }

  /** The mark the reader is on, which a redrawn piece marks again. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  readonly getMark = (): Mark | null => this.current

  setMark(mark: Mark | null): void {
    this.current = mark
    for (const listener of this.listeners) listener()
  }

  markEl(unit: number, index: number): HTMLElement | undefined {
    return this.els[unit]?.querySelectorAll<HTMLElement>('mark.book-hit')[index]
  }
}

interface Mark {
  unit: number
  index: number
}

/** One piece of the book: drawn while it is near, an empty box of its height otherwise. */
const FlowUnit = memo(function FlowUnit({
  index,
  unit,
  view,
}: {
  index: number
  unit: Unit
  view: View
}) {
  const box = useRef<HTMLDivElement | null>(null)
  const [near, setNear] = useState(view.all)
  useEffect(() => {
    const el = box.current
    // Drawing is a transition: scrolling on is never held up by the pieces still to draw.
    return el && !view.all
      ? view.watch(el, (now) =>
          now ? startTransition(() => setNear(true)) : setNear(false),
        )
      : undefined
  }, [view])

  useLayoutEffect(() => {
    const el = box.current
    if (!near || !el) return
    const measure = () => view.measured(index, el.offsetHeight)
    measure()
    const mark = view.getMark()
    if (mark?.unit === index) view.markEl(index, mark.index)?.classList.add('is-current')
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [near, index, view])

  return (
    <div
      ref={(el) => {
        box.current = el
        view.put(index, el)
      }}
      className="book-unit"
      data-unit={index}
      style={near ? undefined : { height: view.heightOf(index) ?? unit.height }}
    >
      {near && unit.page !== undefined && (
        <div className="book-page-break">Page {unit.page}</div>
      )}
      {near &&
        (unit.title ? (
          <PartTitle entry={unit.title} depth={unit.depth} />
        ) : (
          <EntryPiece entries={unit.entries} depth={unit.depth} under={unit.under} />
        ))}
    </div>
  )
})

interface Props {
  text: BookText
  /** Where to go, and the words to mark. */
  place: BookPlace & { chapter: number }
  /** Bumps each time a place is asked for, so asking for the same place goes again. */
  request: number
  words: readonly string[]
  /** The chapter the reader is in. */
  chapter: number
  /** Called, as the reader scrolls, with the heading at the reading line. */
  onHeading: (chapter: number, anchor: string | null) => void
  onGo: (place: BookPlace) => void
  /** The width of the text column in pixels, and the way to change it. */
  column: number
  onColumn: (width: number) => void
  /** Shows the chapter list on a screen too narrow to keep it beside the text. */
  onChapters: () => void
  /** Called with the height of the bars above the text, whenever it changes. */
  onBars: (height: number) => void
  /** Called when the reader goes to a place in the text without the list: the list closes. */
  onRead: () => void
}

export function BookPane({
  text,
  place,
  request,
  words,
  chapter,
  onHeading,
  onGo,
  column,
  onColumn,
  onChapters,
  onBars,
  onRead,
}: Props) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null)
  const bars = useRef<HTMLDivElement>(null)
  /** The key of the heading at the reading line, last reported. */
  const reading = useRef('')
  const shownColumn = useRef(column)
  const [page, setPage] = useState<number | undefined>(undefined)
  const stopLanding = useRef<(() => void) | null>(null)
  /** What the pane last went to, until the reader scrolls on: the reading line passes it. */
  const target = useRef<Element | null>(null)
  /** Has the bars read where the text is; set by the effect that does (see `read`). */
  const report = useRef<() => void>(() => {})
  const flow = useMemo(() => flowOf(text.sections, text.scan), [text])
  const found = useMemo(() => matchesOf(flow, words), [flow, words])
  const foundUnits = useMemo(() => [...found.keys()], [found])
  const total = useMemo(() => [...found.values()].reduce((a, b) => a + b, 0), [found])
  // The heading that is a chapter's own, which is the place of its top.
  const tops = useMemo(
    () =>
      text.sections.map((_, c) => {
        const first = text.scan.headings.find((h) => h.chapter === c)
        return first ? headingKey(c, first.anchor) : ''
      }),
    [text],
  )
  const titleOf = useCallback(
    (c: number) => text.scan.headings.find((h) => h.chapter === c && h.depth === 0)?.name,
    [text],
  )
  const last = text.sections.length - 1

  // What is near is watched by one observer for the pane; a new book gets a new one.
  const view = useMemo(
    () => (root ? new View(root, flow, column) : null),
    [root, flow, column],
  )
  useEffect(() => () => view?.close(), [view])
  const mark = useSyncExternalStore(
    view?.subscribe ?? NO_SUBSCRIPTION,
    view?.getMark ?? NO_MARK,
  )

  const renderImage = useCallback(
    (image: ImageEntry, group?: ImageEntry[]) => (
      <BookImage image={image} root={root} group={group} />
    ),
    [root],
  )
  const renderStatblock = useCallback(
    (entry: StatblockEntry, headed: boolean, anchor: AnchorProps) => (
      <BookStatblock entry={entry} root={root} headed={headed} anchor={anchor} />
    ),
    [root],
  )
  const contexts = useMemo<EntryContextValue[]>(
    () =>
      text.sections.map((_, c) => ({
        book: true,
        anchors: text.scan.anchors,
        chapter: c,
        doc: { kind: place.kind, id: place.id },
        ids: text.scan.ids,
        maps: text.scan.maps,
        words,
        runInFrom: appConfig.books.runInFromDepth,
        renderImage,
        renderStatblock,
      })),
    [text, place.kind, place.id, words, renderImage, renderStatblock],
  )

  /**
   * Scroll until what `locate` finds is `offset` from the top of the pane, and keep
   * correcting while pieces above it are drawn and measured (a lazy block changes height)
   * until it has held still. The reader taking over (wheel, touch, keys) ends it.
   */
  const land = useCallback(
    (
      locate: () => { el: Element; exact: boolean } | null,
      offset: (el: Element) => number,
    ) => {
      if (!root) return
      stopLanding.current?.()
      let frame = 0
      let frames = 0
      let still = 0
      const stop = () => {
        report.current()
        cancelAnimationFrame(frame)
        for (const kind of TAKE_OVER) root.removeEventListener(kind, stop)
        stopLanding.current = null
      }
      for (const kind of TAKE_OVER) root.addEventListener(kind, stop, { passive: true })
      stopLanding.current = stop
      const step = () => {
        const at = locate()
        target.current = at?.el ?? null
        if (at) {
          const delta =
            at.el.getBoundingClientRect().top -
            root.getBoundingClientRect().top -
            offset(at.el)
          if (Math.abs(delta) > 1) {
            root.scrollTop += delta
            report.current()
            still = 0
          } else if (at.exact) still++
        }
        if (++frames < SETTLE_FRAMES && still < STILL_FRAMES) {
          frame = requestAnimationFrame(step)
        } else stop()
      }
      step()
    },
    [root],
  )
  useEffect(() => () => stopLanding.current?.(), [])

  const atBar = useCallback(() => landingOffset(bars.current?.offsetHeight ?? 0), [])

  const heading = useCallback(
    (c: number, anchor: string | null) => {
      const index = anchor ? flow.byKey.get(headingKey(c, anchor)) : flow.starts[c]
      return {
        index: index ?? flow.starts[c],
        id: anchor ? anchorDomId(c, anchor) : null,
      }
    },
    [flow],
  )

  /** Go to a mark of a piece: the piece is brought near, then the mark is centered. */
  const showMark = useCallback(
    (unit: number, index: number) => {
      if (!view || !root) return
      view.setMark({ unit, index })
      root
        .querySelectorAll('.is-current')
        .forEach((el) => el.classList.remove('is-current'))
      land(
        () => {
          const el = view.markEl(unit, index)
          if (el) {
            el.classList.add('is-current')
            return { el, exact: true }
          }
          const piece = view.piece(unit)
          return piece ? { el: piece, exact: false } : null
        },
        (el) => atBar() + (root.clientHeight - atBar() - el.clientHeight) / 3,
      )
    },
    [view, root, land, atBar],
  )

  // Go to the place asked for: its heading, or the first match at or after it.
  useLayoutEffect(() => {
    if (!root || !view) return
    const { index, id } = heading(place.chapter, place.anchor)
    const at = foundUnits.find((unit) => unit >= index)
    if (at !== undefined && words.length > 0) {
      // In the heading's own piece the match must follow the heading.
      const own = at === index && id ? document.getElementById(id) : null
      const marks = [...(view.piece(at)?.querySelectorAll('mark.book-hit') ?? [])]
      const after = own
        ? marks.findIndex(
            (m) => own.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING,
          )
        : 0
      showMark(at, Math.max(after, 0))
      return
    }
    view.setMark(null)
    root
      .querySelectorAll('.is-current')
      .forEach((el) => el.classList.remove('is-current'))
    land(() => {
      const el = id ? document.getElementById(id) : null
      if (el) return { el, exact: true }
      const piece = view.piece(index)
      return piece ? { el: piece, exact: !id } : null
    }, atBar)
  }, [
    atBar,
    root,
    view,
    place.chapter,
    place.anchor,
    request,
    foundUnits,
    words,
    heading,
    showMark,
    land,
  ])

  // A new column width changes every height: the reader stays at the heading it was at.
  useLayoutEffect(() => {
    if (shownColumn.current === column || !view) return
    shownColumn.current = column
    const at = reading.current
    if (!at) return
    const c = Number(at.slice(0, at.indexOf(':')))
    const { index, id } = heading(c, at.slice(at.indexOf(':') + 1))
    land(() => {
      const el = document.getElementById(id ?? '')
      if (el) return { el, exact: true }
      const piece = view.piece(index)
      return piece ? { el: piece, exact: false } : null
    }, atBar)
  }, [column, view, heading, land, atBar])

  // Tell the reader which heading is at the reading line.
  useEffect(() => {
    if (!root || !view) return
    let frame = 0
    const read = () => {
      frame = 0
      const rootTop = root.getBoundingClientRect().top
      const topOf = (el: Element) => el.getBoundingClientRect().top - rootTop
      // Where the pane has gone to counts as read even when it stands below the line (a
      // match is centered, not put at the top), until the reader scrolls on.
      const bar = bars.current?.offsetHeight ?? 0
      const line = target.current?.isConnected
        ? lineAt(bar, topOf(target.current))
        : readingLine(bar)
      // The last piece that starts at or above the line, by halving.
      let low = 0
      let high = flow.units.length - 1
      while (low < high) {
        const mid = Math.ceil((low + high) / 2)
        const el = view.piece(mid)
        if (el && topOf(el) <= line) low = mid
        else high = mid - 1
      }
      // The heading and the page in force at the line: those the piece at the line starts
      // with, then those of the parts inside it that the line has passed.
      const unit = flow.units[low]
      let key = unit?.heading ?? ''
      let at =
        unit.page !== undefined && topOf(view.piece(low) as Element) <= line
          ? unit.page
          : unit.from
      for (const el of view
        .piece(low)
        ?.querySelectorAll<HTMLElement>('[data-anchor], [data-page]') ?? []) {
        if (topOf(el) > line) break
        key = el.dataset.anchor ?? key
        if (el.dataset.page !== undefined) at = Number(el.dataset.page)
      }
      // What the book prints elsewhere than the text has it reads as the page it says.
      setPage(unit.printed ?? at)
      if (key === reading.current || !key) return
      reading.current = key
      const c = flow.units[low].chapter
      onHeading(c, key === tops[c] ? null : key.slice(key.indexOf(':') + 1))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(read)
    }
    // The reader taking over (wheel, touch, keys, a drag of the bar) ends what the pane went to.
    const takeOver = () => {
      target.current = null
      schedule()
    }
    report.current = schedule
    root.addEventListener('scroll', schedule, { passive: true })
    for (const kind of TAKE_OVER) root.addEventListener(kind, takeOver, { passive: true })
    schedule()
    return () => {
      report.current = () => {}
      root.removeEventListener('scroll', schedule)
      for (const kind of TAKE_OVER) root.removeEventListener(kind, takeOver)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [root, view, flow, tops, onHeading, atBar])

  // The list that covers the text on a phone opens below the bars, which stay in reach.
  useLayoutEffect(() => {
    const el = bars.current
    if (!el) return
    const report = () => onBars(el.offsetHeight)
    report()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(report)
    observer.observe(el)
    return () => observer.disconnect()
  }, [onBars])

  /** Go to a page: the part that starts it, or the nearest marked page before it. */
  const goPage = (typed: number) => {
    onRead()
    const marked = [...flow.marked].reverse().find((m) => m <= typed)
    const index = marked === undefined ? 0 : (flow.pages.get(marked) ?? 0)
    land(() => {
      const piece = view?.piece(index)
      if (!piece) return null
      // A page that begins inside the piece is where its part is, once the piece is drawn.
      const inside = piece.querySelector(`[data-page="${marked}"]`)
      return {
        el: inside ?? piece,
        exact: inside !== null || piece.childElementCount > 0,
      }
    }, atBar)
  }

  const goChapter = (to: number) => onGo({ ...place, chapter: to, anchor: null })

  /** One match on, or back; past the last match of a piece it is the next piece's. */
  const step = (direction: 1 | -1) => {
    if (foundUnits.length === 0) return
    const at = mark ?? {
      unit: foundUnits[direction > 0 ? foundUnits.length - 1 : 0],
      index: 0,
    }
    const count = found.get(at.unit) ?? 1
    const next = at.index + direction
    if (mark && next >= 0 && next < count) return showMark(at.unit, next)
    const position = foundUnits.indexOf(at.unit)
    const to = foundUnits[(position + direction + foundUnits.length) % foundUnits.length]
    showMark(to, direction > 0 ? 0 : (found.get(to) ?? 1) - 1)
  }

  const before = mark
    ? foundUnits
        .filter((u) => u < mark.unit)
        .reduce((sum, u) => sum + (found.get(u) ?? 0), 0)
    : 0

  return (
    <div
      className="book-pane"
      ref={setRoot}
      tabIndex={-1}
      style={{ ['--book-column' as string]: `${column}px` }}
    >
      <div className="book-bars" ref={bars}>
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
          <span className="book-bar-title">
            {titleOf(chapter) ?? `Part ${chapter + 1}`}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={chapter >= last}
            aria-label="Next chapter"
            onClick={() => goChapter(chapter + 1)}
          >
            <Icon name="back" className="book-flip" />
          </Button>
          {flow.marked.length > 0 && (
            <BookPageBox
              page={page ?? flow.marked[0]}
              last={flow.marked[flow.marked.length - 1]}
              onGo={goPage}
            />
          )}
          <BookWidthControl width={column} onChange={onColumn} />
        </div>
        {words.length > 0 && (
          <div className="book-bar book-matchbar" role="group" aria-label="Matches">
            <span role="status">
              {total === 0
                ? 'No match in this book'
                : mark
                  ? `Match ${before + mark.index + 1} of ${total} in this book`
                  : `${total} matches in this book`}
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
      {view && (
        <div className="book-flow">
          {text.sections.map((_, c) => {
            const from = flow.starts[c]
            const to = flow.starts[c + 1] ?? flow.units.length
            return (
              <article key={c} className="book-page" aria-label={titleOf(c)}>
                <EntryContext.Provider value={contexts[c]}>
                  {flow.units.slice(from, to).map((unit, i) => (
                    <FlowUnit key={from + i} index={from + i} unit={unit} view={view} />
                  ))}
                </EntryContext.Provider>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
