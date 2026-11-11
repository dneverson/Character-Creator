import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import { contentLibrary } from '../../content'
import { useContentSummary } from '../../content/summary'
import { Icon } from '../Icon'
import { inBackground } from './inBackground'

interface Props {
  /** Lets the visitor put the notice away; omitted where it should stay. */
  onDismiss?: () => void
  className?: string
}

/**
 * Says the content source could not be reached and offers to try again. Renders
 * nothing while the source is fine.
 */
export function SourceUnreachable({ onDismiss, className }: Props) {
  const summary = useContentSummary()
  if (summary.state !== 'unreachable') return null
  return (
    <Alert
      variant="warning"
      className={className}
      dismissible={onDismiss !== undefined}
      onClose={onDismiss}
    >
      <div className="d-flex flex-wrap align-items-center gap-2">
        <span>
          <Icon name="warning" className="me-2" />
          {summary.detail}
        </span>
        <Button
          variant="warning"
          size="sm"
          className="ms-auto"
          onClick={() => inBackground(contentLibrary.retry())}
        >
          Try again
        </Button>
      </div>
    </Alert>
  )
}
