// The count of a thing that can be had in number: minus, the number (typed or stepped) and
// plus. The picker of a section and the sheet's inventory show it the same way.

import { useState } from 'react'
import Form from 'react-bootstrap/Form'
import { RowActionButton } from './RowActionButton'

/** Minus, the number (typed or stepped) and plus. Reaching 0 takes the pick away. */
export function QuantityCell({
  name,
  quantity,
  onChange,
}: {
  name: string
  quantity: number
  onChange: (n: number) => void
}) {
  // What is being typed, so the box can be emptied to type another number; it
  // gives way to the real quantity once the box is left.
  const [draft, setDraft] = useState<string>()
  return (
    <span className="d-inline-flex align-items-center gap-1">
      <RowActionButton
        label={`One fewer ${name}`}
        kind="remove"
        variant="secondary"
        onClick={() => {
          setDraft(undefined)
          onChange(quantity - 1)
        }}
      />
      <Form.Control
        type="number"
        size="sm"
        min={0}
        value={draft ?? quantity}
        style={{ width: 70 }}
        onBlur={() => setDraft(undefined)}
        aria-label={`Quantity of ${name}`}
        onChange={(e) => {
          setDraft(e.target.value)
          const n = Math.floor(Number(e.target.value))
          if (e.target.value !== '' && Number.isFinite(n)) onChange(n)
        }}
      />
      <RowActionButton
        label={`One more ${name}`}
        kind="add"
        variant="secondary"
        onClick={() => {
          setDraft(undefined)
          onChange(quantity + 1)
        }}
      />
    </span>
  )
}
