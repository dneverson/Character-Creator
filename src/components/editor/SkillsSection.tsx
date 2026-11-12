import { useMemo, useState } from 'react'
import Alert from 'react-bootstrap/Alert'
import Badge from 'react-bootstrap/Badge'
import Button from 'react-bootstrap/Button'
import Spinner from 'react-bootstrap/Spinner'
import Table from 'react-bootstrap/Table'
import { formatMod } from '../../dice/dice'
import { loadItems } from '../../data/items'
import { loadSkillTexts, SKILLS, skillLabel } from '../../data/skills'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useActiveCharacter, useCharacterStore } from '../../character/store'
import {
  buildSkillSources,
  grantedLine,
  MANUAL_TAG,
  otherPicks,
  skillCards,
  tagName,
} from '../../character/skills'
import { skillPicks, togglePick } from '../../character/picks'
import { skillTable } from '../../derived/expertise'
import { collectSources } from '../../derived/sources'
import { Abbr } from '../Abbr'
import { NonStandardBadge } from '../NonStandardBadge'
import { EditorSection } from './EditorSection'
import { PickCard } from './PickCard'
import { pickDetailOf } from './pickDetails'
import { ToggleChip } from './ToggleChip'
import { useFeatSummary } from './useFeatSummary'

export function SkillsSection() {
  const character = useActiveCharacter()
  const updateActive = useCharacterStore((s) => s.updateActive)
  const { classByKey, background, race, feats, summary, loading, error } =
    useFeatSummary()
  const [otherOpen, setOtherOpen] = useState(false)
  const skillTexts = useAsyncData(loadSkillTexts)
  const items = useAsyncData(loadItems)
  const detailOf = useMemo(
    () =>
      pickDetailOf({
        items: items.data ?? [],
        languages: [],
        skills: skillTexts.data ?? undefined,
      }),
    [items.data, skillTexts.data],
  )

  const sources = useMemo(
    () =>
      character
        ? [
            ...buildSkillSources(character, classByKey, background, race),
            ...summary.skillSources,
          ]
        : [],
    [character, classByKey, background, race, summary.skillSources],
  )

  // The skill table with the expertise the character has, and the cards to pick it.
  const table = useMemo(
    () =>
      character
        ? skillTable(
            character,
            collectSources(character, { classByKey, background, race, feats }),
            sources,
            summary.abilityBonus,
          )
        : undefined,
    [character, classByKey, background, race, feats, sources, summary.abilityBonus],
  )

  if (!character || !table) return null

  const { rows } = table
  const cards = skillCards(character, sources, rows)
  const granted = grantedLine(sources)
  const others = otherPicks(skillPicks(character), sources)
  const orphans = others.filter((o) => o.orphan)
  const proficientCount = rows.filter((r) => r.proficient).length

  function pick(skill: string, tag: string) {
    if (!character) return
    updateActive({ grantPicks: togglePick(character.grantPicks, 'skill', skill, tag) })
  }

  function pickExpertise(value: string, tag: string) {
    if (!character) return
    updateActive({
      grantPicks: togglePick(character.grantPicks, 'expertise', value, tag),
    })
  }

  // Any skill not yet proficient can be taken outside the lists; a placed one comes off.
  const otherChips = SKILLS.filter(
    (s) =>
      !rows.find((r) => r.key === s.key)?.proficient ||
      others.some((o) => o.skill === s.key && !o.orphan),
  )

  return (
    <EditorSection
      title="Skills"
      subtitle="Each card lists what that source allows and how many picks are left. A pick outside the lists is allowed but flagged for your DM."
      actions={<Badge bg="secondary">{proficientCount} proficient</Badge>}
    >
      {loading && (
        <div className="text-body-secondary">
          <Spinner size="sm" animation="border" className="me-2" />
          Loading skill sources…
        </div>
      )}
      {error && <Alert variant="danger">Failed to load skills: {error.message}</Alert>}

      {!loading && !error && (
        <>
          {granted.length > 0 && (
            <div className="mb-3">
              <div className="fw-semibold mb-1" id="skills-granted">
                Granted
              </div>
              <ul
                className="list-unstyled d-flex flex-wrap gap-1 mb-0"
                aria-labelledby="skills-granted"
              >
                {granted.map((g) => (
                  <li key={g.label}>
                    <Badge bg="secondary">
                      {g.label} ({g.source})
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="d-flex flex-column gap-2 mb-3">
            {cards.map((card) => (
              <PickCard
                key={card.tag}
                card={card}
                onPick={(chip) => pick(chip.value, card.tag)}
                detailOf={detailOf}
              />
            ))}
            {table.expertise.cards.map((card) => (
              <PickCard
                key={`expertise-${card.tag}`}
                card={card}
                onPick={(chip) => pickExpertise(chip.value, card.tag)}
                detailOf={detailOf}
              />
            ))}
          </div>

          <div className="border rounded p-3 mb-3">
            <div className="d-flex flex-wrap align-items-center gap-2">
              <strong id="skills-other">Other skills (DM approval)</strong>
              {others.length > 0 && (
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
              <>
                <div className="small text-body-secondary my-2">
                  Not offered by your class, background, race or feats. Your DM decides
                  whether it is allowed.
                </div>
                <div
                  className="d-flex flex-wrap gap-1"
                  role="group"
                  aria-labelledby="skills-other"
                >
                  {otherChips.map((s) => {
                    const on = others.some((o) => o.skill === s.key && !o.orphan)
                    return (
                      <ToggleChip
                        key={s.key}
                        pressed={on}
                        onClick={() => pick(s.key, MANUAL_TAG)}
                      >
                        {s.label}
                      </ToggleChip>
                    )
                  })}
                </div>
                {orphans.length > 0 && (
                  <div className="mt-2">
                    <div className="small fw-semibold">
                      From a source you no longer have
                    </div>
                    <div className="d-flex flex-wrap gap-1">
                      {orphans.map((o) => (
                        <ToggleChip
                          key={o.skill}
                          pressed
                          title={`Stored as ${o.tag}. Click to clear.`}
                          onClick={() => pick(o.skill, o.tag)}
                        >
                          {skillLabel(o.skill)} ({o.tag})
                        </ToggleChip>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="table-responsive">
            <Table hover className="align-middle mb-0">
              <thead>
                <tr>
                  <th>Skill</th>
                  <th>Ability</th>
                  <th className="text-center">Mod</th>
                  <th>Proficient from</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td>{row.label}</td>
                    <td>
                      <Abbr code={row.ability.toUpperCase()} kind="ability" />
                    </td>
                    <td className="text-center fw-semibold">{formatMod(row.modifier)}</td>
                    <td>
                      {row.source &&
                        (row.nonStandard ? (
                          <NonStandardBadge reason="This skill isn't offered by your background, class, race, or feats - it needs your DM's approval." />
                        ) : (
                          <Badge bg="light" text="dark">
                            {tagName(row.source, sources)}
                          </Badge>
                        ))}
                      {row.expertise && (
                        <Badge bg="primary" className="ms-1">
                          Expertise ({row.expertise})
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </>
      )}
    </EditorSection>
  )
}
