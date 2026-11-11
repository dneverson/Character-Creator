import { useState } from 'react'
import Container from 'react-bootstrap/Container'
import { useContentSummary } from '../../content/summary'
import { SourceUnreachable } from './SourceUnreachable'

function Notice() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return (
    <Container className="pt-3">
      <SourceUnreachable className="mb-0" onDismiss={() => setDismissed(true)} />
    </Container>
  )
}

/**
 * The page-wide notice that the content source could not be reached. Putting it
 * away lasts until the source next fails: it is mounted afresh each time.
 */
export function ContentNotice() {
  const { state } = useContentSummary()
  return state === 'unreachable' ? <Notice /> : null
}
