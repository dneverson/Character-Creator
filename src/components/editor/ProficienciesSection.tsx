import { useMemo, useState } from 'react'
import Alert from 'react-bootstrap/Alert'
import Badge from 'react-bootstrap/Badge'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import Spinner from 'react-bootstrap/Spinner'
import Table from 'react-bootstrap/Table'
import {
  MANUAL_TAG,
  clearPicks,
  picksOf,
  togglePick,
  type PickChip,
} from '../../character/picks'
import { useActiveCharacter, useCharacterStore } from '../../character/store'
import type { AltChoice, OptionalSwitch } from '../../derived/grantBlocks'
import {
  OTHER_KINDS,
  otherOptions,
  strayPicks,
  type OtherKind,
} from '../../derived/pickCards'
import type { Listing } from '../../derived/types'
import { NonStandardBadge } from '../NonStandardBadge'
import { EditorSection } from './EditorSection'
import { PickCard } from './PickCard'
import { pickDetailOf } from './pickDetails'
import { sourceText } from './sourceText'
import { ToggleChip } from './ToggleChip'
import { useDerivedSheet } from './useDerivedSheet'

const KINDS = [
  { key: 'save', title: 'Saving throws' },
  { key: 'armor', title: 'Armor' },
  { key: 'weapon', title: 'Weapons' },
  { key: 'tool', title: 'Tools' },
  { key: 'language', title: 'Languages' },
] as const

const OTHER_TITLES: Record<OtherKind, string> = {
  language: 'Languages',
  tool: 'Tools',
  weapon: 'Weapons',
  armor: 'Armor',
}

export function ListingTable({ title, rows }: { title: string; rows: Listing[] }) {
  return (
    <div>
      <h3 className="h6">{title}</h3>
      {rows.length === 0 ? (
        <div className="text-body-secondary small">None.</div>
      ) : (
        <Table size="sm" responsive className="mb-0 align-middle" aria-label={title}>
          <thead>
            <tr>
              <th>Proficient with</th>
              <th>From</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.value}>
                <td>{row.value}</td>
                <td>
                  {row.sources.map((s) => (
                    <Badge
                      key={`${s.tag}|${s.label}`}
                      bg={s.kind === 'manual' ? 'warning' : 'secondary'}
                      text={s.kind === 'manual' ? 'dark' : undefined}
                      className="me-1"
                    >
                      {sourceText(s)}
                    </Badge>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}

function AlternativeChooser({
  choice,
  onChoose,
}: {
  choice: AltChoice
  onChoose: (index: number) => void
}) {
  const labelId = `alt-${choice.id}`
  return (
    <div className="border rounded p-3">
      <div className="fw-semibold mb-1" id={labelId}>
        {choice.card.label.replace(' · ', ' - ')}: take one of
      </div>
      <div className="d-flex flex-wrap gap-1" role="group" aria-labelledby={labelId}>
        {choice.options.map((text, i) => (
          <ToggleChip
            key={text}
            pressed={choice.chosen === i}
            onClick={() => onChoose(i)}
          >
            {text}
          </ToggleChip>
        ))}
      </div>
    </div>
  )
}

function OptionalToggle({
  option,
  onToggle,
}: {
  option: OptionalSwitch
  onToggle: (on: boolean) => void
}) {
  return (
    <div className="border rounded p-3 d-flex flex-wrap align-items-center gap-2">
      <Form.Check
        type="switch"
        id={`optional-${option.id}`}
        checked={option.on}
        onChange={(e) => onToggle(e.target.checked)}
        label={
          <>
            <strong>{option.card.label.replace(' · ', ' - ')}:</strong> {option.text}
          </>
        }
      />
      <Badge bg="warning" text="dark">
        Optional - depends on your DM
      </Badge>
    </div>
  )
}

/** Every proficiency the character has, from every source, and the picks still to make. */
export function ProficienciesSection() {
  const character = useActiveCharacter()
  const updateActive = useCharacterStore((s) => s.updateActive)
  const { sheet, catalog, loading, error } = useDerivedSheet()
  const [otherOpen, setOtherOpen] = useState(false)
  const detailOf = useMemo(() => pickDetailOf(catalog), [catalog])
  if (!character) return null
  const known = sheet?.proficiencies

  function pick(chip: PickChip, tag: string) {
    if (!character) return
    updateActive({
      grantPicks: togglePick(character.grantPicks, chip.kind, chip.value, tag),
    })
  }

  function setAlt(id: string, value: number) {
    if (!character) return
    updateActive({ grantAlt: { ...character.grantAlt, [id]: value } })
  }

  function chooseAlternative(choice: AltChoice, index: number) {
    if (!character || index === choice.chosen) return
    // The picks made under the other alternative no longer apply.
    const tag = choice.card.tag
    updateActive({
      grantPicks: clearPicks(character.grantPicks, tag, choice.kinds),
      grantAlt: { ...character.grantAlt, [choice.id]: index },
    })
  }

  const choices = { picks: character.grantPicks }
  const sourceTags = new Set(sheet?.grantTags)

  return (
    <EditorSection
      title="Proficiencies"
      subtitle="Everything you are proficient with except skills, where each comes from, and what each source lets you choose. Skills have their own section."
      actions={
        sheet && sheet.choicesOpen > 0 ? (
          <Badge bg="primary">
            {sheet.choicesOpen} {sheet.choicesOpen === 1 ? 'pick' : 'picks'} left
          </Badge>
        ) : undefined
      }
    >
      {loading && (
        <div className="text-body-secondary">
          <Spinner size="sm" animation="border" className="me-2" />
          Loading proficiencies...
        </div>
      )}
      {error && <Alert variant="danger">Could not load the data: {error.message}</Alert>}
      {sheet && known && !error && (
        <div className="d-flex flex-column gap-4">
          {(sheet.alternatives.length > 0 ||
            sheet.optionals.length > 0 ||
            sheet.picks.length > 0) && (
            <div className="d-flex flex-column gap-2">
              {sheet.alternatives.map((a) => (
                <AlternativeChooser
                  key={a.id}
                  choice={a}
                  onChoose={(i) => chooseAlternative(a, i)}
                />
              ))}
              {sheet.optionals.map((o) => (
                <OptionalToggle
                  key={o.id}
                  option={o}
                  onToggle={(on) => setAlt(o.id, on ? 1 : 0)}
                />
              ))}
              {sheet.picks.map((card) => (
                <PickCard
                  key={`${card.tag}|${card.kinds.join('-')}`}
                  card={card}
                  onPick={(chip) => pick(chip, card.tag)}
                  detailOf={detailOf}
                />
              ))}
            </div>
          )}

          <div className="border rounded p-3">
            <div className="d-flex flex-wrap align-items-center gap-2">
              <strong id="proficiencies-other">Other (DM approval)</strong>
              {Object.keys(OTHER_KINDS).some(
                (k) => strayPicks(choices, k as OtherKind, sourceTags).length > 0,
              ) && (
                <NonStandardBadge reason="Not offered by your class, background, race or feats." />
              )}
              <Button
                size="sm"
                variant="primary"
                className="ms-auto"
                aria-expanded={otherOpen}
                onClick={() => setOtherOpen(!otherOpen)}
              >
                {otherOpen ? 'Hide' : 'Show'}
              </Button>
            </div>
            {otherOpen && (
              <div className="d-flex flex-column gap-3 mt-2">
                <div className="small text-body-secondary">
                  A language, tool, weapon or armor that none of your sources offers. Your
                  DM decides whether it is allowed.
                </div>
                {(Object.keys(OTHER_KINDS) as OtherKind[]).map((kind) => {
                  const manual = new Set(
                    Object.entries(picksOf(character.grantPicks, kind))
                      .filter(([, t]) => t === MANUAL_TAG)
                      .map(([v]) => v),
                  )
                  const have = new Set(
                    known.listing[kind].map((l) => l.value.toLowerCase()),
                  )
                  const options = otherOptions(kind, catalog).filter(
                    (o) => manual.has(o.value) || !have.has(o.label.toLowerCase()),
                  )
                  const strays = strayPicks(choices, kind, sourceTags).filter(
                    (s) => s.orphan,
                  )
                  if (options.length === 0 && strays.length === 0) return null
                  return (
                    <div key={kind}>
                      <div className="small fw-semibold" id={`other-${kind}`}>
                        {OTHER_TITLES[kind]}
                      </div>
                      <div
                        className="d-flex flex-wrap gap-1"
                        role="group"
                        aria-labelledby={`other-${kind}`}
                      >
                        {options.map((o) => (
                          <ToggleChip
                            key={o.value}
                            pressed={manual.has(o.value)}
                            onClick={() => pick({ ...o, state: 'available' }, MANUAL_TAG)}
                          >
                            {o.label}
                          </ToggleChip>
                        ))}
                        {strays.map((s) => (
                          <ToggleChip
                            key={`${s.value}|${s.tag}`}
                            pressed
                            title={`Stored as ${s.tag}. Click to clear.`}
                            onClick={() =>
                              pick(
                                { kind, value: s.value, label: s.value, state: 'picked' },
                                s.tag,
                              )
                            }
                          >
                            {s.value} ({s.tag})
                          </ToggleChip>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {KINDS.map(({ key, title }) => (
            <ListingTable key={key} title={title} rows={known.listing[key]} />
          ))}
        </div>
      )}
    </EditorSection>
  )
}
