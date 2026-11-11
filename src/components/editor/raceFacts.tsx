// How a race is described: its stats and grants as facts, and its traits in full.
// The race table hands this one description to the shared chooser, which draws
// the columns, the detail pane, the compare window and the chosen race's summary
// from it - so they always say the same thing about a race.

import { ABILITIES, ABILITY_NAMES } from '../../dice/dice'
import { summarizeAbilityOptions } from '../../data/abilityOptions'
import { featGrantLabel } from '../../data/feats'
import { CHOICE_VALUE, grantSets, listedGrants, spellGrants } from '../../data/grants'
import { editionYear, feet, sizeLabel, speedLabel, walkingSpeed } from '../../data/labels'
import type { PlayableRace } from '../../data/race'
import { Entries, type Entry } from '../../text/Entries'
import { titleCase } from '../../text/titleCase'
import { AbbrText } from '../Abbr'
import { factColumn, NO_VALUE, perEntry, type Describe, type Fact } from '../table/facts'
import type { Column } from '../table/types'
import { editionFact, grantColumn, grantFact, sourceFact } from './grantFacts'

export const raceKey = (race: PlayableRace) => race.key
export const raceName = (race: PlayableRace) => race.name
/** The edition year rides with the name, so a 2014 and a 2024 race stay apart. */
export const raceTags = (race: PlayableRace) => [editionYear(race.edition)]

// ---- Stats and grants -------------------------------------------------------

const skills = grantFact<PlayableRace>('skills', 'Skills', (r) =>
  grantSets(r.skillProficiencies, 'skill'),
)
const languages = grantFact<PlayableRace>('languages', 'Languages', (r) =>
  grantSets(r.languageProficiencies, 'language'),
)
const tools = grantFact<PlayableRace>('tools', 'Tools', (r) =>
  grantSets(r.toolProficiencies, 'tool'),
)
const weapons = grantFact<PlayableRace>('weapons', 'Weapons', (r) =>
  grantSets(r.weaponProficiencies, 'weapon'),
)
const armor = grantFact<PlayableRace>('armor', 'Armor', (r) =>
  grantSets(r.armorProficiencies, 'armor'),
)
const otherProficiencies = grantFact<PlayableRace>(
  'proficiencies',
  'Other proficiencies',
  (r) => grantSets(r.skillToolLanguageProficiencies, 'mixed'),
)
const resistances = grantFact<PlayableRace>('resist', 'Resistances', (r) =>
  listedGrants(r.resist),
)
const immunities = grantFact<PlayableRace>('immune', 'Immunities', (r) =>
  listedGrants(r.immune),
)
const conditionImmunities = grantFact<PlayableRace>(
  'conditionImmune',
  'Condition immunities',
  (r) => listedGrants(r.conditionImmune),
)
const vulnerabilities = grantFact<PlayableRace>('vulnerable', 'Vulnerabilities', (r) =>
  listedGrants(r.vulnerable),
)
const spells = grantFact<PlayableRace>('spells', 'Spells', (r) =>
  spellGrants(r.additionalSpells),
)

const size: Fact<PlayableRace> = {
  key: 'size',
  label: 'Size',
  text: (r) => sizeLabel(r.size),
}
const speed: Fact<PlayableRace> = {
  key: 'speed',
  label: 'Speed',
  text: (r) => speedLabel(r.speed),
}
const darkvision: Fact<PlayableRace> = {
  key: 'darkvision',
  label: 'Darkvision',
  text: (r) => (r.darkvision ? feet(r.darkvision) : ''),
}
const blindsight: Fact<PlayableRace> = {
  key: 'blindsight',
  label: 'Blindsight',
  text: (r) => (r.blindsight ? feet(r.blindsight) : ''),
}
const creatureType: Fact<PlayableRace> = {
  key: 'creatureType',
  label: 'Creature type',
  // A race that names no type is a humanoid.
  text: (r) =>
    r.creatureTypes?.length ? r.creatureTypes.map(titleCase).join(' or ') : 'Humanoid',
}

/** Where a species of the 2024 rules gets its increases from. */
export const SET_BY_BACKGROUND = 'Set by background'

const abilityText = perEntry((r: PlayableRace) => {
  const increases = summarizeAbilityOptions(r.abilityOptions)
  return increases || (r.edition === 'one' ? SET_BY_BACKGROUND : '')
})
const ability: Fact<PlayableRace> = {
  key: 'ability',
  label: 'Ability scores',
  text: abilityText,
  render: (r) => <AbbrText text={abilityText(r)} kind="ability" />,
}

/** What the ability filter offers for a race: each ability it raises outright. */
const abilityValues = perEntry((r: PlayableRace): string[] => {
  const values = new Set<string>()
  for (const option of r.abilityOptions) {
    for (const k of ABILITIES)
      if (option.fixed[k] !== undefined) values.add(ABILITY_NAMES[k])
    if (option.amounts.length > 0) values.add(CHOICE_VALUE)
  }
  return values.size > 0 ? [...values] : [abilityText(r) || NO_VALUE]
})

const feats: Fact<PlayableRace> = {
  key: 'feats',
  label: 'Feats',
  text: perEntry((r) => featGrantLabel(r.featGrants)),
}

const basics: Fact<PlayableRace>[] = [
  size,
  speed,
  darkvision,
  blindsight,
  creatureType,
  ability,
  skills,
  otherProficiencies,
  languages,
  tools,
  weapons,
  armor,
  resistances,
  immunities,
  conditionImmunities,
  vulnerabilities,
  spells,
  feats,
  sourceFact,
  editionFact,
]

/** What is worth seeing of a chosen race without opening its details. */
export const raceSummary: Fact<PlayableRace>[] = [
  size,
  speed,
  darkvision,
  languages,
  skills,
  resistances,
  feats,
]

// ---- Traits -----------------------------------------------------------------

interface Trait {
  name: string
  entries: Entry[]
}

/** An entry that is a trait: one with a name and text of its own. */
function asTrait(entry: Entry): Trait | undefined {
  if (typeof entry !== 'object' || !('name' in entry) || !('entries' in entry)) return
  const { name, entries } = entry
  if (typeof name !== 'string' || !Array.isArray(entries)) return
  return { name, entries }
}

/** A race's text: its named traits, and whatever it says before or between them. */
const traitsOf = perEntry((race: PlayableRace): { about: Entry[]; traits: Trait[] } => {
  const about: Entry[] = []
  const traits: Trait[] = []
  for (const entry of race.entries ?? []) {
    const trait = asTrait(entry)
    if (trait) traits.push(trait)
    else about.push(entry)
  }
  return { about, traits }
})

// The traits every race has and that say nothing a column does not: they are in
// the detail in full, but left out of the list of what sets a race apart.
const ROUTINE_TRAITS = new Set([
  'age',
  'alignment',
  'size',
  'speed',
  'languages',
  'language',
  'creature type',
  'darkvision',
  'superior darkvision',
])

const traitNames = perEntry((race: PlayableRace) =>
  traitsOf(race)
    .traits.map((trait) => trait.name)
    .filter((name) => !ROUTINE_TRAITS.has(name.toLowerCase()))
    .join(', '),
)

/** The names of what sets a race apart, for a table cell. */
const traitList: Fact<PlayableRace> = { key: 'traits', label: 'Traits', text: traitNames }

const sameTrait = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

// One fact per trait any of the races has, so the same trait sits on the same
// line in the compare window and a race without it is simply blank there.
function traitFacts(races: PlayableRace[]): Fact<PlayableRace>[] {
  const names: string[] = []
  for (const race of races)
    for (const { name } of traitsOf(race).traits)
      if (!names.some((known) => sameTrait(known, name))) names.push(name)

  const facts: Fact<PlayableRace>[] = names.map((name) => {
    const find = (race: PlayableRace) =>
      traitsOf(race).traits.find((trait) => sameTrait(trait.name, name))
    return {
      key: `trait-${name.toLowerCase()}`,
      label: name,
      text: (race) => {
        const trait = find(race)
        return trait ? JSON.stringify(trait.entries) : ''
      },
      render: (race) => <Entries entries={find(race)?.entries ?? []} />,
    }
  })
  if (races.some((race) => traitsOf(race).about.length > 0))
    facts.unshift({
      key: 'about',
      label: 'About',
      text: (race) => {
        const { about } = traitsOf(race)
        return about.length > 0 ? JSON.stringify(about) : ''
      },
      render: (race) => <Entries entries={traitsOf(race).about} />,
    })
  return facts
}

export const describeRaces: Describe<PlayableRace> = (races) => [
  { key: 'basics', title: 'Basics', facts: basics },
  {
    key: 'traits',
    title: 'Traits',
    facts: traitFacts(races),
    empty: 'No traits found.',
  },
]

// ---- Table ------------------------------------------------------------------

/** The stat columns of the race table; the chooser places its action before them. */
export const raceColumns: Column<PlayableRace>[] = [
  {
    key: 'name',
    header: 'Race',
    render: (r) => <strong>{r.name}</strong>,
    sortValue: raceName,
    filterable: false,
  },
  // Several books print a race of the same name; the book and edition tell them apart.
  factColumn(sourceFact),
  factColumn(editionFact),
  factColumn(size),
  factColumn(speed, { sortValue: (r) => walkingSpeed(r.speed) }),
  factColumn(darkvision, { sortValue: (r) => r.darkvision ?? 0 }),
  factColumn(ability, { filterValue: abilityValues }),
  factColumn(traitList, { filterable: false }),
  grantColumn(resistances),
  grantColumn(skills),
  grantColumn(languages),
  grantColumn(spells),
  factColumn(feats),
  grantColumn(tools, { defaultHidden: true }),
  grantColumn(weapons, { defaultHidden: true }),
  grantColumn(armor, { defaultHidden: true }),
  grantColumn(otherProficiencies, { defaultHidden: true }),
  grantColumn(immunities, { defaultHidden: true }),
  grantColumn(conditionImmunities, { defaultHidden: true }),
  grantColumn(vulnerabilities, { defaultHidden: true }),
  factColumn(blindsight, {
    sortValue: (r) => r.blindsight ?? 0,
    defaultHidden: true,
  }),
  factColumn(creatureType, { defaultHidden: true }),
]

/** Everything the search box looks through for a race. */
export const raceSearchText = (race: PlayableRace) =>
  `${race.name} ${race.source} ${traitNames(race)}`
