// The Dice tab: roll anything by typing it (the roll window opens), the dice as one click each, and the log of
// everything rolled on this sheet, newest first. The log is the character's history.

import { useMemo, useState, type FormEvent } from 'react'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import InputGroup from 'react-bootstrap/InputGroup'
import { checkRolls } from '../../character/rollHistory'
import type { Character } from '../../character/model'
import { useCharacterPart } from '../../character/useCharacterDoc'
import { appConfig } from '../../config/app'
import { RollResult } from './RollResult'
import { useRoller } from './rollerContext'

const selectHistory = (character: Character) => character.history

function FreeRoller() {
  const roller = useRoller()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  if (!roller) return null
  const submit = (event: FormEvent) => {
    event.preventDefault()
    setError(roller.openFree(text))
  }
  return (
    <section aria-label="Free roll" className="mb-3">
      <Form onSubmit={submit} noValidate>
        <InputGroup size="sm" hasValidation>
          <Form.Control
            aria-label="Dice to roll"
            placeholder="2d6+3"
            value={text}
            isInvalid={error !== null}
            onChange={(event) => {
              setText(event.target.value)
              setError(null)
            }}
          />
          <Button type="submit" variant="primary">
            Roll
          </Button>
          <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
        </InputGroup>
      </Form>
      <div className="d-flex flex-wrap gap-2 mt-2" role="group" aria-label="Quick dice">
        {appConfig.dice.quickDice.map((sides) => (
          <Button
            key={sides}
            size="sm"
            variant="secondary"
            aria-label={`Roll a d${sides}`}
            onClick={() => roller.openFree(`1d${sides}`)}
          >
            d{sides}
          </Button>
        ))}
      </div>
    </section>
  )
}

export function DicePanel() {
  const history = useCharacterPart(selectHistory)
  const rolls = useMemo(() => (history ? checkRolls(history).reverse() : []), [history])
  return (
    <div className="sheet-dice">
      <FreeRoller />
      <section aria-label="Roll log">
        <h3 className="h6 mb-2">Roll log</h3>
        {rolls.length === 0 ? (
          <p className="text-body-secondary mb-0">
            Nothing rolled yet. Click a skill, a save, an attack or a stat on the sheet,
            or roll dice above.
          </p>
        ) : (
          <ol className="list-unstyled mb-0 d-flex flex-column gap-2">
            {rolls.map((record) => (
              <li key={record.id} className="sheet-panel p-2">
                <RollResult record={record} />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
