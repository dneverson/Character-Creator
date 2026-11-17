// A string of the data with its {@tag ...} markup drawn: a tag that names an entry the
// lookup holds becomes a reference (hover or focus for a summary, click to open the
// entry in Quick lookup); a tag that only styles the text (italic, bold, a note) styles
// it; in the book reader a tag that names a place in a book becomes a link to it. Every
// other tag, and all the text, is drawn as plain text, exactly as stripTags draws it.
// Inside the reader the words of a search are marked wherever they appear.

import { Fragment, useContext, type ReactNode } from 'react'
import { placeOfTag } from '../books/address'
import { BookLink } from '../books/BookLink'
import { referenceOf } from '../lookup/references'
import { EntryContext } from './entryContext'
import { markWords } from './highlight'
import { TagRef } from './TagRef'
import { stripTags } from './tags'

/** The end of the tag that opens at `start` (its closing brace), nesting counted. */
function tagEnd(text: string, start: number): number {
  let depth = 0
  for (let i = start; i < text.length; i++) {
    if (text.startsWith('{@', i)) depth++
    else if (text[i] === '}' && --depth === 0) return i
  }
  return -1
}

/** Tags that style the text they hold, and the element or class that does it. */
const STYLES: Record<string, 'em' | 'strong' | 'u' | 's' | 'sup' | 'note'> = {
  i: 'em',
  italic: 'em',
  b: 'strong',
  bold: 'strong',
  u: 'u',
  s: 's',
  strike: 's',
  sup: 'sup',
  note: 'note',
}

function Styled({ style, children }: { style: string; children: ReactNode }) {
  switch (style) {
    case 'em':
      return <em>{children}</em>
    case 'strong':
      return <strong>{children}</strong>
    case 'u':
      return <u>{children}</u>
    case 's':
      return <s>{children}</s>
    case 'sup':
      return <sup>{children}</sup>
    default:
      return <span className="entry-note">{children}</span>
  }
}

export function TaggedText({ text }: { text: string }) {
  const context = useContext(EntryContext)
  const words = context?.words ?? []
  const nodes: ReactNode[] = []
  let plain = ''
  const flush = () => {
    if (plain) nodes.push(markWords(stripTags(plain), words))
    plain = ''
  }
  let at = 0
  while (at < text.length) {
    const start = text.indexOf('{@', at)
    const end = start === -1 ? -1 : tagEnd(text, start)
    if (start === -1 || end === -1) {
      plain += text.slice(at)
      break
    }
    plain += text.slice(at, start)
    const raw = text.slice(start, end + 1)
    const match = /^\{@(\w+)\s*([\s\S]*)\}$/.exec(raw)
    const tag = match?.[1] ?? ''
    const reference = match && referenceOf(tag, stripTags(match[2]))
    const link = context?.book && match ? placeOfTag(tag, stripTags(match[2])) : null
    if (reference) {
      flush()
      nodes.push(
        <TagRef
          key={start}
          reference={reference}
          text={stripTags(raw)}
          label={markWords(stripTags(raw), words)}
        />,
      )
    } else if (link) {
      flush()
      nodes.push(
        <BookLink key={start} place={link.place}>
          {markWords(stripTags(link.text), words)}
        </BookLink>,
      )
    } else if (match && tag in STYLES) {
      flush()
      nodes.push(
        <Styled key={start} style={STYLES[tag]}>
          <TaggedText text={match[2]} />
        </Styled>,
      )
    } else plain += raw
    at = end + 1
  }
  flush()
  return (
    <>
      {nodes.map((node, i) => (
        <Fragment key={i}>{node}</Fragment>
      ))}
    </>
  )
}
