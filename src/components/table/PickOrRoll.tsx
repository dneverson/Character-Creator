// Taking rows from a die table: click the rows you want, or roll for them. While
// rows are still to be taken the table is open; once they are (or the player has
// written their own instead) it folds to one line saying how many were taken, so a made
// choice takes little space and is one click to change. Like the rest of this
// folder it knows die tables, not what they are for.

import { useState, type ReactNode } from 'react'
import Button from 'react-bootstrap/Button'
import ListGroup from 'react-bootstrap/ListGroup'
import { rollOnTable, type DieTable } from '../../data/dieTables'

export interface PickOrRollProps {
  /** Prefix for the element ids, unique on the page. */
  id: string
  table: DieTable
  /** How many rows to take. */
  count: number
  /** The rows taken (indexes into `table.rows`), in order. */
  chosen: number[]
  /** Whether the player has written text of their own beside, or instead of, the rows. */
  ownText: boolean
  /** The table's name; its title by default. */
  heading?: ReactNode
  /** The rows taken now, with the dice when they were rolled. */
  onChoose: (rows: number[], roll?: { values: number[] }) => void
}

const dieRange = (min: number, max: number) => (min === max ? `${min}` : `${min}-${max}`)

export function PickOrRoll({
  id,
  table,
  count,
  chosen,
  ownText,
  heading,
  onChoose,
}: PickOrRollProps) {
  const [changing, setChanging] = useState(false)
  const wanted = Math.min(count, table.rows.length)
  const open = changing || (chosen.length < wanted && !ownText)
  const titleId = `${id}-title`

  const take = (rows: number[], roll?: { values: number[] }) => {
    // Taking the last row a table asks for closes it.
    if (rows.length >= wanted) setChanging(false)
    onChoose(rows, roll)
  }

  const roll = () => {
    const { values, rows } = rollOnTable(table, wanted - chosen.length, chosen)
    take([...chosen, ...rows], { values })
  }

  // A reroll rolls afresh for every row taken (for all the table asks, when none is).
  const reroll = () => {
    const { values, rows } = rollOnTable(table, chosen.length || wanted, [])
    take(rows, { values })
  }

  const click = (row: number) => {
    if (chosen.includes(row)) onChoose(chosen.filter((r) => r !== row))
    // With one row to take, another click moves it.
    else take(wanted === 1 ? [row] : [...chosen, row])
  }

  const title = (
    <span className="fw-semibold" id={titleId}>
      {heading ?? table.title}
    </span>
  )

  if (!open) {
    const status =
      chosen.length === 0
        ? 'Your own text'
        : `${chosen.length} of ${wanted} from the table`
    return (
      <div className="border rounded px-2 py-1 mb-2">
        <div className="d-flex flex-wrap align-items-center column-gap-2 row-gap-1">
          {title}
          <span className="small text-body-secondary">{status}</span>
          <div className="d-flex gap-2 ms-auto">
            <Button size="sm" variant="secondary" onClick={reroll}>
              Reroll
            </Button>
            <Button size="sm" variant="primary" onClick={() => setChanging(true)}>
              Change
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const full = chosen.length >= wanted
  return (
    <div className="border rounded p-2 mb-2">
      <div className="d-flex flex-wrap align-items-center column-gap-2 row-gap-1 mb-2">
        {title}
        <span className="small text-body-secondary">
          Choose {wanted} or roll - {chosen.length} of {wanted} chosen
        </span>
        <div className="d-flex gap-2 ms-auto">
          <Button size="sm" variant="primary" disabled={full} onClick={roll}>
            Roll d{table.die}
          </Button>
          {changing && (
            <Button size="sm" variant="secondary" onClick={() => setChanging(false)}>
              Done
            </Button>
          )}
        </div>
      </div>
      <ListGroup aria-labelledby={titleId}>
        {table.rows.map((row, index) => {
          const taken = chosen.includes(index)
          return (
            <ListGroup.Item
              key={row.min}
              as="button"
              type="button"
              action
              active={taken}
              aria-pressed={taken}
              // With several rows to take and all taken, one is given back first.
              disabled={!taken && full && wanted > 1}
              className="d-flex gap-2 py-1 small"
              onClick={() => click(index)}
            >
              <span
                className={taken ? '' : 'text-body-secondary'}
                style={{ minWidth: '2.5em' }}
              >
                {dieRange(row.min, row.max)}
              </span>
              <span>{row.text}</span>
            </ListGroup.Item>
          )
        })}
      </ListGroup>
    </div>
  )
}
