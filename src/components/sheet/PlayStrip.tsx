// The sheet's play strip, under the abilities: inspiration, exhaustion, concentration, the
// conditions, the hit dice and the spell slots. Everything here is the play state; none of it
// changes the build, and none of it blocks (a count is only kept between none and the total).

import Button from 'react-bootstrap/Button'
import ButtonGroup from 'react-bootstrap/ButtonGroup'
import Form from 'react-bootstrap/Form'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'
import type { DerivedSheet } from '../../derived'
import {
  restoreHitDie,
  setConcentration,
  spendHitDie,
  stepExhaustion,
  toggleCondition,
  toggleInspiration,
  MAX_EXHAUSTION,
} from '../../play/actions'
import { PLAY_RULES } from '../../rules/playRules'
import { Icon } from '../Icon'
import { ConditionsDetail, ExhaustionDetail } from './ConditionsDetail'
import { useSheetDetail } from './SheetDetail'
import { RestButtons } from './RestWindows'
import { SlotPips } from './SheetPips'
import { useApplyPlay, usePlay } from './usePlay'

/** A small icon button with its words as its name and its tooltip. */
export function IconButton({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string
  icon: 'add' | 'minus' | 'remove' | 'info'
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <OverlayTrigger placement="top" overlay={<Tooltip>{label}</Tooltip>}>
      <Button
        size="sm"
        variant="secondary"
        className="sheet-icon-btn"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
      >
        <Icon name={icon} />
      </Button>
    </OverlayTrigger>
  )
}

export function PlayStrip({ sheet }: { sheet: DerivedSheet }) {
  const applyPlay = useApplyPlay()
  const detail = useSheetDetail()
  const current = usePlay(sheet)
  if (!current) return null
  const { play, derived } = current
  const edition = sheet.edition
  const inspiration = PLAY_RULES[edition].inspiration

  const openConditions = (name?: string) =>
    detail.toggle({
      id: name ? `conditions:${name}` : 'conditions',
      title: 'Conditions',
      tables: [],
      content: <ConditionsDetail edition={edition} initial={name} />,
    })

  return (
    <section className="sheet-panel sheet-play" aria-label="Play">
      <div className="sheet-play__row">
        <Form.Check
          type="switch"
          id="sheet-inspiration"
          label={inspiration}
          checked={play.inspiration}
          onChange={() => applyPlay(toggleInspiration)}
        />
        <span className="sheet-play__group" role="group" aria-label="Exhaustion">
          <span className="sheet-stat__label">Exhaustion</span>
          <IconButton
            label="Lower exhaustion"
            icon="minus"
            disabled={play.exhaustion === 0}
            onClick={() => applyPlay((p) => stepExhaustion(p, -1))}
          />
          <strong className="sheet-play__level" aria-live="polite">
            {play.exhaustion}
          </strong>
          <IconButton
            label="Raise exhaustion"
            icon="add"
            disabled={play.exhaustion >= MAX_EXHAUSTION}
            onClick={() => applyPlay((p) => stepExhaustion(p, 1))}
          />
          <IconButton
            label="What exhaustion does"
            icon="info"
            onClick={() =>
              detail.toggle({
                id: 'exhaustion',
                title: 'Exhaustion',
                tables: [],
                content: <ExhaustionDetail edition={edition} />,
              })
            }
          />
        </span>
        <RestButtons sheet={sheet} />
        {play.concentration && (
          <span className="sheet-play__group" role="group" aria-label="Concentration">
            <span className="sheet-stat__label">Concentrating</span>
            <strong>{play.concentration.name}</strong>
            <IconButton
              label={`Stop concentrating on ${play.concentration.name}`}
              icon="remove"
              onClick={() => applyPlay((p) => setConcentration(p, null))}
            />
          </span>
        )}
      </div>
      <div className="sheet-play__row">
        <span className="sheet-stat__label">Conditions</span>
        {play.conditions.map((name) => (
          <ButtonGroup key={name} size="sm" aria-label={name}>
            <Button variant="secondary" onClick={() => openConditions(name)}>
              {name}
            </Button>
            <Button
              variant="secondary"
              aria-label={`Remove ${name}`}
              onClick={() => applyPlay((p) => toggleCondition(p, name))}
            >
              <Icon name="remove" />
            </Button>
          </ButtonGroup>
        ))}
        <Button size="sm" variant="primary" onClick={() => openConditions()}>
          <Icon name="add" className="me-1" />
          Condition
        </Button>
      </div>
      <div className="sheet-play__row">
        {derived.hitDice.map((pool) => (
          <span
            key={pool.die}
            className="sheet-play__group"
            role="group"
            aria-label={`${pool.die} hit dice`}
          >
            <span className="sheet-stat__label">Hit dice {pool.die}</span>
            <IconButton
              label={`Spend a ${pool.die} hit die`}
              icon="minus"
              disabled={pool.left === 0}
              onClick={() => applyPlay((p) => spendHitDie(p, pool.die, pool.total))}
            />
            <strong>
              {pool.left}/{pool.total}
            </strong>
            <IconButton
              label={`Regain a ${pool.die} hit die`}
              icon="add"
              disabled={pool.spent === 0}
              onClick={() => applyPlay((p) => restoreHitDie(p, pool.die, pool.total))}
            />
          </span>
        ))}
        <SlotPips sheet={sheet} />
      </div>
    </section>
  )
}
