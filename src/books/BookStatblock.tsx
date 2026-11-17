// A stat block of a book, drawn where the text puts it. The text only names what it
// shows, so the entry is read from the loaded content when the block is about to scroll
// into view, and drawn by the one description the lookup has for that kind of entry (a
// creature, a spell, an item...), in the book's stat block look. Its space is reserved
// until it is there, and when the loaded content does not have it the place says so and
// still links to the lookup.

import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { EntryDetail } from '../components/table/EntryDetail'
import { describeLookup, lookupTags, lookupTitle } from '../components/lookup/lookupFacts'
import { useVisible } from '../hooks/useVisible'
import { loadResolver } from '../lookup/references'
import type { LookupRow } from '../lookup/types'
import { Entries, PrintedOn, StatblockNote, type Entry } from '../text/Entries'
import { TaggedText } from '../text/TaggedText'
import { EntryContext, type AnchorProps, type StatblockEntry } from '../text/entryContext'
import { PrintedEntry } from './PrintedEntry'
import { stripTags } from '../text/tags'
import { loadCrochet } from './crochet'
import { hasPrinted, loadFluff, loadTable, targetOf } from './statblock'

/** How far before a stat block comes into view it starts to load. */
const PRELOAD_MARGIN = '600px 0px'

interface NamedEntries {
  type?: string
  name?: string
  entries?: Entry[]
}

type Content =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'row'; row: LookupRow }
  /** A description a book keeps: panelled with its name; a table is drawn as it is. */
  | { status: 'entries'; entries: Entry[]; panel: boolean }

/** What a stat block shows, read once it is near. */
function useContent(entry: StatblockEntry, active: boolean): Content {
  const [content, setContent] = useState<Content>({ status: 'loading' })
  useEffect(() => {
    if (!active) return
    let current = true
    const target = targetOf(entry)
    const missing: Content = { status: 'missing' }
    const read: Promise<Content> =
      target.kind === 'lookup'
        ? loadResolver().then((resolver) => {
            const row = resolver.find(target.reference)
            return row ? { status: 'row', row } : missing
          })
        : target.kind === 'fluff'
          ? loadFluff(target.prop, target.name, target.source).then((fluff) =>
              fluff
                ? {
                    status: 'entries',
                    entries: [...(fluff.entries ?? []), ...(fluff.images ?? [])],
                    panel: !entry.data?.renderCompact?.isSkipRootName,
                  }
                : missing,
            )
          : target.kind === 'table'
            ? loadTable(target.name, target.source).then((table) =>
                table ? { status: 'entries', entries: [table], panel: false } : missing,
              )
            : target.kind === 'crochet'
              ? loadCrochet(target.name, target.source).then((entries) =>
                  entries ? { status: 'entries', entries, panel: true } : missing,
                )
              : Promise.resolve(missing)
    read.then(
      (done) => current && setContent(done),
      () => current && setContent(missing),
    )
    return () => {
      current = false
    }
  }, [entry, active])
  return content
}

/**
 * A description that opens with a section of the heading's own name, right under that
 * heading, is that page's text: the name is not printed a second time.
 */
function withoutRepeatedHeading(entries: Entry[], name: string): Entry[] {
  const [first, ...rest] = entries
  const section = typeof first === 'object' ? (first as NamedEntries) : undefined
  const same =
    section?.type === 'section' &&
    section.name !== undefined &&
    stripTags(section.name).toLowerCase() === stripTags(name).toLowerCase()
  return same ? [...(section.entries ?? []), ...rest] : entries
}

/** The space a stat block keeps while it is not there yet, by what it is. */
const reservedHeight = (entry: StatblockEntry) =>
  entry.tag === 'creature' || entry.prop === 'monsterFluff' ? '20rem' : '8rem'

export function BookStatblock({
  entry,
  root,
  headed = false,
  anchor = {},
}: {
  entry: StatblockEntry
  /** The heading right above has this block's name, so the block does not print it. */
  headed?: boolean
  /** The id and key of the block's heading, when it is one. */
  anchor?: AnchorProps
  /** The area that scrolls the text, which decides when a block is near. */
  root: Element | null
}) {
  const frame = useRef<HTMLDivElement>(null)
  const near = useVisible(frame, { root, rootMargin: PRELOAD_MARGIN })
  const parent = useContext(EntryContext)
  // Inside a stat block every trait and action runs in, whatever its depth.
  const inside = useMemo(() => (parent ? { ...parent, runInFrom: 0 } : parent), [parent])
  const [open, setOpen] = useState(!entry.collapsed)
  const content = useContent(entry, near && open)
  const name = entry.displayName ?? entry.name ?? ''
  const classes = [
    'book-statblock',
    entry.style === 'narrow' && 'is-narrow',
    entry.style === 'inset' && 'is-inset',
    content.status === 'loading' && 'is-loading',
  ]
    .filter(Boolean)
    .join(' ')

  let body: ReactNode
  if (content.status === 'row') {
    body = hasPrinted(content.row) ? (
      <PrintedEntry
        row={content.row}
        name={entry.displayName ?? content.row.name}
        headed={headed}
      />
    ) : (
      <EntryDetail
        book
        entry={content.row}
        describe={describeLookup}
        name={entry.displayName ?? lookupTitle(content.row)}
        tags={lookupTags(content.row)}
      />
    )
  } else if (content.status === 'entries') {
    body = content.panel ? (
      <div className="entry-book p-3">
        <h5 className="entry-book__title">
          <TaggedText text={name} />
        </h5>
        <hr className="entry-book__rule" />
        <Entries entries={content.entries} />
      </div>
    ) : (
      <Entries
        entries={headed ? withoutRepeatedHeading(content.entries, name) : content.entries}
      />
    )
  } else if (content.status === 'missing') {
    body = <StatblockNote entry={entry} note="not in the loaded content." />
  } else {
    body = (
      <p className="book-statblock-wait" role="status">
        {open ? `Loading ${name}...` : null}
      </p>
    )
  }

  const reserve = content.status === 'loading' ? reservedHeight(entry) : undefined
  return (
    <EntryContext.Provider value={inside}>
      <div ref={frame} className={classes} style={{ minHeight: reserve }} {...anchor}>
        <PrintedOn page={entry.printedOn} block />
        {entry.collapsed ? (
          <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
            <summary>
              <TaggedText text={name} />
            </summary>
            {open && body}
          </details>
        ) : (
          body
        )}
      </div>
    </EntryContext.Provider>
  )
}
