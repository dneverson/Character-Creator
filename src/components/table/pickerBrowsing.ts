// When a picker's browse table is open or shut, shared by every picker (PickOne
// for one choice, PickMany for several). The table is open or shut by the picker
// itself, or by its section when that passes `browsing` (several pickers on a
// page, only one table open at a time). When the table shuts for the summary that
// replaces it, the summary is scrolled into view: the table is far taller.

import { useEffect, useRef, useState, type RefObject } from 'react'

export interface PickerBrowsingProps {
  /**
   * Whether the table is open, when the section decides. Unset, the picker keeps
   * it: open until something is chosen, and again while the choice is changed. Set,
   * a picker with nothing chosen and its table shut shows a line to open it.
   */
  browsing?: boolean
  /** The table was opened or shut: by a pick, a button or the line's button. */
  onBrowsingChange?: (browsing: boolean) => void
}

interface Options extends PickerBrowsingProps {
  /** Keeping it itself: the table is open whenever this is true (nothing chosen). */
  openWhenIdle?: boolean
  /** Keeping it itself: whether the table starts open, before anything shuts it. */
  initiallyOpen?: boolean
}

export interface PickerBrowsing {
  browsing: boolean
  setBrowsing: (open: boolean) => void
  /** Goes on the summary that replaces the table. */
  summary: RefObject<HTMLDivElement | null>
}

export function usePickerBrowsing({
  browsing: browsingProp,
  onBrowsingChange,
  openWhenIdle = false,
  initiallyOpen = false,
}: Options): PickerBrowsing {
  const [open, setOpen] = useState(initiallyOpen)
  const summary = useRef<HTMLDivElement>(null)
  const controlled = browsingProp !== undefined
  const browsing = controlled ? browsingProp : openWhenIdle || open
  const setBrowsing = (next: boolean) => {
    if (controlled) onBrowsingChange?.(next)
    else setOpen(next)
  }

  const wasBrowsing = useRef(browsing)
  useEffect(() => {
    if (wasBrowsing.current && !browsing)
      summary.current?.scrollIntoView({ block: 'nearest' })
    wasBrowsing.current = browsing
  }, [browsing])

  return { browsing, setBrowsing, summary }
}
