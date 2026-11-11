import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import Card from 'react-bootstrap/Card'
import { Icon } from '../Icon'
import { useSectionCommand } from './sectionCollapse'
import { navbarHeight, useSectionTrail } from './sectionTrail'

interface Props {
  title: string
  subtitle?: ReactNode
  /** Right-aligned controls in the header. */
  actions?: ReactNode
  children: ReactNode
}

/**
 * Consistent titled card wrapper for a creator section in the single-scroll
 * editor. Each section is collapsible (expanded by default) so a user can hide
 * the sections they are done with and reclaim vertical space. Its header stays
 * pinned under the navbar while any of the section is on screen.
 */
export function EditorSection({ title, subtitle, actions, children }: Props) {
  const [open, setOpen] = useState(true)
  const bodyId = useId()
  const cardRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  // Set when the section is collapsed by hand, so the scroll can follow it.
  const keepInView = useRef(false)
  // The marked part of the section under the pinned header ("Class Features: Druid 5").
  const trail = useSectionTrail(cardRef, headerRef, open)
  // Apply an "expand all" / "collapse all" broadcast from the editor toolbar.
  // Each dispatch carries a fresh nonce; adjusting state during render (rather
  // than in an effect) is React's recommended way to react to a changed input,
  // and it re-applies even when the target state is unchanged.
  const command = useSectionCommand()
  const [seenNonce, setSeenNonce] = useState(command?.nonce ?? null)
  if (command && command.nonce !== seenNonce) {
    setSeenNonce(command.nonce)
    setOpen(command.open)
  }

  // Collapsing a long section from far down shrinks the page under the reader. Bring
  // the section's own header back under the navbar instead of landing somewhere else.
  useLayoutEffect(() => {
    if (open || !keepInView.current) return
    keepInView.current = false
    const top = cardRef.current?.getBoundingClientRect().top ?? 0
    const pinnedAt = navbarHeight()
    if (top < pinnedAt) window.scrollBy(0, top - pinnedAt)
  }, [open])

  return (
    <Card className="mb-4" ref={cardRef}>
      {/* The collapse control is the chevron button; a click elsewhere on the bar
          toggles too, unless it ends a text selection or lands on the text or in `actions`. */}
      <Card.Header
        ref={headerRef}
        onClick={(e) => {
          const target = e.target as HTMLElement
          if (target.closest('[data-section-actions]')) return
          const onToggle = target.closest('[data-section-toggle]') !== null
          // The words are for selecting and copying; only the bar around them is a click target.
          if (target.closest('.editor-section__title, .editor-section__subtitle')) return
          if (!onToggle && (window.getSelection()?.toString() ?? '') !== '') return
          if (open) keepInView.current = true
          setOpen((v) => !v)
        }}
        className="editor-section__header d-flex align-items-center gap-2"
      >
        <div className="flex-grow-1">
          <div className="d-flex align-items-center flex-wrap column-gap-2">
            <button
              type="button"
              data-section-toggle
              className="editor-section__toggle"
              aria-expanded={open}
              aria-controls={bodyId}
              aria-label={`${open ? 'Collapse' : 'Expand'} ${title}`}
            >
              <Icon
                name="expand"
                style={{
                  transition: 'transform 0.15s ease',
                  transform: open ? 'rotate(90deg)' : 'none',
                }}
              />
            </button>
            <h2 className="editor-section__title h5 mb-0">{title}</h2>
            {trail && (
              <span className="editor-section__trail text-body-secondary">
                {' - '}
                {trail}
              </span>
            )}
          </div>
          {subtitle && (
            <div className="editor-section__subtitle small text-body-secondary">
              {subtitle}
            </div>
          )}
        </div>
        {actions && <div data-section-actions>{actions}</div>}
      </Card.Header>
      {open && <Card.Body id={bodyId}>{children}</Card.Body>}
    </Card>
  )
}
