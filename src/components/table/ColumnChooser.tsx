// The "Columns" chooser: a toolbar button whose panel lists every column
// in display order with a checkbox to show/hide it and Move up / Move down to
// reorder it, plus Reset to restore the declared layout. Header drag-and-drop
// is the direct-manipulation twin of the reorder buttons here.
//
// The panel renders in a portal with fixed positioning and tears its listeners
// down through one AbortController, the same idiom as ColumnHeaderMenu so both
// popovers behave identically over the grid's own scroll container.

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import type { Column } from './types'

interface Props<T> {
  /** Every column with its current visibility, in display order. */
  columnOrder: { column: Column<T>; visible: boolean }[]
  onToggle: (key: string, visible: boolean) => void
  onReorder: (order: string[]) => void
  onReset: () => void
}

export function ColumnChooser<T>({
  columnOrder,
  onToggle,
  onReorder,
  onReset,
}: Props<T>) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const keys = columnOrder.map((c) => c.column.key)
  // Keeping at least one column visible avoids an empty grid with no way back.
  const visibleCount = columnOrder.filter((c) => c.visible).length

  const close = useCallback(() => setOpen(false), [])

  const openMenu = useCallback(() => {
    const rect = toggleRef.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom, left: rect.left })
    setOpen(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node
      if (!panelRef.current?.contains(target) && !toggleRef.current?.contains(target)) {
        close()
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    // Scrolling the column list stays inside the panel; scrolling anywhere else
    // is a click-out - dismiss and let that outside scroll proceed as normal.
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return
      close()
    }
    // A wheel over the panel must never scroll the page behind it. The list caps
    // its own chaining via overscroll-behavior; here we stop a wheel over the
    // panel's non-scrolling chrome from leaking out. (React's onWheel is passive,
    // so preventDefault needs a native, non-passive listener.)
    const onWheel = (e: WheelEvent) => {
      if (listRef.current?.contains(e.target as Node)) return
      e.preventDefault()
    }
    const { signal } = controller
    document.addEventListener('pointerdown', onPointer, { signal })
    document.addEventListener('keydown', onKey, { signal })
    window.addEventListener('scroll', onScroll, { capture: true, signal })
    window.addEventListener('resize', close, { signal })
    panelRef.current?.addEventListener('wheel', onWheel, { passive: false, signal })
    return () => controller.abort()
  }, [open, close])

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= keys.length) return
    const next = [...keys]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    onReorder(next)
  }

  return (
    <>
      <Button
        ref={toggleRef}
        type="button"
        variant="secondary"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : openMenu())}
      >
        Columns
      </Button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            aria-label="Choose columns"
            className="data-table-headmenu card shadow"
            style={{ position: 'fixed', top: pos.top, left: pos.left }}
          >
            <div className="p-2">
              <div
                ref={listRef}
                className="data-table-headmenu__list border rounded px-2 py-1"
              >
                {columnOrder.map(({ column, visible }, index) => {
                  const label =
                    typeof column.header === 'string' ? column.header : column.key
                  return (
                    <div
                      key={column.key}
                      className="d-flex align-items-center gap-2 py-1"
                    >
                      <Form.Check
                        type="checkbox"
                        className="flex-grow-1 mb-0"
                        label={label}
                        aria-label={label}
                        checked={visible}
                        // Never let the user hide the last visible column.
                        disabled={visible && visibleCount === 1}
                        onChange={() => onToggle(column.key, !visible)}
                      />
                      <Button
                        type="button"
                        variant="light"
                        size="sm"
                        className="py-0"
                        aria-label={`Move ${label} up`}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        Up
                      </Button>
                      <Button
                        type="button"
                        variant="light"
                        size="sm"
                        className="py-0"
                        aria-label={`Move ${label} down`}
                        disabled={index === columnOrder.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        Down
                      </Button>
                    </div>
                  )
                })}
              </div>
              <div className="d-flex justify-content-end mt-2">
                <Button type="button" variant="secondary" size="sm" onClick={onReset}>
                  Reset
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
