// The short rest and long rest windows of the sheet. What each rest does is read from the
// rules table of the edition (restRules.ts), so the window lists the same effects that
// confirming applies. Nothing here blocks: a warning is shown, and the player can go on.

import { useState } from 'react'
import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import Modal from 'react-bootstrap/Modal'
import type { HitDieSpend } from '../../character/model'
import type { DerivedSheet } from '../../derived'
import { BASE_SOURCE, quantity, type Line } from '../../derived/types'
import { abilityMod, formatMod, randomInt } from '../../dice/dice'
import type { HitDicePool } from '../../play/derivePlay'
import {
  applyRest,
  hitDieHp,
  rechargesOf,
  regainedDice,
  restEffectsFor,
  restoredUses,
  restWarning,
} from '../../play/rest'
import { REST_RULES, type RestEffect, type RestKind } from '../../rules/restRules'
import { DerivedTable } from '../editor/DerivedTable'
import { DraftInput } from '../editor/DraftInput'
import { Icon } from '../Icon'
import { useApplyPlay, usePlay } from './usePlay'

const TITLES: Record<RestKind, string> = { short: 'Short rest', long: 'Long rest' }

/** The effects of the rest as a list, the ones the window handles on its own left out. */
function EffectList({
  effects,
  skip = [],
}: {
  effects: readonly RestEffect[]
  skip?: readonly RestEffect['kind'][]
}) {
  const shown = effects.filter((e) => e.kind !== 'requiresHp' && !skip.includes(e.kind))
  return (
    <ul className="mb-2" aria-label="What this rest does">
      {shown.map((e) => (
        <li key={e.kind}>
          {e.text} <span className="small text-body-secondary">({e.ruleRef})</span>
        </li>
      ))}
    </ul>
  )
}

/** The limited uses this rest gives back, by counter, worked out as confirming applies them. */
function RestoredUses({ sheet, kind }: { sheet: DerivedSheet; kind: RestKind }) {
  const current = usePlay(sheet)
  if (!current || sheet.resources.length === 0) return null
  const restored = restoredUses(kind, rechargesOf(sheet.resources, current.derived.uses))
  return (
    <p className="mb-0">
      Uses regained now:{' '}
      {restored.length === 0
        ? 'none (none are spent that this rest restores)'
        : restored.map((r) => `${r.label} (${r.regained})`).join(', ')}
      .
    </p>
  )
}

function Warning({ text }: { text: string | undefined }) {
  if (!text) return null
  return (
    <Alert variant="warning" className="py-2 d-flex gap-2 align-items-center">
      <Icon name="warning" />
      <span>{text}. You can rest anyway.</span>
    </Alert>
  )
}

/** One line of the table of hit dice spent: the die, its roll, the Constitution modifier. */
function spendLine(spend: HitDieSpend, index: number, conMod: number, minimum: number) {
  const raw = spend.roll + conMod
  const how = [
    `rolled ${spend.roll}`,
    `Constitution ${formatMod(conMod)}`,
    ...(raw < minimum ? [`at least ${minimum}`] : []),
  ].join(', ')
  return {
    id: `rest|spend|${index}`,
    label: `Hit die ${spend.die}`,
    source: BASE_SOURCE,
    op: 'add',
    status: 'applied',
    amount: spend.hp,
    how,
  } satisfies Line
}

function ShortRestBody({
  sheet,
  spends,
  setSpends,
}: {
  sheet: DerivedSheet
  spends: HitDieSpend[]
  setSpends: (next: HitDieSpend[]) => void
}) {
  const current = usePlay(sheet)
  const [entered, setEntered] = useState<Record<string, string>>({})
  if (!current) return null
  const rules = REST_RULES[sheet.edition].short
  const spendRule = rules.find((e) => e.kind === 'spendHitDice')
  const minimum = spendRule?.kind === 'spendHitDice' ? spendRule.minimumPerDie : 0
  const conMod = abilityMod(sheet.abilities.con.value)
  const left = (pool: HitDicePool) =>
    pool.left - spends.filter((s) => s.die === pool.die).length
  const spend = (pool: HitDicePool, roll: number) =>
    setSpends([...spends, { die: pool.die, roll, hp: hitDieHp(roll, conMod, minimum) }])
  const lines = spends.map((s, i) => spendLine(s, i, conMod, minimum))
  return (
    <>
      <Warning text={restWarning(rules, current.derived.currentHp.value)} />
      <EffectList effects={restEffectsFor(rules, sheet.slots)} skip={['spendHitDice']} />
      <RestoredUses sheet={sheet} kind="short" />
      <p className="mb-1">
        Spend hit dice for hit points. Roll one, or enter the number you rolled.
      </p>
      <ul className="list-unstyled d-flex flex-column gap-1" aria-label="Hit dice">
        {current.derived.hitDice.map((pool) => {
          const roll = Number.parseInt(entered[pool.die] ?? '', 10)
          const valid = Number.isInteger(roll) && roll >= 1 && roll <= pool.faces
          return (
            <li key={pool.die} className="d-flex align-items-center gap-2 flex-wrap">
              <strong>{pool.die}</strong>
              <span>{left(pool)} left</span>
              <Button
                size="sm"
                variant="primary"
                disabled={left(pool) <= 0}
                aria-label={`Roll a ${pool.die} hit die`}
                onClick={() => spend(pool, randomInt(1, pool.faces))}
              >
                <Icon name="roll" className="me-1" />
                Roll
              </Button>
              <DraftInput
                type="number"
                min={1}
                max={pool.faces}
                size="sm"
                className="sheet-rest__roll"
                aria-label={`My ${pool.die} roll`}
                placeholder="My roll"
                value={entered[pool.die] ?? ''}
                onCommit={(text) => setEntered({ ...entered, [pool.die]: text })}
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={!valid || left(pool) <= 0}
                aria-label={`Spend a ${pool.die} hit die with my roll`}
                onClick={() => {
                  spend(pool, roll)
                  setEntered({ ...entered, [pool.die]: '' })
                }}
              >
                Use my roll
              </Button>
            </li>
          )
        })}
      </ul>
      {lines.length > 0 && (
        <>
          <DerivedTable
            quantity={quantity(lines)}
            ariaLabel="Hit points from hit dice"
            amountHeader="Hit points"
            totalLabel="Hit points regained"
          />
          <Button
            size="sm"
            variant="secondary"
            className="mt-2"
            onClick={() => setSpends([])}
          >
            Clear the dice
          </Button>
        </>
      )}
    </>
  )
}

function LongRestBody({ sheet }: { sheet: DerivedSheet }) {
  const current = usePlay(sheet)
  if (!current) return null
  const rules = REST_RULES[sheet.edition].long
  const dice = rules.find((e) => e.kind === 'regainHitDice')
  const back =
    dice?.kind === 'regainHitDice'
      ? regainedDice(current.derived.hitDice, dice.portion, dice.minimum)
      : {}
  const regained = Object.entries(back)
    .map(([die, n]) => `${n} ${die}`)
    .join(', ')
  return (
    <>
      <Warning text={restWarning(rules, current.derived.currentHp.value)} />
      <EffectList effects={restEffectsFor(rules, sheet.slots)} />
      <p className="mb-0">
        Hit dice regained now: {regained === '' ? 'none (none are spent)' : regained}.
      </p>
      <RestoredUses sheet={sheet} kind="long" />
    </>
  )
}

function RestWindow({
  sheet,
  kind,
  show,
  onHide,
}: {
  sheet: DerivedSheet
  kind: RestKind
  show: boolean
  onHide: () => void
}) {
  const [spends, setSpends] = useState<HitDieSpend[]>([])
  const applyPlay = useApplyPlay()
  const current = usePlay(sheet)
  const confirm = () => {
    if (!current) return
    const rules = REST_RULES[sheet.edition][kind]
    const uses = rechargesOf(sheet.resources, current.derived.uses)
    const restored = rules.some((e) => e.kind === 'rechargeUses')
      ? restoredUses(kind, uses)
      : []
    applyPlay(
      (play) =>
        applyRest(play, rules, {
          maxHp: current.derived.maxHp,
          hitDice: current.derived.hitDice,
          spends,
          uses,
        }),
      {
        type: 'rest',
        rest: kind,
        ...(kind === 'short' ? { rolls: spends } : {}),
        ...(restored.length > 0 ? { restored } : {}),
      },
    )
    onHide()
  }
  return (
    <Modal show={show} onHide={onHide} onExited={() => setSpends([])} centered>
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          {TITLES[kind]}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {kind === 'short' ? (
          <ShortRestBody sheet={sheet} spends={spends} setSpends={setSpends} />
        ) : (
          <LongRestBody sheet={sheet} />
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="primary" onClick={confirm}>
          Confirm {TITLES[kind].toLowerCase()}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

/** The Short rest and Long rest buttons, each opening its window. */
export function RestButtons({ sheet }: { sheet: DerivedSheet }) {
  const [open, setOpen] = useState<RestKind | null>(null)
  return (
    <span className="sheet-play__group" role="group" aria-label="Rests">
      {(['short', 'long'] as const).map((kind) => (
        <Button key={kind} size="sm" variant="primary" onClick={() => setOpen(kind)}>
          {TITLES[kind]}
        </Button>
      ))}
      {(['short', 'long'] as const).map((kind) => (
        <RestWindow
          key={kind}
          sheet={sheet}
          kind={kind}
          show={open === kind}
          onHide={() => setOpen(null)}
        />
      ))}
    </span>
  )
}
