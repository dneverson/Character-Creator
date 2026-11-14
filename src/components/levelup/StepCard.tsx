import { useId, useState, type ReactNode } from 'react'
import Card from 'react-bootstrap/Card'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'
import { Icon } from '../Icon'

interface Props {
  title: string
  /** One line under the title: what the step is about, or what was chosen. */
  subtitle?: ReactNode
  /** Nothing is left to choose here; undefined for a step with nothing to choose. */
  done?: boolean
  /** What is still open, for the caution's tooltip. */
  openText?: string
  /**
   * Changes when the player has made the step's choice, which folds the card away. The
   * first value does not fold it.
   */
  collapseOn?: string | number
  children: ReactNode
}

/**
 * One step of Level up: a card whose header folds it open and shut, with a check once
 * nothing is left to choose in it and a caution while something is.
 */
export function StepCard({
  title,
  subtitle,
  done,
  openText,
  collapseOn,
  children,
}: Props) {
  const [open, setOpen] = useState(true)
  const [seen, setSeen] = useState(collapseOn)
  const bodyId = useId()
  // Adjusting state during render is React's way to react to a changed input.
  if (collapseOn !== seen) {
    setSeen(collapseOn)
    setOpen(false)
  }
  const status =
    done === undefined
      ? null
      : done
        ? 'Complete: nothing left to choose here'
        : `Still open: ${openText ?? 'a choice to make'}`

  return (
    <Card className="mb-3 levelup-step">
      <Card.Header className="d-flex align-items-center gap-2 py-2">
        <button
          type="button"
          className="editor-section__toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${title}`}
          onClick={() => setOpen((v) => !v)}
        >
          <Icon
            name="expand"
            style={{
              transition: 'transform 0.15s ease',
              transform: open ? 'rotate(90deg)' : 'none',
            }}
          />
        </button>
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <div className="d-flex align-items-center gap-1">
            <h2 className="h6 mb-0">{title}</h2>
            {status && (
              <OverlayTrigger placement="top" overlay={<Tooltip>{status}</Tooltip>}>
                <span tabIndex={0}>
                  <Icon
                    name={done ? 'check' : 'warning'}
                    className={done ? 'text-success' : 'text-warning'}
                    label={status}
                  />
                </span>
              </OverlayTrigger>
            )}
          </div>
          {subtitle && <div className="small text-body-secondary">{subtitle}</div>}
        </div>
      </Card.Header>
      {open && <Card.Body id={bodyId}>{children}</Card.Body>}
    </Card>
  )
}
