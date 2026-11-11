// How a feat is described: what it grants as facts and its text in full. The feat
// table hands this one description to the shared chooser, which draws the columns,
// the detail pane, the compare window and the chosen feat's summary from it - so
// they always say the same thing.

import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'
import { ABILITIES, ABILITY_NAMES } from '../../dice/dice'
import { summarizeAbilityOptions } from '../../data/abilityOptions'
import {
  featCategoryDescription,
  featCategoryLabel,
  prerequisiteText,
  type Feat,
} from '../../data/feats'
import { grantSets, listedGrants, spellGrants } from '../../data/grants'
import { editionYear, senseText } from '../../data/labels'
import { Entries } from '../../text/Entries'
import { stripTags } from '../../text/tags'
import { AbbrText } from '../Abbr'
import { factColumn, NO_VALUE, perEntry, type Describe, type Fact } from '../table/facts'
import type { Column } from '../table/types'
import { editionFact, grantColumn, grantFact, sourceFact } from './grantFacts'

export const featKey = (feat: Feat) => feat.key
export const featName = (feat: Feat) => feat.label
/** The edition year rides with the name, so a 2014 and a 2024 feat stay apart. */
export const featTags = (feat: Feat) => [editionYear(feat.edition)]

// ---- Facts ------------------------------------------------------------------

const categoryText = perEntry((feat: Feat) => featCategoryLabel(feat.category))
const category: Fact<Feat> = {
  key: 'category',
  label: 'Category',
  text: categoryText,
  render: (feat) => (
    <OverlayTrigger
      placement="top"
      overlay={<Tooltip>{featCategoryDescription(feat.category)}</Tooltip>}
    >
      <span>{categoryText(feat)}</span>
    </OverlayTrigger>
  ),
}

const prerequisite: Fact<Feat> = {
  key: 'prerequisite',
  label: 'Prerequisite',
  text: perEntry((feat) => prerequisiteText(feat.prerequisites)),
}

/**
 * The lowest level the feat can be taken at: the least any alternative asks for,
 * and 0 when some alternative asks for no level.
 */
const minimumLevel = perEntry((feat: Feat): number => {
  const asked = feat.prerequisites.map((p) =>
    p.level === undefined ? 0 : typeof p.level === 'number' ? p.level : p.level.level,
  )
  return asked.length > 0 ? Math.min(...asked) : 0
})
const minimumLevelFact: Fact<Feat> = {
  key: 'minimumLevel',
  label: 'Minimum level',
  text: (feat) => (minimumLevel(feat) > 0 ? String(minimumLevel(feat)) : ''),
}

const abilityText = perEntry((feat: Feat) => summarizeAbilityOptions(feat.abilityOptions))
const ability: Fact<Feat> = {
  key: 'ability',
  label: 'Ability scores',
  text: abilityText,
  render: (feat) => <AbbrText text={abilityText(feat)} kind="ability" />,
}

/** What the ability filter offers for a feat: each ability it can raise. */
const abilityValues = perEntry((feat: Feat): string[] => {
  const values = new Set<string>()
  for (const option of feat.abilityOptions)
    for (const k of ABILITIES)
      if (option.fixed[k] !== undefined || option.from.includes(k))
        values.add(ABILITY_NAMES[k])
  return values.size > 0 ? [...values] : [NO_VALUE]
})

const skills = grantFact<Feat>('skills', 'Skills', (f) =>
  grantSets(f.skillProficiencies, 'skill'),
)
const expertise = grantFact<Feat>('expertise', 'Expertise', (f) =>
  grantSets(f.expertise, 'expertise'),
)
const saves = grantFact<Feat>('saves', 'Saving throws', (f) =>
  grantSets(f.savingThrowProficiencies, 'save'),
)
const tools = grantFact<Feat>('tools', 'Tools', (f) =>
  grantSets(f.toolProficiencies, 'tool'),
)
const languages = grantFact<Feat>('languages', 'Languages', (f) =>
  grantSets(f.languageProficiencies, 'language'),
)
const weapons = grantFact<Feat>('weapons', 'Weapons', (f) =>
  grantSets(f.weaponProficiencies, 'weapon'),
)
const armor = grantFact<Feat>('armor', 'Armor', (f) =>
  grantSets(f.armorProficiencies, 'armor'),
)
const otherProficiencies = grantFact<Feat>('proficiencies', 'Other proficiencies', (f) =>
  grantSets(f.skillToolLanguageProficiencies, 'mixed'),
)
const resistances = grantFact<Feat>('resist', 'Resistances', (f) =>
  listedGrants(f.resist),
)
const immunities = grantFact<Feat>('immune', 'Immunities', (f) => listedGrants(f.immune))
const conditionImmunities = grantFact<Feat>(
  'conditionImmune',
  'Condition immunities',
  (f) => listedGrants(f.conditionImmune),
)

const sensesText = perEntry((feat: Feat) =>
  [senseText(feat.senses), senseText(feat.bonusSenses, true)].filter(Boolean).join(', '),
)
const senses: Fact<Feat> = { key: 'senses', label: 'Senses', text: sensesText }
/** What the senses filter offers: each sense, without its range. */
const senseValues = perEntry((feat: Feat) => {
  const values = sensesText(feat)
    .split(', ')
    .filter(Boolean)
    .map((s) => s.replace(/ \+?\d+ ft\.$/, ''))
  return values.length > 0 ? values : [NO_VALUE]
})

const spells = grantFact<Feat>('spells', 'Spells', (f) =>
  spellGrants(f.additionalSpells, ['innate', 'known', 'prepared']),
)
const spellList = grantFact<Feat>('spellList', 'Spell list additions', (f) =>
  spellGrants(f.additionalSpells, ['expanded']),
)

const YES = 'Yes'

/** "Maneuvers: 2": the class options a feat teaches, by how many. */
const classOptionsText = perEntry((feat: Feat) =>
  (feat.optionalfeatureProgression ?? [])
    .flatMap((block) => {
      if (typeof block !== 'object' || block === null) return []
      const { name, progression } = block as { name?: unknown; progression?: unknown }
      if (typeof name !== 'string' || typeof progression !== 'object' || !progression)
        return []
      const counts = Object.values(progression).filter((n) => typeof n === 'number')
      return counts.length > 0 ? [`${name}: ${Math.max(...counts)}`] : []
    })
    .join(', '),
)
const classOptions: Fact<Feat> = {
  key: 'classOptions',
  label: 'Class options',
  text: classOptionsText,
}

const hitPointsText = perEntry((feat: Feat) => {
  const { perLevel, flat } = feat.hp
  return [perLevel > 0 ? `+${perLevel} per level` : '', flat > 0 ? `+${flat}` : '']
    .filter(Boolean)
    .join(', ')
})
const hitPoints: Fact<Feat> = {
  key: 'hitPoints',
  label: 'Hit points',
  text: hitPointsText,
}

const repeatable: Fact<Feat> = {
  key: 'repeatable',
  label: 'Repeatable',
  text: (feat) => (feat.repeatable ? YES : ''),
}

const basics: Fact<Feat>[] = [
  category,
  prerequisite,
  minimumLevelFact,
  ability,
  skills,
  expertise,
  saves,
  tools,
  languages,
  weapons,
  armor,
  otherProficiencies,
  resistances,
  immunities,
  conditionImmunities,
  senses,
  spells,
  spellList,
  classOptions,
  hitPoints,
  repeatable,
  sourceFact,
  editionFact,
]

/**
 * What is worth seeing of a chosen feat without opening its details. Its ability
 * increases are not here: the picker under the card already states them.
 */
export const featSummary: Fact<Feat>[] = [
  category,
  prerequisite,
  skills,
  tools,
  spells,
  hitPoints,
  resistances,
]

const description: Fact<Feat> = {
  key: 'description',
  label: 'Description',
  text: (feat) => (feat.entries.length > 0 ? JSON.stringify(feat.entries) : ''),
  render: (feat) => <Entries entries={feat.entries} />,
}

export const describeFeats: Describe<Feat> = () => [
  { key: 'basics', title: 'Basics', facts: basics },
  { key: 'text', title: 'Text', facts: [description] },
]

// ---- Table ------------------------------------------------------------------

/** The stat columns of the feat table; the chooser places its action first. */
export const featColumns: Column<Feat>[] = [
  {
    key: 'name',
    header: 'Feat',
    render: (feat) => <strong>{feat.label}</strong>,
    sortValue: featName,
    filterable: false,
  },
  // Several books print a feat of the same name; book and edition tell them apart.
  factColumn(sourceFact),
  factColumn(editionFact),
  // What a player compares on comes first after the name; the category trails.
  factColumn(prerequisite, { filterable: false }),
  factColumn(ability, { filterValue: abilityValues }),
  grantColumn(skills),
  grantColumn(spells, { filterValue: (feat) => [spells.text(feat) ? YES : NO_VALUE] }),
  factColumn(category),
  factColumn(repeatable, { filterValue: (feat) => (feat.repeatable ? YES : 'No') }),
  factColumn(minimumLevelFact, {
    sortValue: minimumLevel,
    filterable: false,
    defaultHidden: true,
  }),
  grantColumn(expertise, { defaultHidden: true }),
  grantColumn(saves, { defaultHidden: true }),
  grantColumn(tools, { defaultHidden: true }),
  grantColumn(languages, { defaultHidden: true }),
  grantColumn(weapons, { defaultHidden: true }),
  grantColumn(armor, { defaultHidden: true }),
  grantColumn(otherProficiencies, { defaultHidden: true }),
  grantColumn(resistances, { defaultHidden: true }),
  grantColumn(immunities, { defaultHidden: true }),
  grantColumn(conditionImmunities, { defaultHidden: true }),
  factColumn(senses, { filterValue: senseValues, defaultHidden: true }),
  grantColumn(spellList, { defaultHidden: true }),
  factColumn(classOptions, { filterable: false, defaultHidden: true }),
  factColumn(hitPoints, { filterable: false, defaultHidden: true }),
]

/** Everything the search box looks through for a feat. */
export const featSearchText = perEntry((feat: Feat) =>
  [
    feat.label,
    feat.source,
    categoryText(feat),
    prerequisiteText(feat.prerequisites),
    stripTags(JSON.stringify(feat.entries)),
  ].join(' '),
)
