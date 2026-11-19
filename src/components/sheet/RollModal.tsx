// The roll window: one window for every roll of the sheet. It shows how the number adds up,
// asks for the mode (a d20 only) and a situational bonus, rolls, tumbles the dice and lands
// them on the result, with the full breakdown. The result is computed and recorded before
// the dice move; the dice only show it. The "Dice" button swaps the window's content for
// the customizer.

import { useEffect, useMemo, useRef, useState } from 'react'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import Modal from 'react-bootstrap/Modal'
import ToggleButton from 'react-bootstrap/ToggleButton'
import ToggleButtonGroup from 'react-bootstrap/ToggleButtonGroup'
import type { CheckRollRecord } from '../../character/model'
import { appConfig } from '../../config/app'
import type { DiceLook } from '../../config/diceLooks'
import {
  RollParseError,
  parseBonus,
  parseExpression,
  type RollMode,
  type Term,
} from '../../dice/roll'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { DiceCustomizer } from '../dice/DiceCustomizer'
import {
  DiceTray,
  type TrayDie,
  type TrayPhase,
  type TraySection,
} from '../dice/DiceTray'
import { DerivedTable } from '../editor/DerivedTable'
import type { Perform } from './Roller'
import { RollResult } from './RollResult'
import type { RollSpec } from './rollSpec'
import type { BreakdownTable } from './SheetDetail'

const MODES: { mode: RollMode; label: string }[] = [
  { mode: 'disadvantage', label: 'Disadvantage' },
  { mode: 'normal', label: 'Normal' },
  { mode: 'advantage', label: 'Advantage' },
]

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

/** The terms of a typed bonus, or what is wrong with it. */
function bonusOf(text: string): { terms: Term[]; error: string | null } {
  try {
    return { terms: parseBonus(text), error: null }
  } catch (error) {
    if (error instanceof RollParseError) return { terms: [], error: error.message }
    throw error
  }
}

/** The dice an expression's terms roll, before they are rolled. */
function planOf(terms: readonly Term[], prefix: string, tag?: 'bonus'): TrayDie[] {
  return terms.flatMap((term, at) =>
    term.kind === 'dice'
      ? Array.from({ length: term.count }, (_, die) => ({
          key: `${prefix}-${at}-${die}`,
          sides: term.sides,
          ...(tag && { tag }),
        }))
      : [],
  )
}

/** The dice a record rolled, as the tray shows them landed. */
function landedOf(record: CheckRollRecord, prefix: string): TrayDie[] {
  return record.dice.flatMap((group, at) =>
    group.rolls.map((value, die) => ({
      key: `${prefix}-${at}-${die}`,
      sides: group.sides,
      value,
      ...(group.dropped.includes(die) && { dropped: true }),
      ...(group.extraFrom !== undefined && die >= group.extraFrom
        ? { tag: 'extra' as const }
        : group.bonus && { tag: 'bonus' as const }),
    })),
  )
}

function HowItAddsUp({ tables }: { tables: BreakdownTable[] }) {
  if (tables.length === 0) return null
  return (
    <section aria-label="How it adds up" className="roll-modal__how">
      <h3 className="h6">How it adds up</h3>
      <div className="d-flex flex-column gap-3">
        {tables.map((table) => (
          <DerivedTable key={table.ariaLabel} {...table} aligned />
        ))}
      </div>
    </section>
  )
}

function BonusField({
  id,
  label,
  placeholder,
  value,
  error,
  onChange,
}: {
  id: string
  label: string
  placeholder: string
  value: string
  error: string | null
  onChange: (text: string) => void
}) {
  return (
    <Form.Group controlId={id}>
      <Form.Label>{label}</Form.Label>
      <Form.Control
        value={value}
        placeholder={placeholder}
        isInvalid={error !== null}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      />
      <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
    </Form.Group>
  )
}

/** A roll shown in the result area: which half of an attack it is, and the record. */
interface Shown {
  kind: 'hit' | 'damage'
  record: CheckRollRecord
}

function ModeField({
  mode,
  onChange,
  small,
}: {
  mode: RollMode
  onChange: (mode: RollMode) => void
  small: boolean
}) {
  return (
    <div>
      <div className="form-label" id="roll-mode-label">
        Mode
      </div>
      <ToggleButtonGroup
        type="radio"
        name="roll-mode"
        value={mode}
        onChange={onChange}
        aria-labelledby="roll-mode-label"
        className="w-100"
        size={small ? 'sm' : undefined}
      >
        {MODES.map((entry) => (
          <ToggleButton
            key={entry.mode}
            id={`roll-mode-${entry.mode}`}
            value={entry.mode}
            variant={mode === entry.mode ? 'primary' : 'secondary'}
          >
            {entry.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  )
}

function RollSession({
  spec,
  perform,
  look,
}: {
  spec: RollSpec
  perform: Perform
  look: DiceLook
}) {
  const reducedMotion = useMediaQuery(REDUCED_MOTION)
  const d20 = spec.kind === 'test' || spec.d20 !== undefined
  const attack = spec.damage !== undefined
  const [mode, setMode] = useState<RollMode>('normal')
  const [bonusText, setBonusText] = useState('')
  const [damageText, setDamageText] = useState('')
  // The rolls of this window, the one rolled last first; an attack keeps its to-hit and
  // its damage, each replaced when it is rolled again.
  const [shown, setShown] = useState<Shown[]>([])
  // The next damage roll is a critical: a natural 20 turns it on, rolling damage turns it off.
  const [critical, setCritical] = useState(false)
  const [phase, setPhase] = useState<TrayPhase>('idle')
  const bonus = bonusOf(bonusText)
  const extra = bonusOf(damageText)
  const invalid = bonus.error !== null || extra.error !== null

  // The dice and the result are lower in the window than the roll buttons on a narrow screen.
  const tray = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (phase !== 'idle') tray.current?.scrollIntoView({ block: 'nearest' })
  }, [phase])

  useEffect(() => {
    if (phase !== 'rolling') return
    const timer = setTimeout(() => setPhase('landed'), appConfig.dice.animationMs)
    return () => clearTimeout(timer)
  }, [phase, shown])

  const roll = (part: 'roll' | 'damage' | 'critical') => {
    const [record] = perform(spec, {
      part,
      mode: d20 ? mode : 'normal',
      bonus: bonus.terms,
      damageBonus: extra.terms,
    })
    const kind = part === 'roll' ? 'hit' : 'damage'
    setShown((prev) => [{ kind, record }, ...prev.filter((entry) => entry.kind !== kind)])
    setCritical(kind === 'hit' && record.natural === 20)
    setPhase(reducedMotion ? 'landed' : 'rolling')
  }

  const sections = useMemo<TraySection[]>(() => {
    if (phase !== 'idle') {
      const [last] = shown
      return [
        {
          title: last.kind === 'damage' ? 'Damage' : 'To hit',
          dice: landedOf(last.record, `r-${last.kind}`),
        },
      ]
    }
    const main: TrayDie[] = d20
      ? [
          { key: 'd20-0', sides: 20 },
          ...(mode === 'normal' ? [] : [{ key: 'd20-1', sides: 20 }]),
        ]
      : planOf(parseExpression(spec.expression ?? ''), 'free')
    const planned: TraySection[] = [
      { title: 'To hit', dice: [...main, ...planOf(bonus.terms, 'bonus', 'bonus')] },
    ]
    if (spec.damage) {
      planned.push({
        title: 'Damage',
        dice: [
          ...planOf(parseExpression(spec.damage.expression), 'damage'),
          ...planOf(extra.terms, 'extra-damage', 'bonus'),
        ],
      })
    }
    return planned
  }, [phase, shown, spec, d20, mode, bonus.terms, extra.terms])

  const rolling = phase === 'rolling'
  const tables = [...spec.tables, ...(spec.damage?.tables ?? [])]
  const hitField = (
    <BonusField
      id="roll-bonus"
      label="Situational bonus"
      placeholder="+2, -1 or +1d4"
      value={bonusText}
      error={bonus.error}
      onChange={setBonusText}
    />
  )
  return (
    <div
      className={`roll-modal__grid${tables.length > 0 ? ' roll-modal__grid--two' : ''}`}
    >
      <HowItAddsUp tables={tables} />
      <div className="d-flex flex-column gap-3">
        {attack ? (
          <div className="d-flex flex-wrap gap-3">
            <fieldset className="roll-modal__action d-flex flex-column gap-2">
              <legend className="h6">To hit</legend>
              {d20 && <ModeField mode={mode} onChange={setMode} small />}
              {hitField}
              <Button
                variant="primary"
                className="mt-auto"
                disabled={invalid || rolling}
                onClick={() => roll('roll')}
                autoFocus
              >
                Roll to hit
              </Button>
            </fieldset>
            <fieldset className="roll-modal__action d-flex flex-column gap-2">
              <legend className="h6">Damage</legend>
              <BonusField
                id="roll-damage-bonus"
                label="Extra damage"
                placeholder="+1d6"
                value={damageText}
                error={extra.error}
                onChange={setDamageText}
              />
              <Form.Check
                type="switch"
                role="switch"
                id="roll-critical"
                label="Critical"
                checked={critical}
                onChange={(event) => setCritical(event.target.checked)}
              />
              <Button
                variant="primary"
                className="mt-auto"
                disabled={invalid || rolling}
                onClick={() => roll(critical ? 'critical' : 'damage')}
              >
                {critical ? 'Roll critical damage' : 'Roll damage'}
              </Button>
            </fieldset>
          </div>
        ) : (
          <>
            {d20 && <ModeField mode={mode} onChange={setMode} small={false} />}
            {hitField}
            <Button
              variant="primary"
              disabled={invalid || rolling}
              onClick={() => roll('roll')}
              autoFocus
            >
              {phase === 'idle' ? 'Roll' : 'Roll again'}
            </Button>
          </>
        )}
        <div ref={tray}>
          <DiceTray
            sections={sections}
            look={look}
            phase={phase}
            reducedMotion={reducedMotion}
          />
        </div>
        <div role="status" className="d-flex flex-column gap-2">
          {shown.map(
            (entry, at) =>
              !(rolling && at === 0) && (
                <RollResult key={entry.record.id} record={entry.record} />
              ),
          )}
        </div>
      </div>
    </div>
  )
}

export function RollModal({
  spec,
  show,
  onHide,
  perform,
  look,
  setLook,
  resetLook,
}: {
  spec: RollSpec
  show: boolean
  onHide: () => void
  perform: Perform
  look: DiceLook
  setLook: (look: DiceLook) => void
  resetLook: () => void
}) {
  const [onDice, setOnDice] = useState(false)
  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      scrollable
      size="lg"
      fullscreen="sm-down"
      dialogClassName={`roll-modal ${spec.tables.length > 0 ? 'modal-xl' : 'modal-lg'}`}
      aria-labelledby="roll-modal-title"
    >
      <Modal.Header closeButton>
        <Modal.Title id="roll-modal-title" as="h2" className="h5">
          {onDice ? 'Dice' : spec.label}
        </Modal.Title>
        <Button
          variant="secondary"
          size="sm"
          className="ms-auto"
          aria-pressed={onDice}
          onClick={() => setOnDice(!onDice)}
        >
          {onDice ? 'Back to the roll' : 'Dice'}
        </Button>
      </Modal.Header>
      <Modal.Body>
        {onDice && <DiceCustomizer look={look} onChange={setLook} onReset={resetLook} />}
        <div hidden={onDice}>
          <RollSession spec={spec} perform={perform} look={look} />
        </div>
      </Modal.Body>
    </Modal>
  )
}
