// A value of a spell the character's class options changed, with an info mark that names
// which options did.

import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'
import type { Line } from '../../derived/types'
import { Icon } from '../Icon'

export function ChangedValue({ lines, value }: { lines: Line[]; value: string }) {
  const why = lines.map((l) => `${l.label}: ${l.how}`).join('; ')
  return (
    <>
      {value}{' '}
      <OverlayTrigger placement="top" overlay={<Tooltip>{why}</Tooltip>}>
        <span className="text-body-secondary" aria-label={why}>
          <Icon name="info" />
        </span>
      </OverlayTrigger>
    </>
  )
}
