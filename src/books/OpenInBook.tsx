// The one "open in book" control: a link-style button that opens the reader where an
// entry is printed. Every detail pane and every contents line uses it, given only what
// the entry already has: the code of its source, its page and its name.
//
// The place is worked out when the button is clicked, from the book's headings
// (`placeInBook`: the heading of that name, else the heading on or before the page), so
// nothing reads a book's text until someone asks to go there. A book whose text is not
// stored still opens: the reader says what it needs. A source that is no book or
// adventure of the catalog shows nothing, and neither does the book the reader is in
// (the link would lead to where the reader already is).

import { useContext, useState, type ReactNode } from 'react'
import Button from 'react-bootstrap/Button'
import { useAsyncData } from '../hooks/useAsyncData'
import { EntryContext } from '../text/entryContext'
import { docOfSource, placeInBook } from './address'
import { loadBookDocs } from './catalog'
import { openBook } from './state'
import type { BookDoc, DocKind } from './types'

interface Props {
  /** The code of the book or adventure the entry is printed in. */
  source: string
  /** The page it is printed on, when known. */
  page?: number
  /** The entry's name: the heading looked for, and the words the reader marks. */
  name: string
  kind?: DocKind
  /** Mark the name in the text when the reader opens (on unless the name is no entry's). */
  mark?: boolean
  /** What the button says; "Open in book" by default. */
  children?: ReactNode
  className?: string
}

/**
 * Go to where the entry is printed; a text that cannot be read leaves it to the reader.
 * The code that reads a book's text comes in with the first click, not with the page.
 */
async function openAt(doc: BookDoc, { page, name, mark = true }: Props): Promise<void> {
  const headings = await import('./load')
    .then(({ loadBookText }) => loadBookText(doc.kind, doc.id))
    .then(
      (text) => text.scan.headings,
      () => [],
    )
  openBook({ ...placeInBook(doc, headings, { page, name }), find: mark ? name : null })
}

export function OpenInBook(props: Props) {
  const { source, name, kind, children = 'Open in book', className = '' } = props
  const { data: docs } = useAsyncData(loadBookDocs)
  const [busy, setBusy] = useState(false)
  const reading = useContext(EntryContext)?.doc
  const doc = docs && docOfSource(docs, source, kind)
  if (!doc || (reading?.kind === doc.kind && reading.id === doc.id)) return null
  return (
    <Button
      variant="link"
      size="sm"
      className={`p-0 align-baseline ${className}`.trimEnd()}
      aria-label={
        name === doc.name ? `Open the ${name}` : `Open ${name} in the ${doc.name}`
      }
      aria-busy={busy}
      disabled={busy}
      onClick={() => {
        setBusy(true)
        void openAt(doc, props).finally(() => setBusy(false))
      }}
    >
      {children}
    </Button>
  )
}
