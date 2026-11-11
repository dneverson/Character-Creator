import { useState, type ReactNode } from 'react'
import Button from 'react-bootstrap/Button'
import ListGroup from 'react-bootstrap/ListGroup'
import Modal from 'react-bootstrap/Modal'
import type { RollRecord } from '../../character/model'
import { formatTimestamp } from '../../ui/date'
import { Icon } from '../Icon'

/**
 * Back / forward / history controls for one roll stream. Given the stream's
 * records (oldest first) and the applied record's id, it steps the cursor with
 * the two arrow buttons and opens a modal to jump to any past roll. It is stream
 * agnostic: the caller supplies a `renderSummary` for the one-line description, so
 * ability rolls and hit-die rolls reuse the same control.
 */
export function RollHistoryControls({
  records,
  activeId,
  onSelect,
  renderSummary,
  title = 'Roll history',
}: {
  /** The stream's records, oldest first. */
  records: RollRecord[]
  /** The applied record's id, or null when none is applied yet. */
  activeId: string | null
  /** Apply a chosen record (restore its roll and move the cursor to it). */
  onSelect: (record: RollRecord) => void
  /** One-line summary of a record for the arrow titles and the modal rows. */
  renderSummary: (record: RollRecord) => ReactNode
  /** Heading for the history modal. */
  title?: string
}) {
  const [open, setOpen] = useState(false)

  // With no cursor yet, treat the position as just past the newest, so "back"
  // lands on the newest roll and "forward" has nowhere to go.
  const index = activeId ? records.findIndex((r) => r.id === activeId) : records.length
  const prev = index > 0 ? records[index - 1] : null
  const next = index >= 0 && index < records.length - 1 ? records[index + 1] : null

  if (records.length === 0) return null

  return (
    <>
      <div className="btn-group" role="group" aria-label={title}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => prev && onSelect(prev)}
          disabled={!prev}
          aria-label="Previous roll"
        >
          <Icon name="historyPrev" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => next && onSelect(next)}
          disabled={!next}
          aria-label="Next roll"
        >
          <Icon name="historyNext" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setOpen(true)}
          aria-label={`${title} (${records.length})`}
        >
          <Icon name="history" className="me-1" />
          {records.length}
        </Button>
      </div>

      <Modal show={open} onHide={() => setOpen(false)} centered scrollable>
        <Modal.Header closeButton>
          <Modal.Title as="h5">{title}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0">
          <ListGroup variant="flush">
            {[...records].reverse().map((record) => {
              const isActive = record.id === activeId
              return (
                <ListGroup.Item
                  key={record.id}
                  action
                  active={isActive}
                  onClick={() => {
                    onSelect(record)
                    setOpen(false)
                  }}
                  aria-current={isActive}
                  className="d-flex justify-content-between align-items-center gap-3"
                >
                  <span>{renderSummary(record)}</span>
                  <span
                    className={`small text-nowrap ${isActive ? '' : 'text-body-secondary'}`}
                  >
                    {formatTimestamp(record.at)}
                  </span>
                </ListGroup.Item>
              )
            })}
          </ListGroup>
        </Modal.Body>
      </Modal>
    </>
  )
}
