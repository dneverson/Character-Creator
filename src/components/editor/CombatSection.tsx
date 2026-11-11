import { Fragment, useId, useState } from 'react'
import Alert from 'react-bootstrap/Alert'
import Badge from 'react-bootstrap/Badge'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import Spinner from 'react-bootstrap/Spinner'
import Table from 'react-bootstrap/Table'
import { toggleClassOption, type PickChip } from '../../character/picks'
import { useActiveCharacter, useCharacterStore } from '../../character/store'
import { formatMod } from '../../dice/dice'
import { AC_MANUAL } from '../../derived/armorClass'
import type { AttackRow } from '../../derived/attacks'
import { INITIATIVE_MANUAL, type PassiveRow } from '../../derived/combat'
import type { SpellStatRow } from '../../derived/spellStats'
import type { Line } from '../../derived/types'
import { Abbr } from '../Abbr'
import { DerivedTable } from './DerivedTable'
import { EditorSection } from './EditorSection'
import { PickCard } from './PickCard'
import { SignedInput } from './SignedInput'
import { useDerivedSheet } from './useDerivedSheet'

/** "1d8 + 3 slashing": the die, the bonus with its sign, the kind of damage. */
function damageText(dice: string, bonus: number, types: string): string {
  const amount = bonus === 0 ? '' : ` ${bonus < 0 ? '-' : '+'} ${Math.abs(bonus)}`
  return `${dice}${amount}${types ? ` ${types}` : ''}`
}

/** A button that opens the lines of a number under its row. */
function HowButton({
  open,
  onToggle,
  label,
}: {
  open: boolean
  onToggle: () => void
  label: string
}) {
  return (
    <Button
      size="sm"
      variant="secondary"
      aria-expanded={open}
      aria-label={`${open ? 'Hide' : 'Show'} how ${label} adds up`}
      onClick={onToggle}
    >
      {open ? 'Hide' : 'How'}
    </Button>
  )
}

function PassivesTable({ rows }: { rows: PassiveRow[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  return (
    <Table responsive size="sm" className="mb-0 align-middle" aria-label="Passive scores">
      <thead>
        <tr>
          <th>Passive score</th>
          <th className="text-end">Score</th>
          <th aria-label="Details" />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const open = openKey === row.key
          return (
            <Fragment key={row.key}>
              <tr>
                <td>Passive {row.label}</td>
                <td className="text-end">{row.score.value}</td>
                <td className="text-end">
                  <HowButton
                    open={open}
                    label={`passive ${row.label}`}
                    onToggle={() => setOpenKey(open ? null : row.key)}
                  />
                </td>
              </tr>
              {open && (
                <tr>
                  <td colSpan={3}>
                    <DerivedTable
                      quantity={row.score}
                      ariaLabel={`Passive ${row.label}`}
                      amountHeader="Score"
                      totalLabel={`Passive ${row.label}`}
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
    </Table>
  )
}

function AttackDetails({ attack }: { attack: AttackRow }) {
  return (
    <div className="d-flex flex-column gap-3">
      <DerivedTable
        quantity={attack.toHit}
        ariaLabel={`${attack.name} attack bonus`}
        amountHeader="Attack bonus"
        totalLabel="Attack bonus"
        format={formatMod}
      />
      <DerivedTable
        quantity={attack.damage.bonus}
        ariaLabel={`${attack.name} damage bonus`}
        amountHeader="Damage bonus"
        totalLabel={`Damage bonus (${attack.damage.dice})`}
        format={formatMod}
      />
      {attack.twoHanded && (
        <DerivedTable
          quantity={attack.twoHanded.bonus}
          ariaLabel={`${attack.name} damage bonus, two hands`}
          amountHeader="Damage bonus"
          totalLabel={`Damage bonus, two hands (${attack.twoHanded.dice})`}
          format={formatMod}
        />
      )}
    </div>
  )
}

function AttacksTable({ attacks }: { attacks: AttackRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  return (
    <Table responsive size="sm" className="mb-0 align-middle" aria-label="Attacks">
      <thead>
        <tr>
          <th>Attack</th>
          <th className="text-end">To hit</th>
          <th>Damage</th>
          <th>Notes</th>
          <th aria-label="Details" />
        </tr>
      </thead>
      <tbody>
        {attacks.map((attack) => {
          const open = openId === attack.id
          const flag = attack.toHit.lines.find((l) => l.status === 'flag')
          return (
            <Fragment key={attack.id}>
              <tr className={flag ? 'table-warning' : undefined}>
                <td>
                  {attack.name}
                  {attack.count > 1 && ` (x${attack.count})`}
                </td>
                <td className="text-end">{formatMod(attack.toHit.value)}</td>
                <td>
                  {damageText(
                    attack.damage.dice,
                    attack.damage.bonus.value,
                    attack.damage.types,
                  )}
                  {attack.twoHanded && (
                    <div className="small text-body-secondary">
                      {damageText(
                        attack.twoHanded.dice,
                        attack.twoHanded.bonus.value,
                        '',
                      )}{' '}
                      with two hands
                    </div>
                  )}
                </td>
                <td>
                  {attack.range && <Badge bg="secondary">Range {attack.range}</Badge>}{' '}
                  {attack.properties.map((p) => (
                    <Fragment key={p.code}>
                      <Badge bg="secondary" title={p.rule}>
                        {p.label}
                      </Badge>{' '}
                    </Fragment>
                  ))}
                  {attack.mastery && (
                    <Badge bg="info" title={attack.mastery.rule}>
                      Mastery: {attack.mastery.name}
                    </Badge>
                  )}
                  {flag && <div className="small">{flag.label}</div>}
                  {attack.notes.map((n) => (
                    <div key={n} className="small text-body-secondary">
                      {n}
                    </div>
                  ))}
                </td>
                <td className="text-end">
                  <HowButton
                    open={open}
                    label={attack.name}
                    onToggle={() => setOpenId(open ? null : attack.id)}
                  />
                </td>
              </tr>
              {open && (
                <tr>
                  <td colSpan={5}>
                    <AttackDetails attack={attack} />
                  </td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
    </Table>
  )
}

function SpellStatsTable({ rows }: { rows: SpellStatRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  return (
    <Table
      responsive
      size="sm"
      className="mb-0 align-middle"
      aria-label="Spell save DC and attack bonus"
    >
      <thead>
        <tr>
          <th>Casting from</th>
          <th className="text-end">
            Spell save <Abbr code="DC" />
          </th>
          <th className="text-end">Spell attack</th>
          <th aria-label="Details" />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const open = openId === row.id
          const flag = row.dc.lines.find((l) => l.status === 'flag')
          return (
            <Fragment key={row.id}>
              <tr className={flag ? 'table-warning' : undefined}>
                <td>
                  {row.from}
                  {flag && <div className="small">{flag.label}</div>}
                </td>
                <td className="text-end">{row.dc.value}</td>
                <td className="text-end">{formatMod(row.attack.value)}</td>
                <td className="text-end">
                  <HowButton
                    open={open}
                    label={`${row.from} spell numbers`}
                    onToggle={() => setOpenId(open ? null : row.id)}
                  />
                </td>
              </tr>
              {open && (
                <tr>
                  <td colSpan={4}>
                    <div className="d-flex flex-column gap-3">
                      <DerivedTable
                        quantity={row.dc}
                        ariaLabel={`${row.from} spell save DC`}
                        amountHeader="Spell save DC"
                        totalLabel="Spell save DC"
                      />
                      <DerivedTable
                        quantity={row.attack}
                        ariaLabel={`${row.from} spell attack bonus`}
                        amountHeader="Spell attack bonus"
                        totalLabel="Spell attack bonus"
                        format={formatMod}
                      />
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
    </Table>
  )
}

/** Armor class, attacks and spell numbers, each with the lines it adds up from. */
export function CombatSection() {
  const character = useActiveCharacter()
  const updateActive = useCharacterStore((s) => s.updateActive)
  const { sheet, loading, error } = useDerivedSheet()
  const acManualId = useId()
  const initiativeManualId = useId()

  if (!character) return null

  /** The row of a manual line: an input for what the DM rules, kept in `manualBonuses`. */
  function manualRow(
    lineId: string,
    field: 'ac' | 'initiative',
    inputId: string,
    ariaLabel: string,
  ) {
    return (line: Line) => {
      if (line.id !== lineId || !character) return undefined
      return (
        <tr>
          <td>
            <Form.Label htmlFor={inputId} className="mb-0">
              {line.label}
            </Form.Label>{' '}
            <Badge bg="secondary">Manual</Badge>
          </td>
          <td>
            <SignedInput
              id={inputId}
              value={character.manualBonuses?.[field] ?? 0}
              ariaLabel={ariaLabel}
              onCommit={(next) =>
                updateActive({
                  manualBonuses: { ...character.manualBonuses, [field]: next },
                })
              }
            />
          </td>
          <td className="text-end">{formatMod(line.amount ?? 0)}</td>
        </tr>
      )
    }
  }

  function pickStyle(chip: PickChip, tag: string) {
    if (!character) return
    updateActive({
      classOptions: toggleClassOption(character.classOptions, tag, chip.value),
    })
  }

  return (
    <EditorSection
      title="Combat"
      subtitle="Armor class, initiative, passive scores, attacks and spell numbers worked out from what you wear, wield and are. Every line says where it comes from; anything against the rules is flagged and still counted, and the manual line takes any ruling from your DM."
      actions={
        sheet ? (
          <Badge bg="secondary" title={sheet.prof.lines.map((l) => l.label).join(', ')}>
            Proficiency bonus {formatMod(sheet.prof.value)}
          </Badge>
        ) : undefined
      }
    >
      {loading && (
        <div className="text-body-secondary">
          <Spinner size="sm" animation="border" className="me-2" />
          Loading equipment...
        </div>
      )}
      {error && <Alert variant="danger">Could not load the data: {error.message}</Alert>}
      {sheet && !error && (
        <div className="d-flex flex-column gap-4">
          <div>
            <h3 className="h6">
              <Abbr code="AC" /> breakdown
            </h3>
            <DerivedTable
              quantity={sheet.ac}
              ariaLabel="Armor class breakdown"
              amountHeader={<Abbr code="AC" />}
              totalLabel="Armor class"
              renderRow={manualRow(AC_MANUAL, 'ac', acManualId, 'Other AC bonus')}
            />
          </div>
          {sheet.classOptions.length > 0 && (
            <div className="d-flex flex-column gap-2">
              {sheet.classOptions.map((card) => (
                <PickCard
                  key={card.tag}
                  card={card}
                  onPick={(chip) => pickStyle(chip, card.tag)}
                />
              ))}
            </div>
          )}
          <div>
            <h3 className="h6">Initiative</h3>
            <DerivedTable
              quantity={sheet.combat.initiative}
              ariaLabel="Initiative breakdown"
              amountHeader="Initiative"
              totalLabel="Initiative"
              format={formatMod}
              renderRow={manualRow(
                INITIATIVE_MANUAL,
                'initiative',
                initiativeManualId,
                'Other initiative bonus',
              )}
            />
          </div>
          <div>
            <h3 className="h6">Passive scores</h3>
            <PassivesTable rows={sheet.combat.passives} />
          </div>
          <div>
            <h3 className="h6">Attacks</h3>
            <AttacksTable attacks={sheet.attacks} />
          </div>
          {sheet.spellStats.length > 0 && (
            <div>
              <h3 className="h6">Spellcasting</h3>
              <SpellStatsTable rows={sheet.spellStats} />
            </div>
          )}
        </div>
      )}
    </EditorSection>
  )
}
