import { useEffect } from 'react'
import Button from 'react-bootstrap/Button'
import { appConfig } from '../../config/app'
import { useLookupStore } from '../../lookup/state'
import { useTheme } from '../../theme/theme-context'

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

/** The navbar's button for Quick lookup, with the key that opens it from anywhere. */
export function LookupButton() {
  const { resolved } = useTheme()
  const openLookup = useLookupStore((s) => s.openLookup)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== appConfig.lookup.shortcut || e.ctrlKey || e.metaKey || e.altKey)
        return
      if (e.defaultPrevented || inField(e.target)) return
      e.preventDefault()
      openLookup()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [openLookup])
  return (
    <Button
      variant={resolved === 'dark' ? 'light' : 'secondary'}
      size="sm"
      aria-keyshortcuts={appConfig.lookup.shortcut}
      title={`Look up any spell, item, rule or class (${appConfig.lookup.shortcut})`}
      onClick={() => openLookup()}
    >
      Lookup
    </Button>
  )
}
