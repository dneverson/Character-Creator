// The way to get the books onto this device: with only the free rules in use, the full
// content (which holds them) is downloaded; otherwise every book and adventure is. Shown
// where it matters: the shelf, and a search that has nothing to read yet.

import Button from 'react-bootstrap/Button'
import { contentLibrary } from '../../content'
import { useContentSummary } from '../../content/summary'
import { docPath } from '../../books/catalog'
import type { BookDoc } from '../../books/types'
import { inBackground } from '../content/inBackground'

export function StoreBooks({
  docs,
  allStored,
}: {
  docs: readonly BookDoc[]
  /** Whether every document is on this device already, so there is nothing to download. */
  allStored: boolean
}) {
  const summary = useContentSummary()
  if (summary.state === 'free') {
    return (
      <>
        Only the free rules are in use, so the books are not here. Downloading the full
        content stores them in this browser, where they can be read and searched.{' '}
        <Button
          variant="primary"
          size="sm"
          onClick={() => inBackground(contentLibrary.enable())}
        >
          Download the full content
        </Button>
      </>
    )
  }
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        disabled={summary.state === 'downloading' || allStored}
        onClick={() =>
          inBackground(contentLibrary.download(docs.map((d) => docPath(d.kind, d.id))))
        }
      >
        Download all books and adventures
      </Button>{' '}
      {summary.state === 'downloading' && <span role="status">{summary.label}</span>}
    </>
  )
}
