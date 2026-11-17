// The one link to a place in a book: a real address (so it can be copied or opened in a
// new tab) that opens the reader there when clicked. Everything that points into a book
// uses this, or `openBook` for a place that is not text.

import type { MouseEvent, ReactNode } from 'react'
import { formatBookHash } from './address'
import { openBook } from './state'
import type { BookPlace } from './types'

export function BookLink({
  place,
  className = 'tag-ref',
  onOpen,
  children,
}: {
  place: BookPlace
  className?: string
  /** Called when the click opens the place, for what must close or change with it. */
  onOpen?: () => void
  children: ReactNode
}) {
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    // A click that means "somewhere else" (a new tab, a download) is the browser's.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return
    event.preventDefault()
    openBook(place)
    onOpen?.()
  }
  return (
    <a href={formatBookHash(place)} className={className} onClick={open}>
      {children}
    </a>
  )
}
