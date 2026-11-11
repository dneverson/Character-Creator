import { useId, useState, type ReactNode } from 'react'
import Card from 'react-bootstrap/Card'
import { Icon } from '../Icon'
import { useSectionCommand } from './sectionCollapse'

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
 * the sections they are done with and reclaim vertical space.
 */
export function EditorSection({ title, subtitle, actions, children }: Props) {
  const [open, setOpen] = useState(true)
  const bodyId = useId()
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
  return (
    <Card className="mb-4">
      {/* The entire header is the collapse/expand toggle. Clicks that land on the
          `actions` region are ignored so its controls keep working, and the
          keyboard toggle only fires when the header itself is focused. */}
      <Card.Header
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('[data-section-actions]')) return
          setOpen((v) => !v)
        }}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen((v) => !v)
          }
        }}
        className="d-flex align-items-center gap-2"
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        <div className="flex-grow-1">
          <h2 className="h5 mb-0 d-inline-flex align-items-center gap-2">
            <Icon
              name="expand"
              className="text-body-secondary small"
              style={{
                transition: 'transform 0.15s ease',
                transform: open ? 'rotate(90deg)' : 'none',
              }}
            />
            {title}
          </h2>
          {subtitle && <div className="small text-body-secondary">{subtitle}</div>}
        </div>
        {actions && <div data-section-actions>{actions}</div>}
      </Card.Header>
      {open && <Card.Body id={bodyId}>{children}</Card.Body>}
    </Card>
  )
}
