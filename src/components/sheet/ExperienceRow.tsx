// The experience row of the play strip. A character levels by milestone until the player
// turns experience tracking on; then the row shows the points, adds the ones earned, and
// says what the next level needs. The Level up switch in the header says when a level is
// waiting (see CharacterHeader). Experience is play state, so none of it changes the build.

import { useState } from 'react'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import type { Character } from '../../character/model'
import { totalLevel } from '../../character/derive'
import { useCharacterPart } from '../../character/useCharacterDoc'
import type { Edition } from '../../data/edition'
import { addXp, trackXp } from '../../play/actions'
import { xpForLevel, xpStanding } from '../../rules/experience'
import { AbbrText } from '../Abbr'
import { Icon } from '../Icon'
import { useApplyPlay } from './usePlay'

const selectLevel = (character: Character) => totalLevel(character)
const selectXp = (character: Character) => character.play.xp

const points = (n: number) => n.toLocaleString('en-US')

export function ExperienceRow({ edition }: { edition: Edition }) {
  const applyPlay = useApplyPlay()
  const level = useCharacterPart(selectLevel) ?? 1
  const xp = useCharacterPart(selectXp)
  const [amount, setAmount] = useState('')
  const gained = Math.max(0, Math.trunc(Number(amount)) || 0)
  const standing = xp === undefined ? undefined : xpStanding(edition, xp, level)

  return (
    <div className="sheet-play__row">
      <Form.Check
        type="switch"
        id="sheet-xp-tracking"
        label={
          <>
            Track experience (<AbbrText text="XP" kind="stat" />)
          </>
        }
        checked={xp !== undefined}
        onChange={() =>
          applyPlay((p) =>
            trackXp(p, xp === undefined ? xpForLevel(edition, level) : null),
          )
        }
      />
      {xp !== undefined && standing && (
        <>
          <span className="sheet-play__group" role="group" aria-label="Experience points">
            <span className="sheet-stat__label">
              <AbbrText text="XP" kind="stat" />
            </span>
            <strong aria-live="polite">{points(xp)}</strong>
            <span className="text-body-secondary">
              {standing.next === null
                ? 'highest level'
                : `next level at ${points(standing.next)}`}
            </span>
          </span>
          <span className="sheet-play__group">
            <Form.Control
              type="number"
              size="sm"
              min={0}
              aria-label="Experience points to add"
              style={{ width: 110 }}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Button
              size="sm"
              variant="primary"
              disabled={gained === 0}
              onClick={() => {
                applyPlay((p) => addXp(p, gained), { type: 'experience', amount: gained })
                setAmount('')
              }}
            >
              <Icon name="add" className="me-1" />
              Add <AbbrText text="XP" kind="stat" />
            </Button>
          </span>
        </>
      )}
    </div>
  )
}
