// One source of picks (a class, background, race or feat, of skills, tools, languages
// and the rest): the whole list it allows as toggle chips and how many picks are left,
// so nothing needs a book. A card with all its picks collapses to one line; Change
// reopens it.

import { useMemo, useState } from 'react'
import Badge from 'react-bootstrap/Badge'
import Button from 'react-bootstrap/Button'
import type {
  PickCard as PickCardModel,
  PickChip,
  PickChipDetail,
} from '../../character/picks'
import { Entries } from '../../text/Entries'
import { NonStandardBadge } from '../NonStandardBadge'
import { PickChoiceTable } from './PickChoiceTable'
import { ToggleChip } from './ToggleChip'

interface Props {
  card: PickCardModel
  onPick: (chip: PickChip) => void
  /** What an option is, from the data, for options whose chips carry no description. */
  detailOf?: (chip: PickChip) => PickChipDetail | undefined
}

/** Why a chip cannot be clicked, in plain words (RAW: pick another). */
function whyDisabled(chip: PickChip, card: PickCardModel): string | undefined {
  if (chip.state === 'taken')
    return `Already proficient from ${chip.takenBy}. Pick another.`
  if (chip.state === 'full') {
    if (card.kinds[0] === 'option' || card.kinds[0] === 'expertise') {
      return `${card.name}: all ${card.count} are chosen. Remove one to pick another.`
    }
    const other = card.kinds[0] === 'skill' ? 'Other skills' : 'Other (DM approval)'
    return `${card.name}'s ${card.count} ${card.noun} are chosen. Remove one, or use ${other} below.`
  }
  return undefined
}

export function PickCard({ card: given, onPick, detailOf }: Props) {
  const card = useMemo(
    () =>
      detailOf
        ? {
            ...given,
            chips: given.chips.map((chip) =>
              chip.detail ? chip : { ...chip, detail: detailOf(chip) },
            ),
          }
        : given,
    [given, detailOf],
  )
  const [changing, setChanging] = useState(false)
  const [detailed, setDetailed] = useState(false)
  const described = card.chips.some((c) => c.detail !== undefined)
  const full = card.left === 0
  const open = !full || card.over || changing

  const heading = card.label.replace(' · ', ' - ')

  if (!open) {
    return (
      <div className="border rounded px-3 py-2 d-flex flex-wrap align-items-center gap-2">
        <span className="flex-grow-1">
          <strong>{card.name}:</strong>{' '}
          {card.picks
            .map((p) => card.chips.find((c) => c.value === p)?.label ?? p)
            .join(', ')}
        </span>
        <Badge bg="secondary">
          {card.used} of {card.count} done
        </Badge>
        {described && (
          <Button
            size="sm"
            variant="secondary"
            aria-expanded={detailed}
            onClick={() => setDetailed((shown) => !shown)}
          >
            {detailed ? 'Hide details' : 'Show details'}
          </Button>
        )}
        <Button size="sm" variant="primary" onClick={() => setChanging(true)}>
          Change
        </Button>
        {detailed &&
          card.chips
            .filter((c) => c.state === 'picked' && c.detail)
            .map((c) => (
              <div className="w-100 small" key={c.value}>
                <strong>{c.label}</strong>
                {c.detail?.facts.map((f) => (
                  <div key={f.label}>
                    {f.label}: {f.value}
                  </div>
                ))}
                <Entries entries={c.detail?.entries ?? []} />
              </div>
            ))}
      </div>
    )
  }

  const labelId = `pick-card-${card.tag}-${card.kinds.join('-')}`
  return (
    <div className="border rounded p-3">
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <strong id={labelId}>{heading}</strong>
        {card.over ? (
          <>
            <Badge bg="warning" text="dark">
              {card.used} of {card.count}: {card.used - card.count} too many
            </Badge>
            <NonStandardBadge
              reason={`More ${card.noun} are chosen from ${card.name} than it grants (${card.used} of ${card.count}).`}
            />
          </>
        ) : (
          <Badge bg={full ? 'secondary' : 'primary'}>
            {full
              ? `${card.used} of ${card.count} done`
              : `${card.left} of ${card.count} left`}
          </Badge>
        )}
        {changing && full && (
          <Button
            size="sm"
            variant="primary"
            className="ms-auto"
            onClick={() => setChanging(false)}
          >
            Done
          </Button>
        )}
      </div>
      {card.note && <div className="small text-body-secondary mb-2">{card.note}</div>}
      {described ? (
        <PickChoiceTable
          tableId={`pick-card-${card.kinds.join('-')}`}
          noun={card.noun}
          chips={card.chips}
          whyDisabled={(chip) => whyDisabled(chip, card)}
          onPick={onPick}
        />
      ) : (
        <div className="d-flex flex-wrap gap-1" role="group" aria-labelledby={labelId}>
          {card.chips.map((chip) => (
            <ToggleChip
              key={chip.value}
              pressed={chip.state === 'picked'}
              disabled={chip.state === 'taken' || chip.state === 'full'}
              title={whyDisabled(chip, card)}
              onClick={() => onPick(chip)}
            >
              {chip.label}
              {chip.hint && <span className="opacity-75"> {chip.hint}</span>}
            </ToggleChip>
          ))}
        </div>
      )}
    </div>
  )
}
