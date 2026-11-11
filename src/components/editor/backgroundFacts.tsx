// How a background is described: what it grants as facts, its feature and its
// story tables in full. The background table hands this one description to the
// shared chooser, which draws the columns, the detail pane, the compare window and
// the chosen background's summary from it - so they always say the same thing.

import { ABILITIES, ABILITY_NAMES } from '../../dice/dice'
import { summarizeAbilityOptions } from '../../data/abilityOptions'
import {
  startingGold,
  type PlayableBackground,
  type StoryTable,
} from '../../data/background'
import { withoutDieTables } from '../../data/dieTables'
import { featGrantLabel } from '../../data/feats'
import { grantSets, spellGrants } from '../../data/grants'
import { editionYear } from '../../data/labels'
import { Entries, type Entry } from '../../text/Entries'
import { stripTags } from '../../text/tags'
import { AbbrText } from '../Abbr'
import { DieTableView } from '../table/DieTableView'
import { factColumn, NO_VALUE, perEntry, type Describe, type Fact } from '../table/facts'
import type { Column } from '../table/types'
import { editionFact, grantColumn, grantFact, sourceFact } from './grantFacts'

export const backgroundKey = (bg: PlayableBackground) => bg.key
export const backgroundName = (bg: PlayableBackground) => bg.name
/** The edition year rides with the name, so a 2014 and a 2024 background stay apart. */
export const backgroundTags = (bg: PlayableBackground) => [editionYear(bg.edition)]

type Fields = Record<string, unknown>
const isFields = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// ---- Grants -----------------------------------------------------------------

/** Where a background of the 2014 rules leaves the ability score increases. */
export const SET_BY_RACE = 'Set by race'

const abilityText = perEntry((bg: PlayableBackground) => {
  const increases = summarizeAbilityOptions(bg.abilityOptions)
  return increases || (bg.edition === 'one' ? '' : SET_BY_RACE)
})
const ability: Fact<PlayableBackground> = {
  key: 'ability',
  label: 'Ability scores',
  text: abilityText,
  render: (bg) => <AbbrText text={abilityText(bg)} kind="ability" />,
}

/** What the ability filter offers for a background: each ability it can raise. */
const abilityValues = perEntry((bg: PlayableBackground): string[] => {
  const values = new Set<string>()
  for (const option of bg.abilityOptions)
    for (const k of ABILITIES)
      if (option.fixed[k] !== undefined || option.from.includes(k))
        values.add(ABILITY_NAMES[k])
  return values.size > 0 ? [...values] : [abilityText(bg) || NO_VALUE]
})

const feat: Fact<PlayableBackground> = {
  key: 'feat',
  label: 'Feat',
  text: perEntry((bg) => featGrantLabel(bg.featGrants)),
}

const skills = grantFact<PlayableBackground>('skills', 'Skills', (bg) =>
  grantSets(bg.skillProficiencies, 'skill'),
)
const tools = grantFact<PlayableBackground>('tools', 'Tools', (bg) =>
  grantSets(bg.toolProficiencies, 'tool'),
)
const languages = grantFact<PlayableBackground>('languages', 'Languages', (bg) =>
  grantSets(bg.languageProficiencies, 'language'),
)
const otherProficiencies = grantFact<PlayableBackground>(
  'proficiencies',
  'Other proficiencies',
  (bg) => grantSets(bg.skillToolLanguageProficiencies, 'mixed'),
)
const spells = grantFact<PlayableBackground>('spells', 'Spells', (bg) =>
  spellGrants(bg.additionalSpells, ['innate', 'known', 'prepared']),
)
const spellList = grantFact<PlayableBackground>(
  'spellList',
  'Spell list additions',
  (bg) => spellGrants(bg.additionalSpells, ['expanded']),
)

// ---- Feature ----------------------------------------------------------------

interface Feature {
  name: string
  entries: Entry[]
}

/** An entry that is the background's feature, by the mark the data gives it. */
function asFeature(entry: Entry): Feature | undefined {
  if (!isFields(entry) || !isFields(entry.data) || entry.data.isFeature !== true) return
  const { name, entries } = entry
  if (typeof name !== 'string' || !Array.isArray(entries)) return
  // "Feature: Shelter of the Faithful", "Baldur's Gate Feature: Religious Community".
  return { name: name.replace(/^.*?Feature:\s*/, '').trim(), entries }
}

/** A background's text: its features, and everything else it says. */
const partsOf = perEntry((bg: PlayableBackground) => {
  const features: Feature[] = []
  const about: Entry[] = []
  for (const entry of withoutDieTables(bg.entries)) {
    const found = asFeature(entry)
    if (found) features.push(found)
    else about.push(entry)
  }
  return { features, about }
})

const featureNames = perEntry((bg: PlayableBackground) =>
  partsOf(bg)
    .features.map((f) => f.name)
    .join(', '),
)
const feature: Fact<PlayableBackground> = {
  key: 'feature',
  label: 'Feature',
  text: featureNames,
}

// ---- Equipment and gold -----------------------------------------------------

/** Copper as the coins a book prints: 1550 is "15 gp, 5 sp". */
function coinText(copper: number): string {
  const coins: [number, string][] = [
    [Math.floor(copper / 100), 'gp'],
    [Math.floor((copper % 100) / 10), 'sp'],
    [copper % 10, 'cp'],
  ]
  return coins
    .filter(([count]) => count > 0)
    .map(([count, coin]) => `${count} ${coin}`)
    .join(', ')
}

const goldAmounts = perEntry((bg: PlayableBackground) =>
  startingGold(bg.startingEquipment).filter((copper) => copper > 0),
)
const goldText = perEntry((bg: PlayableBackground) =>
  goldAmounts(bg).map(coinText).join(' or '),
)
const gold: Fact<PlayableBackground> = {
  key: 'gold',
  label: 'Gold',
  text: goldText,
  render: (bg) => <AbbrText text={goldText(bg)} kind="currency" />,
}

/** The book's own "Equipment:" line, from the list of what the background grants. */
export const equipmentText = perEntry((bg: PlayableBackground): string => {
  for (const entry of bg.entries) {
    if (!isFields(entry) || entry.type !== 'list' || !Array.isArray(entry.items)) continue
    for (const item of entry.items)
      if (
        isFields(item) &&
        typeof item.name === 'string' &&
        /^equipment:?$/i.test(item.name.trim()) &&
        typeof item.entry === 'string'
      )
        return stripTags(item.entry)
  }
  return ''
})
const equipment: Fact<PlayableBackground> = {
  key: 'equipment',
  label: 'Equipment',
  text: equipmentText,
  render: (bg) => <AbbrText text={equipmentText(bg)} kind="currency" />,
}

// ---- Story tables and the rest ----------------------------------------------

/** The titles of a background's tables, with the background any are lent from. */
const tablesText = perEntry((bg: PlayableBackground) => {
  const groups = new Map<string | undefined, string[]>()
  for (const table of bg.storyTables)
    groups.set(table.from, [...(groups.get(table.from) ?? []), table.title])
  return [...groups]
    .map(([from, titles]) =>
      from === undefined ? titles.join(', ') : `${titles.join(', ')} from ${from}`,
    )
    .join('; ')
})
const storyTablesFact: Fact<PlayableBackground> = {
  key: 'storyTables',
  label: 'Story tables',
  text: tablesText,
}

/** "Planescape campaign": what the data asks before a background can be taken. */
const prerequisiteText = perEntry((bg: PlayableBackground) => {
  const campaigns = (bg.prerequisite ?? []).flatMap((p) =>
    isFields(p) && Array.isArray(p.campaign) ? p.campaign.map(String) : [],
  )
  return campaigns.length > 0 ? `${campaigns.join(' or ')} campaign` : ''
})
const prerequisite: Fact<PlayableBackground> = {
  key: 'prerequisite',
  label: 'Prerequisite',
  text: prerequisiteText,
}

const basics: Fact<PlayableBackground>[] = [
  ability,
  feat,
  skills,
  tools,
  languages,
  otherProficiencies,
  feature,
  gold,
  equipment,
  spells,
  spellList,
  storyTablesFact,
  prerequisite,
  sourceFact,
  editionFact,
]

/** What is worth seeing of a chosen background without opening its details. */
export const backgroundSummary: Fact<PlayableBackground>[] = [
  skills,
  tools,
  languages,
  feat,
  feature,
  gold,
]

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/** Names met across the backgrounds, each once, in the order first met. */
function namesAcross<V>(
  backgrounds: PlayableBackground[],
  items: (bg: PlayableBackground) => V[],
  nameOf: (item: V) => string,
): string[] {
  const names: string[] = []
  for (const bg of backgrounds)
    for (const item of items(bg)) {
      const name = nameOf(item)
      if (!names.some((known) => sameName(known, name))) names.push(name)
    }
  return names
}

// One fact per feature any of the backgrounds has, so the same feature sits on
// the same line in the compare window and a background without it is blank there.
function featureFacts(backgrounds: PlayableBackground[]): Fact<PlayableBackground>[] {
  const features = (bg: PlayableBackground) => partsOf(bg).features
  return namesAcross(backgrounds, features, (f) => f.name).map((name) => {
    const find = (bg: PlayableBackground) =>
      features(bg).find((f) => sameName(f.name, name))
    return {
      key: `feature-${name.toLowerCase()}`,
      label: name,
      text: (bg) => {
        const found = find(bg)
        return found ? JSON.stringify(found.entries) : ''
      },
      render: (bg) => <Entries entries={find(bg)?.entries ?? []} />,
    }
  })
}

// One fact per story table, lined up by its key ("personality trait").
function tableFacts(backgrounds: PlayableBackground[]): Fact<PlayableBackground>[] {
  const tables = (bg: PlayableBackground) => bg.storyTables
  return namesAcross(backgrounds, tables, (t) => t.key).map((key) => {
    const find = (bg: PlayableBackground): StoryTable | undefined =>
      bg.storyTables.find((t) => t.key === key)
    const first = backgrounds.flatMap((bg) => find(bg) ?? [])[0]
    return {
      key: `table-${key}`,
      label: first.title,
      text: (bg) => {
        const table = find(bg)
        return table ? JSON.stringify(table.rows) : ''
      },
      render: (bg) => {
        const table = find(bg)
        return (
          table && (
            <>
              {table.from && (
                <div className="text-body-secondary mb-1">
                  From the {table.from} background.
                </div>
              )}
              <DieTableView table={table} />
            </>
          )
        )
      },
    }
  })
}

const aboutFact: Fact<PlayableBackground> = {
  key: 'about',
  label: 'About',
  text: (bg) => {
    const { about } = partsOf(bg)
    return about.length > 0 ? JSON.stringify(about) : ''
  },
  render: (bg) => <Entries entries={partsOf(bg).about} />,
}

export const describeBackgrounds: Describe<PlayableBackground> = (backgrounds) => [
  { key: 'basics', title: 'Basics', facts: basics },
  { key: 'feature', title: 'Feature', facts: featureFacts(backgrounds) },
  {
    key: 'storyTables',
    title: 'Story tables',
    facts: tableFacts(backgrounds),
    empty: 'No tables.',
  },
  { key: 'about', title: 'About', facts: [aboutFact] },
]

// ---- Table ------------------------------------------------------------------

/** The stat columns of the background table; the chooser places its action first. */
export const backgroundColumns: Column<PlayableBackground>[] = [
  {
    key: 'name',
    header: 'Background',
    render: (bg) => <strong>{bg.name}</strong>,
    sortValue: backgroundName,
    filterable: false,
  },
  // Several books print a background of the same name; book and edition tell them apart.
  factColumn(sourceFact),
  factColumn(editionFact),
  factColumn(ability, { filterValue: abilityValues }),
  factColumn(feat),
  grantColumn(skills),
  grantColumn(tools),
  grantColumn(languages),
  factColumn(feature, { filterable: false }),
  factColumn(gold, { sortValue: (bg) => Math.max(0, ...goldAmounts(bg)) }),
  factColumn(storyTablesFact, {
    filterValue: (bg) =>
      bg.storyTables.length > 0 ? bg.storyTables.map((t) => t.title) : [NO_VALUE],
    defaultHidden: true,
  }),
  factColumn(equipment, { filterable: false, defaultHidden: true }),
  grantColumn(spells, { defaultHidden: true }),
  grantColumn(spellList, { defaultHidden: true }),
  grantColumn(otherProficiencies, { defaultHidden: true }),
  factColumn(prerequisite, { defaultHidden: true }),
]

/** Everything the search box looks through for a background. */
export const backgroundSearchText = (bg: PlayableBackground) =>
  [bg.name, bg.source, featureNames(bg), ...bg.storyTables.map((t) => t.title)].join(' ')
