// The boxes of the sheet's left column: saving throws, skills, senses, proficiencies and
// languages. Each reads the derived sheet and works nothing out for itself.

import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'
import { ABILITIES, ABILITY_NAMES, formatMod } from '../../dice/dice'
import type { DerivedSheet } from '../../derived'
import { Abbr } from '../Abbr'
import { feet } from '../../data/labels'
import { DerivedNumber } from '../derived/DerivedNumber'
import { FixedPanel } from './FixedPanel'
import { ProficiencyGroup } from './ProficiencyGroup'

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
  return (
    <FixedPanel title="Saving throws" area="saves">
      <ul className="sheet-rows" aria-label="Saving throws">
        {ABILITIES.map((key) => (
          <li key={key} className="sheet-row">
            <ProficiencyMark
              kind={sheet.saves[key].proficient ? 'proficient' : undefined}
            />
            <span className="sheet-row__name">{ABILITY_NAMES[key]}</span>
            <DerivedNumber
              id={`save:${key}`}
              label={`${ABILITY_NAMES[key]} save`}
              quantity={sheet.saves[key].total}
              kind="mod"
              format={formatMod}
              amountHeader="Save"
            />
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
            <DerivedNumber
              id={`skill:${skill.key}`}
              label={skill.label}
              quantity={skill.total}
              kind="mod"
              format={formatMod}
              amountHeader="Mod"
            />
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
        {sheet.senses.map((sense) => (
          <li key={sense.key} className="sheet-row">
            <span className="sheet-row__name">{sense.label}</span>
            <DerivedNumber
              id={`sense:${sense.key}`}
              label={sense.label}
              quantity={sense.range}
              format={feet}
              amountHeader="Range"
            />
          </li>
        ))}
        {sheet.combat.passives.map((row) => (
          <li key={row.key} className="sheet-row">
            <span className="sheet-row__name">Passive {row.label}</span>
            <DerivedNumber
              id={`passive:${row.key}`}
              label={`Passive ${row.label}`}
              quantity={row.score}
            />
          </li>
        ))}
      </ul>
    </FixedPanel>
  )
}

/** The groups of the proficiency listing the sheet shows, in order. Saving throws have their own box. */
const PROFICIENCY_GROUPS = [
  { key: 'armor', title: 'Armor' },
  { key: 'weapon', title: 'Weapons' },
  { key: 'tool', title: 'Tools' },
  { key: 'language', title: 'Languages' },
] as const

export function ProficienciesPanel({ sheet }: { sheet: DerivedSheet }) {
  const { listing } = sheet.proficiencies
  return (
    <FixedPanel title="Proficiencies & languages" area="profs">
      <div className="sheet-profs">
        {PROFICIENCY_GROUPS.map(({ key, title }) => (
          <ProficiencyGroup
            key={key}
            id={`profs:${key}`}
            title={title}
            rows={listing[key]}
          />
        ))}
      </div>
    </FixedPanel>
  )
}
