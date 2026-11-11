// The warning a section shows when the character's choice (a race, a background)
// comes from a book that is not selected: it stays until replaced or removed.

import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'

interface Props {
  /** What was chosen, in lower case: "race", "background". */
  noun: string
  name: string
  source: string
  onRemove: () => void
}

export function NotInBooksAlert({ noun, name, source, onRemove }: Props) {
  return (
    <Alert variant="warning" className="d-flex flex-wrap align-items-center gap-2">
      <span className="flex-grow-1">
        This character&apos;s {noun}, <strong>{name}</strong> ({source}), is not in the
        selected books. It stays on the character until you choose another {noun} or
        remove it; to see it here again, enable its book in the Books section.
      </span>
      <Button size="sm" variant="danger" onClick={onRemove}>
        Remove {noun}
      </Button>
    </Alert>
  )
}
