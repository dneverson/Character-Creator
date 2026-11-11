import { useEffect, useRef, useState } from 'react'

/**
 * Keeps what the user is typing in local state and writes it out only when they
 * finish: on blur, on Enter (single-line inputs only, see `DraftInput`) or when
 * the field unmounts, so nothing typed is lost. Typing therefore costs no store
 * write, history entry, save or re-derivation per key.
 *
 * The text resyncs to `value` whenever the stored value changes from outside
 * (another character loaded, undo, a table roll writing into the field) and after
 * every commit, so a value the store normalised (clamped, trimmed) shows as stored.
 */
export function useDraft(value: string, onCommit: (next: string) => void) {
  const [draft, setDraft] = useState(value)
  const [dirty, setDirty] = useState(false)
  const [seen, setSeen] = useState(value)

  let shown = draft
  let isDirty = dirty
  if (value !== seen) {
    setSeen(value)
    setDraft(value)
    setDirty(false)
    shown = value
    isDirty = false
  } else if (!dirty && draft !== value) {
    setDraft(value)
    shown = value
  }

  const latest = useRef({ draft: shown, dirty: isDirty, value, onCommit })
  useEffect(() => {
    latest.current = { draft: shown, dirty: isDirty, value, onCommit }
  })

  function commit() {
    const now = latest.current
    if (!now.dirty) return
    now.dirty = false
    setDirty(false)
    if (now.draft !== now.value) now.onCommit(now.draft)
  }

  /** `now` writes straight out (a stepper change) instead of waiting for blur or Enter. */
  function change(next: string, now = false) {
    latest.current = { ...latest.current, draft: next, dirty: !now }
    setDraft(next)
    setDirty(!now)
    if (now && next !== value) onCommit(next)
  }

  useEffect(
    () => () => {
      const now = latest.current
      if (now.dirty && now.draft !== now.value) now.onCommit(now.draft)
    },
    [],
  )

  return { text: shown, change, commit }
}
