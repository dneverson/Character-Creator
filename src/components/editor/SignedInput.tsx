import { DraftInput } from './DraftInput'

/** A whole-number field that accepts negatives; it commits on blur or Enter, an empty box meaning 0. */
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
  return (
    <DraftInput
      id={id}
      type="number"
      size="sm"
      className="w-auto"
      step={1}
      value={String(value)}
      onCommit={(raw) => {
        const next = raw === '' ? 0 : Number(raw)
        if (Number.isInteger(next)) onCommit(next)
      }}
      aria-label={ariaLabel}
    />
  )
}
