// The one table every derived number is shown in: each line with where it comes from,
// how it adds up and its amount, and the total under them. Hit points, armor class and
// every number after them use it, so a player reads each the same way and never needs
// a book to see how a number came about.

import { Fragment, type ReactElement, type ReactNode } from 'react'
import Badge from 'react-bootstrap/Badge'
import Table from 'react-bootstrap/Table'
import { formatMod } from '../../dice/dice'
import type { Line, Quantity } from '../../derived/types'

interface Props {
  quantity: Quantity
  ariaLabel: string
  /** The heading of the amount column: "Hit points", "Armor class". */
  amountHeader: ReactNode
  /** The words of the total row: "Maximum hit points (average)". */
  totalLabel: ReactNode
  /** Replaces the row of a line (a manual line is an input); undefined keeps it. */
  renderRow?: (line: Line) => ReactElement | undefined
  /** How the total reads; a bonus reads with its sign. Defaults to the plain number. */
  format?: (value: number) => string
}

/** A base amount reads as it is, an added one with its sign. */
function amountText(line: Line): string {
  if (line.amount === undefined) return ''
  return line.op === 'add' ? formatMod(line.amount) : String(line.amount)
}

const ROW_CLASS: Partial<Record<Line['status'], string>> = {
  inactive: 'text-body-secondary',
  conditional: 'text-body-secondary',
  flag: 'table-warning',
}

function LineRow({ line }: { line: Line }) {
  const showSource =
    line.source.kind !== 'base' &&
    line.source.label !== '' &&
    line.source.label !== line.label
  const how = [line.how, line.when].filter(Boolean).join(', ')
  return (
    <tr title={line.text} className={ROW_CLASS[line.status]}>
      <td colSpan={how ? 1 : 2}>
        {line.label}
        {showSource && (
          <>
            {' '}
            <span className="text-body-secondary">({line.source.label})</span>
          </>
        )}
        {line.badge && (
          <>
            {' '}
            <Badge bg="secondary">{line.badge}</Badge>
          </>
        )}
        {line.why && <div className="small">{line.why}</div>}
      </td>
      {how && <td>{how}</td>}
      <td className="text-end">{amountText(line)}</td>
    </tr>
  )
}

export function DerivedTable({
  quantity,
  ariaLabel,
  amountHeader,
  totalLabel,
  renderRow,
  format = String,
}: Props) {
  return (
    <Table size="sm" className="mb-0 align-middle" aria-label={ariaLabel}>
      <thead>
        <tr>
          <th>Source</th>
          <th>How it adds up</th>
          <th className="text-end">{amountHeader}</th>
        </tr>
      </thead>
      <tbody>
        {quantity.lines.map((line) => {
          const custom = renderRow?.(line)
          return custom ? (
            <Fragment key={line.id}>{custom}</Fragment>
          ) : (
            <LineRow key={line.id} line={line} />
          )
        })}
      </tbody>
      <tfoot>
        <tr className="fw-bold">
          <td colSpan={2}>{totalLabel}</td>
          <td className="text-end">{format(quantity.value)}</td>
        </tr>
      </tfoot>
    </Table>
  )
}
