import { useId, useState, type FormEvent } from 'react'
import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import Modal from 'react-bootstrap/Modal'
import Spinner from 'react-bootstrap/Spinner'
import { useAccountStore, type Account } from '../../cloud/account'

interface Props {
  account: Account
  email: string
  show: boolean
  onHide: () => void
}

/**
 * The last question before an account is deleted: what goes, what stays, and the account's
 * own email typed in, so the red button cannot be pressed by accident.
 */
export function DeleteAccountModal({ account, email, show, onHide }: Props) {
  const { busy, error } = useAccountStore()
  const [typed, setTyped] = useState('')
  const titleId = useId()
  const fieldId = useId()
  const matches = typed.trim().toLowerCase() === email.trim().toLowerCase()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (matches && !busy) void account.deleteAccount()
  }

  return (
    <Modal
      show={show}
      onHide={busy ? () => {} : onHide}
      onExited={() => setTyped('')}
      backdrop={busy ? 'static' : true}
      keyboard={!busy}
      centered
      aria-labelledby={titleId}
    >
      <Form onSubmit={submit}>
        <Modal.Header closeButton={!busy}>
          <Modal.Title as="h2" className="h5" id={titleId}>
            Delete your account?
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-1">This deletes, at once and for good:</p>
          <ul>
            <li>Your account and your email address.</li>
            <li>Every copy of your characters in the cloud.</li>
          </ul>
          <p className="mb-1">This does not delete:</p>
          <ul>
            <li>The characters stored on this device. They stay and keep working.</li>
          </ul>
          <p>This cannot be undone.</p>
          <Form.Group controlId={fieldId}>
            <Form.Label>
              To confirm, type your email address: <strong>{email}</strong>
            </Form.Label>
            <Form.Control
              type="email"
              autoComplete="off"
              spellCheck={false}
              autoFocus
              value={typed}
              disabled={busy}
              onChange={(event) => setTyped(event.target.value)}
            />
          </Form.Group>
          {error && (
            <Alert variant="danger" className="mt-3 mb-0" role="alert">
              {error}
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" disabled={busy} onClick={onHide}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" disabled={!matches || busy}>
            {busy && <Spinner as="span" size="sm" className="me-2" aria-hidden="true" />}
            {busy ? 'Deleting...' : 'Delete my account'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}
