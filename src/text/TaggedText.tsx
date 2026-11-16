// A string of the data with its {@tag ...} markup drawn: a tag that names an entry the
// lookup holds becomes a reference (hover or focus for a summary, click to open the
// entry in Quick lookup); every other tag, and all the text, is drawn as plain text,
// exactly as stripTags draws it.

import { Fragment, type ReactNode } from 'react'
import { referenceOf } from '../lookup/references'
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

export function TaggedText({ text }: { text: string }) {
  const nodes: ReactNode[] = []
  let plain = ''
  const flush = () => {
    if (plain) nodes.push(stripTags(plain))
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
    const reference = match && referenceOf(match[1], stripTags(match[2]))
    if (reference) {
      flush()
      nodes.push(<TagRef key={start} reference={reference} text={stripTags(raw)} />)
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
