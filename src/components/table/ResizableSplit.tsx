// A two-pane split with a draggable divider. Drag the handle to
// trade width between the master (left) and detail (right) panes. On narrow
// viewports the panes stack (handled in CSS via `.data-table-split`), so this is
// the seam the later mobile pass refines rather than rewrites.

import { useCallback, useRef, useState, type ReactNode } from 'react'

interface Props {
  master: ReactNode
  /**
   * The right-hand pane. When absent the master fills the full width and the
   * divider is not rendered, yet the master stays mounted in the same DOM slot -
   * so toggling a detail in and out never remounts the master (its scroll
   * position survives). The split width is remembered for when a detail returns.
   */
  detail?: ReactNode
  /** Initial master-pane width as a percentage of the container. */
  initialMasterPct?: number
  /** Clamp bounds for the master pane, in percent. */
  minPct?: number
  maxPct?: number
}

export function ResizableSplit({
  master,
  detail,
  initialMasterPct = 55,
  minPct = 30,
  maxPct = 75,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragAbortRef = useRef<AbortController | null>(null)
  const [masterPct, setMasterPct] = useState(initialMasterPct)
  const [dragging, setDragging] = useState(false)

  const clamp = useCallback(
    (pct: number) => Math.min(maxPct, Math.max(minPct, pct)),
    [minPct, maxPct],
  )

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      if (rect.width === 0) return
      setMasterPct(clamp(((event.clientX - rect.left) / rect.width) * 100))
    },
    [clamp],
  )

  // One AbortController per drag removes both listeners at once, so stopDrag
  // never has to reference itself to unregister.
  const stopDrag = useCallback(() => {
    setDragging(false)
    dragAbortRef.current?.abort()
    dragAbortRef.current = null
  }, [])

  const startDrag = useCallback(() => {
    setDragging(true)
    const controller = new AbortController()
    dragAbortRef.current = controller
    window.addEventListener('pointermove', onPointerMove, { signal: controller.signal })
    window.addEventListener('pointerup', stopDrag, { signal: controller.signal })
  }, [onPointerMove, stopDrag])

  const onHandleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'ArrowLeft') setMasterPct((p) => clamp(p - 4))
      else if (event.key === 'ArrowRight') setMasterPct((p) => clamp(p + 4))
    },
    [clamp],
  )

  const hasDetail = detail != null

  return (
    <div
      ref={containerRef}
      className={`data-table-split${hasDetail ? ' data-table-split--detail' : ''}${dragging ? ' data-table-split--dragging' : ''}`}
    >
      <div
        className="data-table-split__master"
        style={{ flexBasis: hasDetail ? `${masterPct}%` : '100%' }}
      >
        {master}
      </div>
      {hasDetail && (
        <>
          <div
            className="data-table-split__handle"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panes"
            aria-valuenow={Math.round(masterPct)}
            aria-valuemin={minPct}
            aria-valuemax={maxPct}
            tabIndex={0}
            onPointerDown={startDrag}
            onKeyDown={onHandleKeyDown}
          />
          <div className="data-table-split__detail">{detail}</div>
        </>
      )}
    </div>
  )
}
