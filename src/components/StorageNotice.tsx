import Alert from 'react-bootstrap/Alert'
import Container from 'react-bootstrap/Container'
import { useStorageStatus } from '../storage/status'
import { Icon } from './Icon'

/**
 * The page-wide notice that the browser is not keeping the user's characters,
 * with the way to keep them anyway. It stays for the visit, because the problem
 * does. Renders nothing while storage works.
 */
export function StorageNotice() {
  const persistent = useStorageStatus((status) => status.persistent)
  if (persistent) return null
  return (
    <Container className="pt-3">
      <Alert variant="warning" className="mb-0">
        <Icon name="warning" className="me-2" />
        This browser is not saving your characters. They will be gone when this tab is
        closed. Use Export to keep a copy of each one.
      </Alert>
    </Container>
  )
}
