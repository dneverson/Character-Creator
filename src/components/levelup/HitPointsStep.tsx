import { useState } from 'react'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import { averageDie } from '../../character/hp'
import { setLevelRoll, type NewLevelDie } from '../../character/levelUp'
import type { LevelHitDie } from '../../character/model'
import { useCharacter, useUpdateCharacter } from '../../character/useCharacterDoc'
import { formatMod, randomInt } from '../../dice/dice'
import type { Quantity } from '../../derived/types'
import { DerivedTable } from '../editor/DerivedTable'
import { Icon } from '../Icon'
import { hpGain } from './levelUpSummary'
import { StepCard } from './StepCard'

interface Props {
  before: Quantity
  after: Quantity
  die: NewLevelDie | undefined
  /** How the new level's hit die was settled; null while it holds the average. */
  pick: LevelHitDie | null
  onPick: (pick: LevelHitDie) => void
}

const BY_WORD: Record<LevelHitDie['by'], string> = {
  rolled: 'rolled',
  entered: 'your roll',
  average: 'the average',
}

/**
 * The hit points the level adds, line by line. A character that rolls its hit points rolls
 * the new die here, enters a roll made at the table, or takes the average; one that takes
 * the average has nothing to choose.
 */
export function HitPointsStep({ before, after, die, pick, onPick }: Props) {
  const character = useCharacter()
  const update = useUpdateCharacter()
  const [entered, setEntered] = useState('')
  if (!character) return null
  const gain = hpGain(before, after)

  const settle = (value: number, by: LevelHitDie['by']) => {
    if (!die) return
    const rolls = setLevelRoll(character.hp.rolls, die, value)
    update({ hp: { ...character.hp, rolls } })
    onPick({ die: `d${die.faces}`, value: rolls[die.index], by })
  }
  const rolledValue = die?.rolled ? character.hp.rolls[die.index] : undefined
  const average = die ? averageDie(die.faces) : 0
  const rolling = !!die?.rolled

  return (
    <StepCard
      title="Hit points"
      subtitle={`${formatMod(gain.value)} hit points${
        rolling && rolledValue !== undefined
          ? `: d${die.faces} ${pick ? BY_WORD[pick.by] : 'average'} ${rolledValue}`
          : ''
      }`}
      done={rolling ? pick !== null : undefined}
      openText="roll the hit die, enter your roll or take the average"
      collapseOn={pick ? `${pick.by}:${pick.value}` : undefined}
    >
      {rolling && die && (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
          <Button
            size="sm"
            onClick={() => settle(randomInt(1, die.faces), 'rolled')}
            aria-label={`Roll a d${die.faces}`}
          >
            <Icon name="roll" className="me-1" />
            Roll d{die.faces}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => settle(average, 'average')}
          >
            Take the average ({average})
          </Button>
          <Form.Label htmlFor="levelup-hp-roll" className="mb-0 small">
            Enter my roll (1 to {die.faces})
          </Form.Label>
          <Form.Control
            id="levelup-hp-roll"
            type="number"
            size="sm"
            min={1}
            max={die.faces}
            value={entered}
            style={{ width: '5rem' }}
            onChange={(e) => {
              setEntered(e.target.value)
              const value = Number(e.target.value)
              if (Number.isInteger(value) && value >= 1 && value <= die.faces) {
                settle(value, 'entered')
              }
            }}
          />
        </div>
      )}
      {!rolling && (
        <div className="small text-body-secondary mb-2">
          {die
            ? `Your character takes the average of each hit die (${average} for a d${die.faces}). To roll instead, choose rolled hit points in Edit, under Hit Points.`
            : 'This class has no hit die in the data, so the level adds no hit points from dice.'}
        </div>
      )}
      <DerivedTable
        quantity={gain}
        ariaLabel="Hit points gained"
        amountHeader="Hit points"
        totalLabel="Hit points gained"
        format={formatMod}
      />
    </StepCard>
  )
}
