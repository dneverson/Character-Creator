// The boxes of the sheet's left column: saving throws, skills, senses, proficiencies and
// languages. Each reads the derived sheet and works nothing out for itself.

import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'
import { ABILITIES, ABILITY_NAMES, formatMod, type AbilityKey } from '../../dice/dice'
import type { DerivedSheet } from '../../derived'
import type { DefenseRow } from '../../derived/defenses'
import { Abbr } from '../Abbr'
import { feet } from '../../data/labels'
import { DerivedNumber, type BreakdownSpec } from '../derived/DerivedNumber'
import { FixedPanel } from './FixedPanel'
import { ProficiencyGroup } from './ProficiencyGroup'
import { RollCover } from './RollCover'
import { testRoll } from './rollSpec'

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

/** A saving throw: the row rolls it, the info icon opens how it adds up. */
function SaveRow({ sheet, ability }: { sheet: DerivedSheet; ability: AbilityKey }) {
  const spec: BreakdownSpec = {
    id: `save:${ability}`,
    label: `${ABILITY_NAMES[ability]} save`,
    quantity: sheet.saves[ability].total,
    format: formatMod,
    amountHeader: 'Save',
  }
  return (
    <li className="sheet-row roll-host">
      <RollCover spec={testRoll(spec.label, spec)} />
      <ProficiencyMark
        kind={sheet.saves[ability].proficient ? 'proficient' : undefined}
      />
      <span className="sheet-row__name">{ABILITY_NAMES[ability]}</span>
      <DerivedNumber {...spec} kind="mod" rolls />
    </li>
  )
}

/** A skill: the row rolls its check, the info icon opens how it adds up. */
function SkillRow({ skill }: { skill: DerivedSheet['skills'][number] }) {
  const spec: BreakdownSpec = {
    id: `skill:${skill.key}`,
    label: skill.label,
    quantity: skill.total,
    format: formatMod,
    amountHeader: 'Mod',
  }
  return (
    <li className="sheet-row roll-host">
      <RollCover spec={testRoll(`${skill.label} check`, spec)} />
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
      <DerivedNumber {...spec} kind="mod" rolls />
    </li>
  )
}

export function SavesPanel({ sheet }: { sheet: DerivedSheet }) {
  return (
    <FixedPanel title="Saving throws" area="saves">
      <ul className="sheet-rows" aria-label="Saving throws">
        {ABILITIES.map((key) => (
          <SaveRow key={key} sheet={sheet} ability={key} />
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
          <SkillRow key={skill.key} skill={skill} />
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
            <span className="sheet-row__name">
              {sense.label}
              {sense.conditional && (
                <span className="d-block small text-body-secondary">
                  {sense.conditional.when}
                </span>
              )}
            </span>
            <DerivedNumber
              id={`sense:${sense.key}`}
              label={sense.label}
              quantity={sense.range}
              format={feet}
              amountHeader="Range"
            >
              {sense.conditional && `${feet(sense.conditional.range)}, conditional`}
            </DerivedNumber>
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

const DEFENSE_WORD: Record<DefenseRow['kind'], string> = {
  resist: 'Resistance',
  immune: 'Immunity',
  vulnerable: 'Vulnerability',
  condition: 'Immunity',
}

/** The resistances, immunities and vulnerabilities, and the conditions the character is immune to. */
export function DefensesPanel({ sheet }: { sheet: DerivedSheet }) {
  if (sheet.defenses.length === 0) return null
  return (
    <FixedPanel title="Defenses" area="defenses">
      <ul className="sheet-rows" aria-label="Defenses">
        {sheet.defenses.map((defense) => {
          const word = DEFENSE_WORD[defense.kind]
          return (
            <li key={defense.key} className="sheet-row">
              <span className="sheet-row__name">
                {defense.label}
                {defense.conditional && (
                  <span className="d-block small text-body-secondary">
                    Conditional: {defense.conditional}
                  </span>
                )}
              </span>
              <DerivedNumber
                id={`defense:${defense.key}`}
                label={`${defense.label} ${word.toLowerCase()}`}
                quantity={defense.held}
                format={(held) => (held > 0 ? 'Yes' : 'Under its condition')}
                amountHeader="In force"
                title={`${defense.label}: ${word.toLowerCase()}`}
              >
                {word}
              </DerivedNumber>
            </li>
          )
        })}
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
