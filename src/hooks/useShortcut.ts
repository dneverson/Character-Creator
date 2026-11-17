import { useEffect } from 'react'

/** Whether the key press is meant for a field (typing a "/" there is typing). */
function inField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  // The attribute is checked too, as not every environment implements isContentEditable.
  return (
    target.isContentEditable ||
    target.closest('[contenteditable]:not([contenteditable="false"])') !== null ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  )
}

/**
 * Runs an action when a key is pressed on its own, anywhere on the page, unless a field
 * has the focus or something else has already taken the key.
 */
export function useShortcut(key: string, action: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== key.toLowerCase()) return
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return
      if (inField(e.target)) return
      e.preventDefault()
      action()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [key, action])
}
