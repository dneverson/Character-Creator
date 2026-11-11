// The Book content window: what content is in use, where it comes from, and the
// few things the visitor can do about it (download it, check for a newer version,
// bring in their own copy, remove it, or point the app at another source).

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import Accordion from 'react-bootstrap/Accordion'
import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import Modal from 'react-bootstrap/Modal'
import ProgressBar from 'react-bootstrap/ProgressBar'
import Spinner from 'react-bootstrap/Spinner'
import { contentConfig, contentCopy, type ContentSource } from '../../config/content'
import { contentLibrary } from '../../content'
import { useContentStatus } from '../../content/library'
import { fullContentWanted, useContentSettings } from '../../content/settings'
import { useContentSummary } from '../../content/summary'
import { formatTimestamp } from '../../ui/date'
import { FreeRulesLicense } from './FreeRulesLicense'
import { inBackground } from './inBackground'
import { SourceUnreachable } from './SourceUnreachable'

/** An `owner/name` repository on the source's host. */
const REPOSITORY = /^[\w.-]+\/[\w.-]+$/

// Picking a whole folder is a browser feature not every browser has (phones
// mostly do not), and not one React's own input props know about.
const FOLDER_PICKER = { webkitdirectory: '' }
const canPickFolder = () => 'webkitdirectory' in HTMLInputElement.prototype

function sameSource(a: ContentSource, b: ContentSource): boolean {
  return (
    a.dataRepository === b.dataRepository &&
    a.imageRepository === b.imageRepository &&
    a.ref === b.ref
  )
}

/** What is stored in this browser, and which version of the content it is. */
function StoredContent() {
  const status = useContentStatus()
  const version = status.commit
    ? status.commit.slice(0, 7)
    : status.origin === 'import'
      ? 'Your own copy'
      : 'Not known yet'
  return (
    <dl className="row small mb-3">
      <dt className="col-5 col-sm-4 text-body-secondary fw-normal">Stored here</dt>
      <dd className="col-7 col-sm-8">
        {status.stored} {status.stored === 1 ? 'file' : 'files'}
      </dd>
      <dt className="col-5 col-sm-4 text-body-secondary fw-normal">Version</dt>
      <dd className="col-7 col-sm-8">{version}</dd>
      <dt className="col-5 col-sm-4 text-body-secondary fw-normal">Last checked</dt>
      <dd className="col-7 col-sm-8 mb-0">
        {status.checkedAt > 0 ? formatTimestamp(status.checkedAt) : 'Never'}
      </dd>
    </dl>
  )
}

/** The fields naming where the full content is downloaded from. */
function SourceForm({ onApplied }: { onApplied: () => void }) {
  const current = useContentSettings((settings) => settings.source)
  const [draft, setDraft] = useState<ContentSource>(current)
  const edit = (field: keyof ContentSource) => (event: ChangeEvent<HTMLInputElement>) =>
    setDraft({ ...draft, [field]: event.target.value.trim() })

  const valid =
    REPOSITORY.test(draft.dataRepository) &&
    REPOSITORY.test(draft.imageRepository) &&
    draft.ref !== ''

  function apply(source: ContentSource) {
    const ok = confirm(
      'Change the content source? What was downloaded from the current one is removed from this browser. Your characters are kept.',
    )
    if (!ok) return
    setDraft(source)
    inBackground(contentLibrary.useSource(source))
    onApplied()
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (valid && !sameSource(draft, current)) apply({ ...draft })
  }

  return (
    <Form onSubmit={onSubmit} noValidate>
      <p className="small text-body-secondary">
        The full content is read from two public repositories on GitHub. Change these only
        to use another mirror of the same data.
      </p>
      <Form.Group className="mb-2" controlId="content-data-repository">
        <Form.Label className="small mb-1">Data repository</Form.Label>
        <Form.Control
          size="sm"
          value={draft.dataRepository}
          onChange={edit('dataRepository')}
          isInvalid={!REPOSITORY.test(draft.dataRepository)}
          placeholder="owner/name"
        />
      </Form.Group>
      <Form.Group className="mb-2" controlId="content-image-repository">
        <Form.Label className="small mb-1">Image repository</Form.Label>
        <Form.Control
          size="sm"
          value={draft.imageRepository}
          onChange={edit('imageRepository')}
          isInvalid={!REPOSITORY.test(draft.imageRepository)}
          placeholder="owner/name"
        />
      </Form.Group>
      <Form.Group className="mb-3" controlId="content-ref">
        <Form.Label className="small mb-1">Branch or tag</Form.Label>
        <Form.Control
          size="sm"
          value={draft.ref}
          onChange={edit('ref')}
          isInvalid={draft.ref === ''}
        />
      </Form.Group>
      <div className="d-flex flex-wrap gap-2">
        <Button
          type="submit"
          size="sm"
          variant="primary"
          disabled={!valid || sameSource(draft, current)}
        >
          Use this source
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={sameSource(current, contentConfig.source)}
          onClick={() => apply({ ...contentConfig.source })}
        >
          Back to the default source
        </Button>
      </div>
    </Form>
  )
}

interface Props {
  show: boolean
  onHide: () => void
}

export function ContentSettings({ show, onHide }: Props) {
  const status = useContentStatus()
  const summary = useContentSummary()
  const folderInput = useRef<HTMLInputElement>(null)
  const [checking, setChecking] = useState(false)
  // What the last action the visitor took came to.
  const [outcome, setOutcome] = useState<string | null>(null)

  const inUse = fullContentWanted(useContentSettings((settings) => settings.fullContent))
  const busy = checking || status.activity !== 'idle'

  async function checkNow() {
    setChecking(true)
    setOutcome(null)
    const answered = await contentLibrary.checkForUpdate(true).catch(() => false)
    setChecking(false)
    setOutcome(
      answered
        ? 'Checked. Anything that changed is being downloaded.'
        : 'The source could not be checked just now. Try again later.',
    )
  }

  async function onPickFolder(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? [])
    event.target.value = '' // allow picking the same folder again
    if (picked.length === 0) return
    setOutcome(null)
    const count = await contentLibrary.importFiles(picked).catch(() => 0)
    setOutcome(
      count > 0
        ? `Stored ${count} ${count === 1 ? 'file' : 'files'} from this device.`
        : 'No book content was found in that folder.',
    )
  }

  function removeAll() {
    const ok = confirm(
      'Remove all downloaded book content from this browser? Your characters are kept.',
    )
    if (!ok) return
    setOutcome(null)
    inBackground(contentLibrary.remove())
  }

  return (
    <Modal show={show} onHide={onHide} size="lg" aria-labelledby="content-settings">
      <Modal.Header closeButton>
        <Modal.Title id="content-settings">Book content</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <h6 className="mb-1">{summary.label}</h6>
        {summary.state === 'unreachable' ? (
          <SourceUnreachable className="mt-2" />
        ) : (
          <p className="text-body-secondary">{summary.detail}</p>
        )}
        {summary.state === 'downloading' && (
          <ProgressBar className="mb-3">
            {/* The inner bar is the one assistive technology reads, so it carries the name. */}
            <ProgressBar
              now={status.done}
              max={status.total}
              aria-label="Download progress"
            />
          </ProgressBar>
        )}
        <StoredContent />

        {outcome && (
          <Alert variant="info" className="py-2 small" role="status">
            {outcome}
          </Alert>
        )}

        <div className="d-flex flex-wrap gap-2 mb-2">
          {inUse ? (
            <>
              <Button variant="primary" size="sm" disabled={busy} onClick={checkNow}>
                {checking && (
                  <Spinner animation="border" size="sm" className="me-2" aria-hidden />
                )}
                Check for updates
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setOutcome(null)
                  contentLibrary.disable()
                }}
              >
                Use the free rules only
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="sm"
              disabled={status.activity === 'importing'}
              onClick={() => {
                setOutcome(null)
                inBackground(contentLibrary.enable())
              }}
            >
              Download the full content
            </Button>
          )}
          {canPickFolder() && (
            <Button
              variant="secondary"
              size="sm"
              disabled={status.activity === 'importing'}
              onClick={() => folderInput.current?.click()}
            >
              Import from this device
            </Button>
          )}
          {status.stored > 0 && (
            <Button variant="danger" size="sm" className="ms-auto" onClick={removeAll}>
              Remove downloaded content
            </Button>
          )}
        </div>
        <input
          ref={folderInput}
          type="file"
          multiple
          className="d-none"
          aria-label="Folder to import"
          onChange={onPickFolder}
          {...FOLDER_PICKER}
        />
        <p className="small text-body-secondary">
          {canPickFolder()
            ? 'Importing reads a copy of the data folder (and the image folder, for covers) that you already have on this device. Nothing is uploaded.'
            : 'This browser cannot pick a folder, so importing your own copy is not available here.'}
          {status.origin === 'import' &&
            status.stored > 0 &&
            ' Your own copy is in use: checking for updates replaces its files with the newer ones from the source.'}
        </p>

        <Accordion className="mb-3">
          <Accordion.Item eventKey="source">
            <Accordion.Header>Content source</Accordion.Header>
            <Accordion.Body>
              <SourceForm onApplied={() => setOutcome(null)} />
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="license">
            <Accordion.Header>License of the free rules</Accordion.Header>
            <Accordion.Body>
              <FreeRulesLicense />
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>

        <div className="small text-body-secondary">
          {contentCopy.notice.map((paragraph) => (
            <p key={paragraph} className="mb-1">
              {paragraph}
            </p>
          ))}
          <p className="mb-0">{contentCopy.ownership}</p>
        </div>
      </Modal.Body>
    </Modal>
  )
}
