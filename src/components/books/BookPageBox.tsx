// The page box of the reader's bar, as in a PDF viewer: the page the reader is on, which can
// be typed over to go to another page, and the book's last page. A page the text does not
// mark (it marks the page a part starts on) goes to the nearest marked page before it.

import { useState, type FormEvent } from 'react'
import Form from 'react-bootstrap/Form'

interface Props {
  /** The page the reader is on. */
  page: number
  /** The book's last page: the highest page its text marks. */
  last: number
  onGo: (page: number) => void
}

export function BookPageBox({ page, last, onGo }: Props) {
  // What is typed, while the box is being edited; otherwise the box shows the current page.
  const [draft, setDraft] = useState<string | null>(null)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const typed = Number(draft)
    if (draft !== null && draft.trim() !== '' && Number.isInteger(typed)) {
      onGo(Math.min(Math.max(typed, 1), last))
    }
    setDraft(null)
  }

  return (
    <form className="book-pagebox" onSubmit={submit}>
      <Form.Control
        size="sm"
        className="book-pagebox-input"
        inputMode="numeric"
        autoComplete="off"
        aria-label="Page"
        value={draft ?? String(page)}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
        onFocus={(e) => e.target.select()}
        onBlur={() => setDraft(null)}
      />
      <span className="book-pagebox-last">of {last}</span>
    </form>
  )
}
