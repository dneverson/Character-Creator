// The one button a table row carries: a plus (add, choose, take) or a minus (take
// away) icon, the same size in every row of every table. Its exact words are its
// accessible name and its tooltip; the full-text version lives in the detail pane.

import Button from 'react-bootstrap/Button'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'
import { Icon } from '../Icon'

interface Props {
  /** The words the icon stands for ("Choose", "Remove from build"). */
  label: string
  /** `add` shows a plus; `remove` a minus. */
  kind: 'add' | 'remove'
  variant: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
  onClick: () => void
}

export function RowActionButton({ label, kind, variant, disabled, onClick }: Props) {
  return (
    <OverlayTrigger placement="top" overlay={<Tooltip>{label}</Tooltip>}>
      {/* A disabled button fires no pointer events, so the span carries the tooltip. */}
      <span className="d-inline-block">
        <Button
          size="sm"
          variant={variant}
          className="row-action-btn"
          aria-label={label}
          disabled={disabled}
          onClick={(e) => {
            // The click is the action, not a request for the row's detail.
            e.stopPropagation()
            onClick()
          }}
        >
          <Icon name={kind === 'add' ? 'add' : 'minus'} />
        </Button>
      </span>
    </OverlayTrigger>
  )
}
