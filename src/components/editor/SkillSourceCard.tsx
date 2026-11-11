// One source of skill picks (class, background, race, a feat): the whole list it
// allows as toggle chips and how many picks are left, so nothing needs a book. A
// card with all its picks collapses to one line; Change reopens it.

import { useState } from 'react'
import Badge from 'react-bootstrap/Badge'
import Button from 'react-bootstrap/Button'
import { formatMod } from '../../dice/dice'
import { skillLabel } from '../../data/skills'
import type { SkillCard, SkillChip } from '../../character/skills'
import { NonStandardBadge } from '../NonStandardBadge'
import { ToggleChip } from './ToggleChip'

interface Props {
  card: SkillCard
  onPick: (skill: string) => void
}

/** Why a chip cannot be clicked, in plain words (RAW: pick another). */
function whyDisabled(chip: SkillChip, card: SkillCard): string | undefined {
  if (chip.state === 'taken')
    return `Already proficient from ${chip.takenBy}. Pick another.`
  if (chip.state === 'full') {
    return `${card.name}'s ${card.count} skills are chosen. Remove one, or use Other skills below.`
  }
  return undefined
}

export function SkillSourceCard({ card, onPick }: Props) {
  const [changing, setChanging] = useState(false)
  const full = card.left === 0
  const open = !full || card.over || changing

  const heading = card.label.replace(' · ', ' - ')

  if (!open) {
    return (
      <div className="border rounded px-3 py-2 d-flex flex-wrap align-items-center gap-2">
        <span className="flex-grow-1">
          <strong>{card.name}:</strong> {card.picks.map(skillLabel).join(', ')}
        </span>
        <Badge bg="secondary">
          {card.used} of {card.count} done
        </Badge>
        <Button size="sm" variant="primary" onClick={() => setChanging(true)}>
          Change
        </Button>
      </div>
    )
  }

  const labelId = `skill-card-${card.tag}`
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
              reason={`More skills are chosen from ${card.name} than it grants (${card.used} of ${card.count}).`}
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
      <div className="d-flex flex-wrap gap-1" role="group" aria-labelledby={labelId}>
        {card.chips.map((chip) => (
          <ToggleChip
            key={chip.skill}
            pressed={chip.state === 'picked'}
            disabled={chip.state === 'taken' || chip.state === 'full'}
            title={whyDisabled(chip, card)}
            onClick={() => onPick(chip.skill)}
          >
            {chip.label} <span className="opacity-75">{formatMod(chip.modifier)}</span>
          </ToggleChip>
        ))}
      </div>
    </div>
  )
}
