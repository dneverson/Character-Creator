// How a beast is described: every stat of its stat block as facts. The Wild Shape
// table hands this one description to the shared chooser, which draws the columns,
// the detail pane, the compare window and the chosen forms' short table from it.

import type { ReactNode } from 'react'
import Badge from 'react-bootstrap/Badge'
import type { Beast, BeastEntry } from '../../data/beasts'
import { ABILITIES, abilityMod, formatMod, type AbilityKey } from '../../dice/dice'
import {
  editionYear,
  feet,
  sizeLabel,
  speedDistance,
  speedLabel,
} from '../../data/labels'
import { Entries, type Entry } from '../../text/Entries'
import { titleCase } from '../../text/titleCase'
import { Abbr } from '../Abbr'
import { factColumn, NO_VALUE, perEntry, type Describe, type Fact } from '../table/facts'
import type { Column } from '../table/types'
import { editionFact, sourceFact } from './grantFacts'

export const beastKey = (beast: { name: string; source: string }) =>
  `${beast.name}|${beast.source}`
export const beastName = (beast: Beast) => beast.name
export const beastTags = (beast: Beast) => [editionYear(beast.edition)]

const YES = 'Yes'

// ---- Attacks ----------------------------------------------------------------

/** "Bite +6, 1d8 + 4 piercing": an action that makes an attack, as a player reads it. */
export function attackText(action: BeastEntry): string {
  const text = JSON.stringify(action.entries)
  const hit = /\{@hit (-?\d+)\}/.exec(text)
  if (!hit) return ''
  const damage = /\{@damage ([^}|]+)[^}]*\}\)?\s*([a-z]+)? ?damage/.exec(text)
  const bonus = formatMod(Number(hit[1]))
  if (!damage) return `${action.name} ${bonus}`
  return `${action.name} ${bonus}, ${damage[1]}${damage[2] ? ` ${damage[2]}` : ''}`
}

/** The attacks of a beast, one text each (Multiattack and other actions are not attacks). */
export const beastAttacks = perEntry((beast: Beast): string[] =>
  beast.actions.map(attackText).filter(Boolean),
)

// ---- Facts ------------------------------------------------------------------

const cr: Fact<Beast> = {
  key: 'cr',
  label: <Abbr code="CR" />,
  text: (b) => (b.hasCr ? b.cr : ''),
}

const size: Fact<Beast> = { key: 'size', label: 'Size', text: (b) => sizeLabel(b.size) }

const kind: Fact<Beast> = {
  key: 'kind',
  label: 'Type',
  text: (b) =>
    ['beast', b.swarm ? 'swarm' : '', ...b.tags]
      .filter(Boolean)
      .map(titleCase)
      .join(', '),
}

const ac: Fact<Beast> = {
  key: 'ac',
  label: <Abbr code="AC" />,
  text: (b) => (b.ac > 0 ? `${b.ac}${b.acFrom ? ` (${b.acFrom})` : ''}` : ''),
}

const hp: Fact<Beast> = {
  key: 'hp',
  label: <Abbr code="HP" />,
  text: (b) => (b.hp > 0 ? `${b.hp}${b.hpFormula ? ` (${b.hpFormula})` : ''}` : ''),
}

const speed: Fact<Beast> = {
  key: 'speed',
  label: 'Speed',
  text: (b) => speedLabel(b.speed),
}

const MODES = ['walk', 'fly', 'swim', 'climb', 'burrow'] as const
const modeFact = (mode: (typeof MODES)[number]): Fact<Beast> => ({
  key: `speed-${mode}`,
  label: titleCase(mode),
  text: (b) => {
    const distance = speedDistance(b.speed[mode])
    return distance ? feet(distance) : ''
  },
})

const abilityFact = (key: AbilityKey): Fact<Beast> => ({
  key,
  label: <Abbr code={key.toUpperCase()} kind="ability" />,
  text: (b) => `${b.abilities[key]} (${formatMod(abilityMod(b.abilities[key]))})`,
})

const abilities: Fact<Beast> = {
  key: 'abilities',
  label: 'Abilities',
  text: (b) =>
    ABILITIES.map(
      (k) =>
        `${k.toUpperCase()} ${b.abilities[k]} (${formatMod(abilityMod(b.abilities[k]))})`,
    ).join(', '),
  render: (b) =>
    ABILITIES.map((k, i) => (
      <span key={k}>
        {i > 0 && ', '}
        <Abbr code={k.toUpperCase()} kind="ability" /> {b.abilities[k]} (
        {formatMod(abilityMod(b.abilities[k]))})
      </span>
    )),
}

const passive: Fact<Beast> = {
  key: 'passive',
  label: 'Passive Perception',
  text: (b) => (b.passive > 0 ? String(b.passive) : ''),
}

const senses: Fact<Beast> = {
  key: 'senses',
  label: 'Senses',
  text: (b) => b.senses.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(', '),
}

const skills: Fact<Beast> = {
  key: 'skills',
  label: 'Skills',
  text: (b) =>
    Object.entries(b.skills)
      .map(([skill, bonus]) => `${titleCase(skill)} ${bonus}`)
      .join(', '),
}

const attacks: Fact<Beast> = {
  key: 'attacks',
  label: 'Attacks',
  text: (b) => beastAttacks(b).join('; '),
}

const traitNames: Fact<Beast> = {
  key: 'traits',
  label: 'Traits',
  text: (b) => b.traits.map((t) => t.name).join(', '),
}

const asEntries = (list: BeastEntry[]): Entry[] =>
  list.map((e) => ({ type: 'entries', name: e.name, entries: e.entries }))
const entriesText = (list: BeastEntry[]) => (list.length > 0 ? JSON.stringify(list) : '')

const traitText: Fact<Beast> = {
  key: 'traitText',
  label: 'Traits',
  text: (b) => entriesText(b.traits),
  render: (b) => <Entries entries={asEntries(b.traits)} />,
}

const actionText: Fact<Beast> = {
  key: 'actionText',
  label: 'Actions',
  text: (b) => entriesText(b.actions),
  render: (b) => <Entries entries={asEntries(b.actions)} />,
}

export const describeBeasts: Describe<Beast> = () => [
  {
    key: 'basics',
    title: 'Beast',
    facts: [
      cr,
      size,
      kind,
      ac,
      hp,
      speed,
      abilities,
      passive,
      senses,
      skills,
      sourceFact,
      editionFact,
    ],
  },
  { key: 'text', title: 'Text', facts: [traitText, actionText] },
]

// ---- Table ------------------------------------------------------------------

const yesNo = (has: boolean) => (has ? YES : 'No')

/** What a player compares on comes first; every other stat is in the column chooser. */
export const beastColumns: Column<Beast>[] = [
  {
    key: 'name',
    header: 'Beast',
    render: (b) => (
      <>
        <strong>{b.name}</strong>
        <Badge bg="secondary" className="ms-2">
          {editionYear(b.edition)}
        </Badge>
        {b.swarm && (
          <Badge bg="secondary" className="ms-2">
            Swarm
          </Badge>
        )}
      </>
    ),
    sortValue: beastName,
    filterable: false,
  },
  factColumn(cr, {
    render: (b) => (b.hasCr ? b.cr : NO_VALUE),
    sortValue: (b) => (b.hasCr ? b.crValue : Number.POSITIVE_INFINITY),
  }),
  factColumn(size),
  factColumn(kind),
  factColumn(ac, {
    render: (b): ReactNode =>
      b.ac > 0 ? <span title={b.acFrom ?? undefined}>{b.ac}</span> : NO_VALUE,
    sortValue: (b) => b.ac,
    filterable: false,
  }),
  factColumn(hp, {
    render: (b): ReactNode =>
      b.hp > 0 ? <span title={b.hpFormula ?? undefined}>{b.hp}</span> : NO_VALUE,
    sortValue: (b) => b.hp,
    filterable: false,
  }),
  factColumn(speed, {
    sortValue: (b) => speedDistance(b.speed.walk) ?? 0,
    filterValue: (b) => [
      ...(b.hasFly ? ['Flies'] : []),
      ...(b.hasSwim ? ['Swims'] : []),
      ...(speedDistance(b.speed.climb) ? ['Climbs'] : []),
      ...(speedDistance(b.speed.burrow) ? ['Burrows'] : []),
      ...(b.hasFly || b.hasSwim ? [] : ['Land only']),
    ],
  }),
  factColumn(sourceFact),
  factColumn(editionFact),
  ...MODES.map((mode) => {
    const fact = modeFact(mode)
    return factColumn(fact, {
      sortValue: (b) => speedDistance(b.speed[mode]) ?? 0,
      filterValue: (b) => yesNo((speedDistance(b.speed[mode]) ?? 0) > 0),
      defaultHidden: true,
    })
  }),
  ...ABILITIES.map((key) =>
    factColumn(abilityFact(key), {
      header: <Abbr code={key.toUpperCase()} kind="ability" />,
      sortValue: (b) => b.abilities[key],
      filterable: false,
      defaultHidden: true,
    }),
  ),
  factColumn(passive, { sortValue: (b) => b.passive, defaultHidden: true }),
  factColumn(senses, { filterable: false, defaultHidden: true }),
  factColumn(skills, { filterable: false, defaultHidden: true }),
  factColumn(attacks, { filterable: false, defaultHidden: true }),
  factColumn(traitNames, { filterable: false, defaultHidden: true }),
]

const SUMMARY_KEYS = ['name', 'cr', 'size', 'ac', 'hp', 'speed']

/** The short table of chosen forms: the stats played with, nothing to hunt through. */
export const beastSummaryColumns: Column<Beast>[] = SUMMARY_KEYS.flatMap((key) =>
  beastColumns.filter((column) => column.key === key),
)

/** Everything the search box looks through for a beast. */
export const beastSearchText = perEntry((beast: Beast) =>
  [
    beast.name,
    kind.text(beast),
    beast.source,
    sizeLabel(beast.size),
    beast.traits.map((t) => t.name).join(' '),
    beast.actions.map((a) => a.name).join(' '),
  ].join(' '),
)
