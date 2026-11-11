import Button from 'react-bootstrap/Button'
import Modal from 'react-bootstrap/Modal'
import {
  contentConfig,
  contentCopy,
  type ContentDownloadMode,
} from '../../config/content'
import { contentLibrary } from '../../content'
import { downloadPromptOpen, useContentSettings } from '../../content/settings'
import { inBackground } from './inBackground'

/**
 * The one-time question, asked when the app is configured to ask before
 * downloading the full content (`contentConfig.download: 'prompt'`). Either
 * answer is remembered, and can be changed later in the Book content window.
 */
export function ContentPrompt({
  mode = contentConfig.download,
}: {
  mode?: ContentDownloadMode
}) {
  const choice = useContentSettings((settings) => settings.fullContent)
  if (!downloadPromptOpen(choice, mode)) return null
  return (
    <Modal
      show
      backdrop="static"
      keyboard={false}
      centered
      aria-labelledby="content-prompt"
    >
      <Modal.Header>
        <Modal.Title id="content-prompt">Download the full book content?</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {contentCopy.notice.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <p>{contentCopy.ownership}</p>
        <p className="text-body-secondary small mb-0">
          You can change this at any time under Book content, at the top of the page.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={() => contentLibrary.disable()}>
          Use the free rules only
        </Button>
        <Button variant="primary" onClick={() => inBackground(contentLibrary.enable())}>
          Download the full content
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
