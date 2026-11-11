import { useState } from 'react'
import Button from 'react-bootstrap/Button'
import Spinner from 'react-bootstrap/Spinner'
import { useContentSummary } from '../../content/summary'
import { useTheme } from '../../theme/theme-context'
import { Icon } from '../Icon'
import { ContentSettings } from './ContentSettings'

/**
 * The navbar's view of the book content: which content is in use and whether a
 * download is running. Opens the Book content window.
 */
export function ContentButton() {
  const { resolved } = useTheme()
  const summary = useContentSummary()
  const [open, setOpen] = useState(false)
  const working = summary.state === 'downloading' || summary.state === 'importing'

  return (
    <>
      <Button
        variant={resolved === 'dark' ? 'light' : 'secondary'}
        size="sm"
        aria-label={`Book content: ${summary.label}`}
        onClick={() => setOpen(true)}
      >
        {working ? (
          <Spinner animation="border" size="sm" aria-hidden />
        ) : (
          <Icon name={summary.state === 'unreachable' ? 'warning' : 'content'} />
        )}
        {/* The words need room; a narrow screen keeps the icon alone. */}
        <span className="d-none d-sm-inline ms-2">{summary.label}</span>
      </Button>
      <ContentSettings show={open} onHide={() => setOpen(false)} />
    </>
  )
}
