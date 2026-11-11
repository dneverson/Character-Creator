import { useId } from 'react'
import { formatMod } from '../../dice/dice'
import Alert from 'react-bootstrap/Alert'
import Badge from 'react-bootstrap/Badge'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import Spinner from 'react-bootstrap/Spinner'
import { useActiveCharacter, useCharacterStore } from '../../character/store'
import { hitDiceGroups, hpBreakdown, levelDice, rollHitDice } from '../../character/hp'
import { type HpState, type RollRecord } from '../../character/model'
import { newRoll, rollAction, rollRecords, withCursor } from '../../character/rollHistory'
import { HP_MANUAL_FLAT, HP_MANUAL_PER_LEVEL, hpQuantity } from '../../derived/hp'
import type { Line } from '../../derived/types'
import { DerivedTable } from './DerivedTable'
import { EditorSection } from './EditorSection'
import { RollHistoryControls } from './RollHistoryControls'
import { SignedInput } from './SignedInput'
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
  const hpTable = hpQuantity(character, breakdown, useRolls)
  const hitDieRecords = rollRecords(character.history, 'hitDie')
  const hitDieCursor = character.rollCursors.hitDie ?? null

  function patchHp(patch: Partial<HpState>) {
    if (!character) return
    updateActive({ hp: { ...character.hp, ...patch } })
  }

  /** The two manual lines are fields, not figures: the table renders them as inputs. */
  function manualRow(line: Line) {
    if (line.id !== HP_MANUAL_PER_LEVEL && line.id !== HP_MANUAL_FLAT) return undefined
    const perLevel = line.id === HP_MANUAL_PER_LEVEL
    const id = perLevel ? perLevelId : flatId
    return (
      <tr>
        <td>
          <Form.Label htmlFor={id} className="mb-0">
            {line.label}
          </Form.Label>{' '}
          <Badge bg="secondary">Manual</Badge>
        </td>
        <td>
          <SignedInput
            id={id}
            value={perLevel ? hp.perLevelBonus : hp.flatBonus}
            ariaLabel={perLevel ? 'Other HP bonus per level' : 'Flat HP bonus'}
            onCommit={(next) =>
              patchHp(perLevel ? { perLevelBonus: next } : { flatBonus: next })
            }
          />
        </td>
        <td className="text-end">{formatMod(line.amount ?? 0)}</td>
      </tr>
    )
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

          <DerivedTable
            quantity={hpTable}
            ariaLabel="Hit point breakdown"
            amountHeader="Hit points"
            totalLabel={`Maximum hit points (${useRolls ? 'rolled' : 'average'})`}
            renderRow={manualRow}
          />
        </>
      )}
    </EditorSection>
  )
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
