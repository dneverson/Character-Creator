// The "Columns" chooser: a toolbar button whose panel lists every column
// in display order; a click anywhere on a row shows/hides it, the arrow buttons or
// a drag of the row reorder it, and Select all / Select none and Reset sit above
// and below. Header drag-and-drop is the direct-manipulation twin of the reorder
// here.
//
// The panel renders in a portal with fixed positioning and tears its listeners
// down through one AbortController, the same idiom as ColumnHeaderMenu so both
// popovers behave identically over the grid's own scroll container.

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'
import { Icon, type IconName } from '../Icon'
import type { Column } from './types'

interface Props<T> {
  /** Every column with its current visibility, in display order. */
  columnOrder: { column: Column<T>; visible: boolean }[]
  onToggle: (key: string, visible: boolean) => void
  onReorder: (order: string[]) => void
  onReset: () => void
}

/** A compact arrow button with an accessible label and a tooltip. */
function ArrowButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: IconName
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <OverlayTrigger placement="top" overlay={<Tooltip>{label}</Tooltip>}>
      <span className="d-inline-block">
        <Button
          type="button"
          variant="light"
          size="sm"
          className="py-0"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
        >
          <Icon name={icon} />
        </Button>
      </span>
    </OverlayTrigger>
  )
}

export function ColumnChooser<T>({
  columnOrder,
  onToggle,
  onReorder,
  onReset,
}: Props<T>) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  // The row being dragged and the row it is over (the drop lands in that slot).
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const keys = columnOrder.map((c) => c.column.key)
  // Keeping at least one column visible avoids an empty grid with no way back.
  const visibleCount = columnOrder.filter((c) => c.visible).length

  const close = useCallback(() => setOpen(false), [])

  const openMenu = useCallback(() => {
    const rect = toggleRef.current?.getBoundingClientRect()
    // Hung from the button's right edge so a button at the page's edge keeps the panel on screen.
    if (rect) setPos({ top: rect.bottom, right: window.innerWidth - rect.right })
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

  const move = (index: number, target: number) => {
    if (target < 0 || target >= keys.length || target === index) return
    const next = [...keys]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    onReorder(next)
  }

  const endDrag = () => {
    setDragIndex(null)
    setOverIndex(null)
  }

  const showAll = () => {
    for (const { column, visible } of columnOrder)
      if (!visible) onToggle(column.key, true)
  }
  // At least one column stays on (the first one showing), so the grid is never empty.
  const showNone = () => {
    const keep = columnOrder.find((c) => c.visible)
    for (const { column, visible } of columnOrder) {
      if (visible && column !== keep?.column) onToggle(column.key, false)
    }
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
            className="data-table-headmenu data-table-headmenu--columns card shadow"
            style={{ position: 'fixed', top: pos.top, right: pos.right }}
          >
            <div className="p-2">
              <div className="d-flex gap-2 mb-2 flex-shrink-0">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={visibleCount === columnOrder.length}
                  onClick={showAll}
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={visibleCount <= 1}
                  onClick={showNone}
                >
                  Select none
                </Button>
              </div>
              <div
                ref={listRef}
                className="data-table-headmenu__list border rounded px-2 py-1"
              >
                {columnOrder.map(({ column, visible }, index) => {
                  const label =
                    typeof column.header === 'string' ? column.header : column.key
                  const dropHere = overIndex === index && dragIndex !== index
                  return (
                    <div
                      key={column.key}
                      draggable
                      className={`d-flex align-items-center gap-2 py-1${
                        dropHere ? ' border-top border-primary' : ''
                      }`}
                      onDragStart={(e) => {
                        setDragIndex(index)
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', column.key)
                      }}
                      onDragOver={(e) => {
                        if (dragIndex === null) return
                        e.preventDefault()
                        setOverIndex(index)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (dragIndex !== null) move(dragIndex, index)
                        endDrag()
                      }}
                      onDragEnd={endDrag}
                    >
                      {/* The label is the row, so a click anywhere on it toggles. */}
                      <label
                        htmlFor={`col-${column.key}`}
                        className="d-flex align-items-center gap-2 flex-grow-1 mb-0"
                        style={{ cursor: 'pointer' }}
                      >
                        <Form.Check.Input
                          id={`col-${column.key}`}
                          type="checkbox"
                          checked={visible}
                          // Never let the user hide the last visible column.
                          disabled={visible && visibleCount === 1}
                          onChange={() => onToggle(column.key, !visible)}
                        />
                        <span>{label}</span>
                      </label>
                      <ArrowButton
                        icon="moveUp"
                        label={`Move ${label} up`}
                        disabled={index === 0}
                        onClick={() => move(index, index - 1)}
                      />
                      <ArrowButton
                        icon="moveDown"
                        label={`Move ${label} down`}
                        disabled={index === columnOrder.length - 1}
                        onClick={() => move(index, index + 1)}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="d-flex justify-content-end mt-2 flex-shrink-0">
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
