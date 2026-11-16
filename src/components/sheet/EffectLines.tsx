// What a feature does to the numbers of the sheet, as the lines of its row: each with its
// amount, where it goes, and the reason of a flag.

import type { Line } from '../../derived/types'
import { formatMod } from '../../dice/dice'

function EffectLine({ line }: { line: Line }) {
  const amount =
    line.amount === undefined || line.status === 'inactive'
      ? ''
      : `${formatMod(line.amount)} `
  return (
    <li className={line.status === 'flag' ? 'text-warning-emphasis' : undefined}>
      <span className="fw-semibold">{line.label}</span>
      {line.source.label && line.source.label !== line.label && (
        <span className="text-body-secondary"> ({line.source.label})</span>
      )}
      {': '}
      {amount}
      {[line.how, line.when].filter(Boolean).join(', ')}
      {line.why && <div className="small">{line.why}</div>}
    </li>
  )
}

export function EffectLines({ lines }: { lines: readonly Line[] }) {
  return (
    <ul className="list-unstyled mb-0">
      {lines.map((line) => (
        <EffectLine key={line.id} line={line} />
      ))}
    </ul>
  )
}
