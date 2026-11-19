// One roll as the sheet shows it, in the roll window and in the log: what was rolled, the
// total large, every die (the ones that did not count struck through, the extra dice of a
// critical and the dice of the bonus labelled), what the modifier is made of, the
// situational bonus and the marks that matter in plain words.

import Badge from 'react-bootstrap/Badge'
import type { CheckRollRecord } from '../../character/model'

const MODE_MARK = { advantage: 'Advantage', disadvantage: 'Disadvantage' } as const

/** The marks of a roll, each with the colour that says whether it helps. */
function marks(record: CheckRollRecord) {
  const found: { text: string; bg: string }[] = []
  if (record.mode !== 'normal') {
    found.push({ text: MODE_MARK[record.mode], bg: 'secondary' })
  }
  if (record.natural === 20) found.push({ text: 'Natural 20', bg: 'success' })
  if (record.natural === 1) found.push({ text: 'Natural 1', bg: 'danger' })
  if (record.critical) found.push({ text: 'Critical damage', bg: 'success' })
  return found
}

const flat = (modifier: number) => `${modifier < 0 ? '-' : '+'} ${Math.abs(modifier)}`
const signed = (amount: number) => `${amount < 0 ? '-' : '+'}${Math.abs(amount)}`

/** The expression that was rolled, as text: "2d8 + 3" or "1d20 - 1". */
function expressionOf(record: CheckRollRecord) {
  const dice = record.dice
    .map((group, at) => {
      const text = `${group.rolls.length}d${group.sides}`
      if (at === 0) return group.sign === -1 ? `-${text}` : text
      return `${group.sign === -1 ? '-' : '+'} ${text}`
    })
    .join(' ')
  return record.modifier === 0 ? dice : `${dice} ${flat(record.modifier)}`
}

/** What a die is called in words, beside its number: "dropped", "bonus". */
function noteOf(
  group: CheckRollRecord['dice'][number],
  at: number,
): 'dropped' | 'extra (critical)' | 'bonus' | null {
  if (group.dropped.includes(at)) return 'dropped'
  if (group.extraFrom !== undefined && at >= group.extraFrom) return 'extra (critical)'
  return group.bonus ? 'bonus' : null
}

/** The whole roll in one sentence for a screen reader: "Rolled 2d8 + 3: 4 and 1, plus 3". */
function spokenOf(record: CheckRollRecord) {
  const faces = record.dice.flatMap((group) =>
    group.rolls.map((die, at) => {
      const note = noteOf(group, at)
      return note ? `${die} (${note})` : `${die}`
    }),
  )
  const list =
    faces.length > 1 ? `${faces.slice(0, -1).join(', ')} and ${faces.at(-1)}` : faces[0]
  const plain =
    record.modifier === 0
      ? ''
      : `, ${record.modifier < 0 ? 'minus' : 'plus'} ${Math.abs(record.modifier)}`
  const bonus = record.bonus ? `, situational bonus ${record.bonus}` : ''
  return `${record.label}: ${record.total}. Rolled ${expressionOf(record)}: ${list}${plain}${bonus}`
}

/** The expression on one line, then every die, then what the modifier is made of. */
function Breakdown({ record }: { record: CheckRollRecord }) {
  return (
    <div className="sheet-roll__breakdown">
      <div className="text-body-secondary">{expressionOf(record)}</div>
      <div className="sheet-roll__faces">
        {record.dice.map((group, at) =>
          group.rolls.map((die, index) => {
            const note = noteOf(group, index)
            return (
              <span
                key={`${at}-${index}`}
                className={`sheet-roll__die${note === 'dropped' ? ' text-body-secondary' : ''}`}
              >
                {group.sign === -1 && '- '}
                <span className="sheet-roll__sides">d{group.sides}</span>{' '}
                {note === 'dropped' ? <s>{die}</s> : die}
                {note && <span className="sheet-roll__note"> {note}</span>}
              </span>
            )
          }),
        )}
        {record.modifier !== 0 && <span>{flat(record.modifier)}</span>}
      </div>
      {record.parts && record.parts.length > 0 && (
        <div className="small text-body-secondary">
          Modifier:{' '}
          {record.parts.map((part) => `${part.label} ${signed(part.amount)}`).join(', ')}
        </div>
      )}
      {record.bonus && (
        <div className="small text-body-secondary">Added: {record.bonus}</div>
      )}
    </div>
  )
}

export function RollResult({ record }: { record: CheckRollRecord }) {
  return (
    <div className="sheet-roll" role="group" aria-label={spokenOf(record)}>
      <div className="d-flex align-items-baseline gap-2 flex-wrap">
        <strong>{record.label}</strong>
        {marks(record).map((mark) => (
          <Badge key={mark.text} bg={mark.bg}>
            {mark.text}
          </Badge>
        ))}
      </div>
      <div className="d-flex align-items-center gap-3">
        <span className="sheet-roll__total" aria-label={`Total ${record.total}`}>
          {record.total}
        </span>
        <Breakdown record={record} />
      </div>
    </div>
  )
}
