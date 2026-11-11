// The "informational" side of the master-detail layout. Shows the full
// detail for the focused row, or a placeholder prompt when nothing is focused.
//
// Keyboard model (entered by pressing Right past the grid row's body). The pane
// is one level below the grid; its elements are ordinary tab stops (Tab/Shift-Tab
// still work) and the arrow keys add 2D-spatial navigation between them: Left/
// Right/Up/Down move focus to the nearest focusable in that physical direction.
// Boundaries follow the owner's "levels" model:
//   - Left with nothing to the left walks back into the originating grid row
//     (the pane stays open - Right re-enters).
//   - Esc at the pane level closes the pane and returns focus to that row.
//   - A text field never traps the cursor and needs no "enter" step. Typing works
//     the moment focus is on it; Left/Right are the field's own native caret (they
//     traverse the text, not the pane); Up/Down step out of (and into) the field
//     via the spatial navigation like any other element. An open lightbox (a
//     portalled modal) handles its own Esc and never reaches here.

import { useRef, type ReactNode, type RefObject } from 'react'
import Button from 'react-bootstrap/Button'
import { Icon } from '../Icon'
import { focusables, firstInReadingOrder, nextInDirection, type Dir } from './spatialNav'

interface Props<T> {
  focusedRow: T | null
  render?: (row: T) => ReactNode
  placeholder?: ReactNode
  /** When set, the pane shows a close (X) control and closes on the Escape key. */
  onClose?: () => void
  /** Returns keyboard focus to the grid's cursor row (Left boundary / Escape). */
  onReturnToGrid?: () => void
  /**
   * The coordinator's ref to the pane element. Shared so the coordinator can
   * focus the first element after entering from the grid (it alone knows a
   * keyboard entry happened, and must wait for the content to mount); the pane
   * uses the same ref for its own key handling.
   */
  containerRef?: RefObject<HTMLDivElement | null>
}

/** Whether a caret-editable field owns arrow/Escape keys before the pane does. */
function isTextField(el: Element | null): boolean {
  if (!el) return false
  const html = el as HTMLElement
  if (html.isContentEditable) return true
  const tag = html.tagName
  if (tag === 'TEXTAREA') return true
  if (tag === 'INPUT') {
    const type = (html as HTMLInputElement).type.toLowerCase()
    return ['text', 'search', 'email', 'url', 'tel', 'password', 'number'].includes(type)
  }
  return false
}

function arrowDir(key: string): Dir | null {
  if (key === 'ArrowUp') return 'up'
  if (key === 'ArrowDown') return 'down'
  if (key === 'ArrowLeft') return 'left'
  if (key === 'ArrowRight') return 'right'
  return null
}

export function DetailPane<T>({
  focusedRow,
  render,
  placeholder = 'Select a row to see its details.',
  onClose,
  onReturnToGrid,
  containerRef,
}: Props<T>) {
  const ownRef = useRef<HTMLDivElement>(null)
  // Share the coordinator's ref when it supplies one (so it can focus the first
  // element after a keyboard entry); otherwise fall back to a private ref.
  const paneRef = containerRef ?? ownRef

  function onKeyDown(e: React.KeyboardEvent) {
    const pane = paneRef.current
    if (!pane) return
    // A lightbox (or any portalled modal) traps its own focus outside the pane
    // and handles Escape itself; don't let a stray event close the pane under it.
    if (document.querySelector('.modal.show')) return

    if (e.key === 'Escape') {
      // Pane level: close and hand focus back to the grid row.
      e.preventDefault()
      e.stopPropagation()
      onReturnToGrid?.()
      onClose?.()
      return
    }

    const dir = arrowDir(e.key)
    if (!dir) return // typing, Enter, etc. are the focused control's own business

    const active = document.activeElement
    // In a text field, Left/Right are the field's native caret (they move through
    // the text, never leave it); only Up/Down step out via spatial navigation.
    if (isTextField(active) && (dir === 'left' || dir === 'right')) return

    const items = focusables(pane)
    if (!active || !pane.contains(active as Node)) {
      e.preventDefault()
      firstInReadingOrder(items)?.focus()
      return
    }
    const target = nextInDirection(items, active as HTMLElement, dir)
    if (target) {
      e.preventDefault()
      target.focus()
    } else if (dir === 'left') {
      // Nothing to the left: walk back into the grid row (pane stays open).
      e.preventDefault()
      onReturnToGrid?.()
    } else {
      // A boundary in another direction: swallow so the pane doesn't scroll.
      e.preventDefault()
    }
  }

  const showClose = onClose !== undefined && focusedRow !== null

  return (
    <div
      className="data-table-detail position-relative"
      ref={paneRef}
      onKeyDown={onKeyDown}
    >
      {showClose && (
        <Button
          variant="secondary"
          size="sm"
          // Match Escape: hand focus back to the grid cursor row before closing,
          // so activating the X doesn't strand the last traversal position.
          onClick={() => {
            onReturnToGrid?.()
            onClose?.()
          }}
          aria-label="Close details"
          className="position-absolute top-0 end-0 m-2"
          style={{ zIndex: 1 }}
        >
          <Icon name="remove" />
        </Button>
      )}
      {focusedRow && render ? (
        render(focusedRow)
      ) : (
        <div className="text-body-secondary d-flex align-items-center justify-content-center h-100 p-3 text-center">
          {placeholder}
        </div>
      )}
    </div>
  )
}
