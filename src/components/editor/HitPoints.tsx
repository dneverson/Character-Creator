import { useId, useState, type ReactElement } from 'react'
import Alert from 'react-bootstrap/Alert'
import Badge from 'react-bootstrap/Badge'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import Spinner from 'react-bootstrap/Spinner'
import Table from 'react-bootstrap/Table'
import { formatMod } from '../../dice/dice'
import { useActiveCharacter, useCharacterStore } from '../../character/store'
import {
  hitDiceGroups,
  hpBreakdown,
  levelDice,
  rollHitDice,
  type HpDiceLine,
} from '../../character/hp'
import { type HpState, type RollRecord } from '../../character/model'
import { newRoll, rollAction, rollRecords, withCursor } from '../../character/rollHistory'
import { EditorSection } from './EditorSection'
import { RollHistoryControls } from './RollHistoryControls'
import { useFeatSummary } from './useFeatSummary'

export function HitPoints() {
  const character = useActiveCharacter()
  const updateActive = useCharacterStore((s) => s.updateActive)
  const { classByKey, summary, error, loading } = useFeatSummary()
  const perLevelId = useId()
  const flatId = useId()

  if (!character) return null
  const hp = character.hp
  const dice = levelDice(character, classByKey)
  const groups = hitDiceGroups(dice)
  const breakdown = hpBreakdown(character, classByKey, summary)
  const hasClasses = dice.length > 0
  const useRolls = character.hp.method === 'rolled' && breakdown.rolledHP !== undefined
  const hitDieRecords = rollRecords(character.history, 'hitDie')
  const hitDieCursor = character.rollCursors.hitDie ?? null

  function patchHp(patch: Partial<HpState>) {
    if (!character) return
    updateActive({ hp: { ...character.hp, ...patch } })
  }

  function roll() {
    if (!character) return
    const rolls = rollHitDice(dice)
    // Each hit-die roll is recorded as its own roll and becomes the one in use,
    // so past rolls can be browsed back the same way stat rolls are.
    updateActive(
      { hp: { ...character.hp, rolls, method: 'rolled' } },
      rollAction(newRoll({ stream: 'hitDie', kind: 'hit-die', rolls })),
    )
  }

  /** Restore a browsed hit-die roll: its rolled values, as the rolled HP method. */
  function applyHitDieRecord(record: RollRecord) {
    if (!character || record.kind !== 'hit-die') return
    updateActive({
      hp: { ...character.hp, rolls: [...record.rolls], method: 'rolled' },
      rollCursors: withCursor(character, 'hitDie', record.id),
    })
  }

  /** One-line summary of a hit-die roll for the history arrows and modal rows. */
  function hitDieSummary(record: RollRecord) {
    return record.kind === 'hit-die' ? `Rolled: ${record.rolls.join(', ')}` : ''
  }

  const hitDiceLabel = groups.map((g) => `${g.count}d${g.faces}`).join(' + ') || '-'

  return (
    <EditorSection
      title="Hit Points"
      subtitle="Max at 1st level, average (or rolled) after, plus your Constitution modifier each level. Bonuses from your class, race and feats are added automatically; the manual lines take any ruling from your DM."
      actions={
        hasClasses ? <Badge bg="secondary">Hit Dice: {hitDiceLabel}</Badge> : undefined
      }
    >
      {loading && (
        <div className="text-body-secondary">
          <Spinner size="sm" animation="border" className="me-2" />
          Loading hit dice…
        </div>
      )}
      {error && (
        <Alert variant="danger">Failed to load hit point data: {error.message}</Alert>
      )}

      {!loading && !error && !hasClasses && (
        <Alert variant="warning" className="mb-0">
          Add a class with at least one level to calculate hit points.
        </Alert>
      )}

      {!loading && !error && hasClasses && (
        <>
          <div className="d-flex flex-wrap gap-3 mb-3">
            <HpCard
              label="Average HP"
              value={breakdown.averageHP}
              active={hp.method === 'average'}
              onSelect={() => patchHp({ method: 'average' })}
            />
            <HpCard
              label="Rolled HP"
              value={breakdown.rolledHP}
              active={hp.method === 'rolled'}
              onSelect={
                breakdown.rolledHP != null
                  ? () => patchHp({ method: 'rolled' })
                  : undefined
              }
              placeholder="-"
            />
            <div className="d-flex align-items-center gap-2">
              <Button size="sm" variant="secondary" onClick={roll}>
                {breakdown.rolledHP != null ? 'Reroll' : 'Roll HP'}
              </Button>
              <RollHistoryControls
                records={hitDieRecords}
                activeId={hitDieCursor}
                onSelect={applyHitDieRecord}
                renderSummary={hitDieSummary}
                title="Hit-die roll history"
              />
            </div>
          </div>

          <Table size="sm" className="mb-0 align-middle" aria-label="Hit point breakdown">
            <thead>
              <tr>
                <th>Source</th>
                <th>How it adds up</th>
                <th className="text-end">Hit points</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.dice.flatMap((d) => diceRows(d, useRolls))}
              <tr>
                <td>Constitution modifier</td>
                <td>
                  {formatMod(breakdown.conMod)} x {breakdown.totalLevel} levels
                </td>
                <td className="text-end">{formatMod(breakdown.conTotal)}</td>
              </tr>
              {breakdown.lines.map((line) => (
                <tr key={`${line.id}-${line.source}`} title={line.text}>
                  <td>
                    {line.label}{' '}
                    <span className="text-body-secondary">({line.source})</span>{' '}
                    <Badge bg="secondary">Automatic</Badge>
                  </td>
                  <td>
                    {line.perLevel !== 0
                      ? `${formatMod(line.perLevel)} per ${line.per === 'class' ? 'class ' : ''}level x ${line.levels}`
                      : 'Flat'}
                  </td>
                  <td className="text-end">{formatMod(line.total)}</td>
                </tr>
              ))}
              <tr>
                <td>
                  <Form.Label htmlFor={perLevelId} className="mb-0">
                    Other bonus per level
                  </Form.Label>{' '}
                  <Badge bg="secondary">Manual</Badge>
                </td>
                <td>
                  <SignedInput
                    id={perLevelId}
                    value={hp.perLevelBonus}
                    ariaLabel="Other HP bonus per level"
                    onCommit={(perLevelBonus) => patchHp({ perLevelBonus })}
                  />
                </td>
                <td className="text-end">
                  {formatMod(hp.perLevelBonus * breakdown.totalLevel)}
                </td>
              </tr>
              <tr>
                <td>
                  <Form.Label htmlFor={flatId} className="mb-0">
                    Flat bonus
                  </Form.Label>{' '}
                  <Badge bg="secondary">Manual</Badge>
                </td>
                <td>
                  <SignedInput
                    id={flatId}
                    value={hp.flatBonus}
                    ariaLabel="Flat HP bonus"
                    onCommit={(flatBonus) => patchHp({ flatBonus })}
                  />
                </td>
                <td className="text-end">{formatMod(hp.flatBonus)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="fw-bold">
                <td colSpan={2}>
                  Maximum hit points ({useRolls ? 'rolled' : 'average'})
                </td>
                <td className="text-end">
                  {useRolls ? breakdown.rolledHP : breakdown.averageHP}
                </td>
              </tr>
            </tfoot>
          </Table>
        </>
      )}
    </EditorSection>
  )
}

/** A whole-number field that accepts negatives: a lone "-" stays typed until a digit follows. */
function SignedInput({
  id,
  value,
  ariaLabel,
  onCommit,
}: {
  id: string
  value: number
  ariaLabel: string
  onCommit: (next: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <Form.Control
      id={id}
      type="number"
      size="sm"
      className="w-auto"
      step={1}
      value={draft ?? String(value)}
      onChange={(e) => {
        const raw = e.target.value
        setDraft(raw)
        const next = Number(raw)
        if (raw !== '' && Number.isInteger(next)) onCommit(next)
        else if (raw === '') onCommit(0)
      }}
      onBlur={() => setDraft(null)}
      aria-label={ariaLabel}
    />
  )
}

const levelRange = (from: number, to: number) =>
  from === to ? `level ${from}` : `levels ${from}-${to}`

/** The table rows for one class row's hit dice: the maximum first level, then the rest. */
function diceRows(d: HpDiceLine, rolled: boolean) {
  const rows: ReactElement[] = []
  const die = `${d.className} d${d.faces}`
  if (d.hasFirst) {
    rows.push(
      <tr key={`${d.classIndex}-first`}>
        <td>Hit dice, level 1</td>
        <td>{die}, maximum</td>
        <td className="text-end">{d.faces}</td>
      </tr>,
    )
  }
  if (d.averaged > 0) {
    const total = d.averageTotal - (d.hasFirst ? d.faces : 0)
    const rolledTotal =
      d.rolledTotal === undefined ? 0 : d.rolledTotal - (d.hasFirst ? d.faces : 0)
    rows.push(
      <tr key={`${d.classIndex}-rest`}>
        <td>Hit dice, {levelRange(d.fromLevel + (d.hasFirst ? 1 : 0), d.toLevel)}</td>
        <td>
          {die}, {rolled ? 'rolled' : `average ${d.average} x ${d.averaged}`}
        </td>
        <td className="text-end">{rolled ? rolledTotal : total}</td>
      </tr>,
    )
  }
  return rows
}

function HpCard({
  label,
  value,
  active,
  onSelect,
  placeholder,
}: {
  label: string
  value?: number
  active: boolean
  onSelect?: () => void
  placeholder?: string
}) {
  const disabled = !onSelect
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`btn text-start p-3 border rounded ${
        active ? 'border-primary bg-primary-subtle' : 'border-secondary-subtle'
      }`}
      style={{ minWidth: 140 }}
      aria-pressed={active}
    >
      <div className="small text-body-secondary">{label}</div>
      <div className="fs-3 fw-bold">{value != null ? value : (placeholder ?? '-')}</div>
    </button>
  )
}
