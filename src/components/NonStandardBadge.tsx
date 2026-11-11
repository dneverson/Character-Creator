import Badge from 'react-bootstrap/Badge'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'
import { Icon } from './Icon'

/**
 * Marks a choice that deviates from Rules As Written. The choice is still
 * allowed (DM's call); this just explains why it's non-standard. Given a `label`,
 * the badge reads that text instead (a table row's reason), capped in width with
 * an ellipsis; the full reason stays in the tooltip.
 */
export function NonStandardBadge({ reason, label }: { reason: string; label?: string }) {
  return (
    <OverlayTrigger placement="top" overlay={<Tooltip>{reason}</Tooltip>}>
      <Badge
        bg="warning"
        text="dark"
        className={`align-middle${label === undefined ? '' : ' non-standard-badge--capped'}`}
        role="note"
      >
        <Icon name="warning" className="me-1" /> {label ?? 'Non-standard'}
      </Badge>
    </OverlayTrigger>
  )
}
