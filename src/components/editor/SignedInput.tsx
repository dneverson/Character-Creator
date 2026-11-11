import { useState } from 'react'
import Form from 'react-bootstrap/Form'

/** A whole-number field that accepts negatives: a lone "-" stays typed until a digit follows. */
export function SignedInput({
  id,
  value,
  ariaLabel,
  onCommit,
}: {
  id: string
  value: number
  ariaLabel: string
  onCommit: (next: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <Form.Control
      id={id}
      type="number"
      size="sm"
      className="w-auto"
      step={1}
      value={draft ?? String(value)}
      onChange={(e) => {
        const raw = e.target.value
        setDraft(raw)
        const next = Number(raw)
        if (raw !== '' && Number.isInteger(next)) onCommit(next)
        else if (raw === '') onCommit(0)
      }}
      onBlur={() => setDraft(null)}
      aria-label={ariaLabel}
    />
  )
}
