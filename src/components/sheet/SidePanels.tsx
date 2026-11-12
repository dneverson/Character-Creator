// The boxes of the sheet's left column: saving throws, skills, senses, proficiencies and
// languages. Each reads the derived sheet and works nothing out for itself.

import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'
import { ABILITIES, ABILITY_NAMES, formatMod } from '../../dice/dice'
import type { DerivedSheet } from '../../derived'
import { Abbr } from '../Abbr'
import { ListingTable } from '../editor/ProficienciesSection'
import { NO_VALUE } from '../table/facts'
import { FixedPanel } from './FixedPanel'

const MARKS = {
  proficient: { letter: 'P', name: 'Proficient' },
  expertise: { letter: 'E', name: 'Expertise' },
} as const

/** P for proficient or E for expertise, with a tooltip saying so; blank when neither. */
function ProficiencyMark({ kind }: { kind?: keyof typeof MARKS }) {
  if (!kind) return <span className="sheet-mark" />
  const { letter, name } = MARKS[kind]
  return (
    <OverlayTrigger placement="top" overlay={<Tooltip>{name}</Tooltip>}>
      <abbr className="sheet-mark abbr" aria-label={name}>
        {letter}
      </abbr>
    </OverlayTrigger>
  )
}

export function SavesPanel({ sheet }: { sheet: DerivedSheet }) {
  const proficient = new Set(sheet.proficiencies.listing.save.map((s) => s.value))
  return (
    <FixedPanel title="Saving throws" area="saves">
      <ul className="sheet-rows" aria-label="Saving throws">
        {ABILITIES.map((key) => (
          <li key={key} className="sheet-row">
            <ProficiencyMark
              kind={proficient.has(ABILITY_NAMES[key]) ? 'proficient' : undefined}
            />
            <span className="sheet-row__name">{ABILITY_NAMES[key]}</span>
            <span className="sheet-row__value">{NO_VALUE}</span>
          </li>
        ))}
      </ul>
    </FixedPanel>
  )
}

export function SkillsPanel({ sheet }: { sheet: DerivedSheet }) {
  return (
    <FixedPanel title="Skills" area="skills">
      <ul className="sheet-rows" aria-label="Skills">
        {sheet.skills.map((skill) => (
          <li key={skill.key} className="sheet-row">
            <ProficiencyMark
              kind={
                skill.expertise !== undefined
                  ? 'expertise'
                  : skill.proficient
                    ? 'proficient'
                    : undefined
              }
            />
            <span className="sheet-row__name">{skill.label}</span>
            <span className="sheet-row__ability">
              <Abbr code={skill.ability.toUpperCase()} />
            </span>
            <span className="sheet-row__value">{formatMod(skill.modifier)}</span>
          </li>
        ))}
      </ul>
    </FixedPanel>
  )
}

export function SensesPanel({ sheet }: { sheet: DerivedSheet }) {
  return (
    <FixedPanel title="Senses" area="senses">
      <ul className="sheet-rows" aria-label="Senses">
        {sheet.combat.passives.map((row) => (
          <li key={row.key} className="sheet-row">
            <span className="sheet-row__name">Passive {row.label}</span>
            <span className="sheet-row__value">{row.score.value}</span>
          </li>
        ))}
      </ul>
    </FixedPanel>
  )
}

export function ProficienciesPanel({ sheet }: { sheet: DerivedSheet }) {
  const { listing } = sheet.proficiencies
  return (
    <FixedPanel title="Proficiencies & languages" area="profs">
      <div className="d-flex flex-column gap-2">
        <ListingTable title="Armor" rows={listing.armor} />
        <ListingTable title="Weapons" rows={listing.weapon} />
        <ListingTable title="Tools" rows={listing.tool} />
        <ListingTable title="Languages" rows={listing.language} />
      </div>
    </FixedPanel>
  )
}
