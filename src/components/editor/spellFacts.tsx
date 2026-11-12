// How a spell is described: every stat a player compares spells by, as facts. The
// spell tables hand this one description to the shared chooser, which draws the
// columns, the detail pane, the compare window and the chosen spells' short table
// from it, so a spell is always said the same way and nobody needs a book.

import Badge from 'react-bootstrap/Badge'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'
import { editionYear } from '../../data/labels'
import { isCantripUpgrade, componentsText, materialText } from '../../data/spellText'
import { schoolName, spellLevelLabel, type Spell } from '../../data/spells'
import { Entries, type Entry } from '../../text/Entries'
import { stripTags } from '../../text/tags'
import { AbbrText } from '../Abbr'
import { factColumn, NO_VALUE, perEntry, type Describe, type Fact } from '../table/facts'
import type { Column } from '../table/types'
import { editionFact, sourceFact } from './grantFacts'

export const spellKey = (spell: Spell) => spell.key
export const spellName = (spell: Spell) => spell.name
/** The edition year rides with the name, so a 2014 and a 2024 spell stay apart. */
export const spellTags = (spell: Spell) => [editionYear(spell.edition)]

const YES = 'Yes'
const ATTACK_ROLL = 'Attack roll'

/** "Wizard", "Cleric": the classes whose own list holds the spell, once each. */
const classNames = perEntry((spell: Spell): string[] => [
  ...new Set(spell.lists.classes.map((key) => key.split('|')[0])),
])

// ---- Facts ------------------------------------------------------------------

const level: Fact<Spell> = {
  key: 'level',
  label: 'Level',
  text: (spell) => spellLevelLabel(spell.level),
}

const school: Fact<Spell> = {
  key: 'school',
  label: 'School',
  text: (spell) => schoolName(spell.school),
}

const casting: Fact<Spell> = {
  key: 'casting',
  label: 'Casting time',
  text: (s) => s.casting,
}

const range: Fact<Spell> = { key: 'range', label: 'Range', text: (s) => s.range }

/** What the range filter offers: how far the spell reaches, not the number of feet. */
const rangeKind = perEntry((spell: Spell): string => {
  if (spell.range.startsWith('Self')) return 'Self'
  if (spell.range === 'Touch') return 'Touch'
  if (spell.range === 'Sight' || spell.range === 'Unlimited') return 'Sight or unlimited'
  return spell.range === 'Special' ? 'Special' : 'Ranged'
})

const components: Fact<Spell> = {
  key: 'components',
  label: 'Components',
  text: (spell) => componentsText(spell.components),
  render: (spell) => (
    <AbbrText text={componentsText(spell.components)} kind="component" />
  ),
}

/** What the components filter offers: each kind a spell needs. */
const componentValues = perEntry((spell: Spell): string[] => {
  const { v, s, m, royalty } = spell.components
  const values = [
    ...(v ? ['Verbal'] : []),
    ...(s ? ['Somatic'] : []),
    ...(m ? ['Material'] : []),
    ...(royalty ? ['Royalty'] : []),
  ]
  return values.length > 0 ? values : [NO_VALUE]
})

const material: Fact<Spell> = {
  key: 'material',
  label: 'Material',
  text: (spell) => materialText(spell.material),
}
const materialValues = perEntry((spell: Spell): string[] => {
  if (!spell.material) return ['No material']
  const values = [
    ...(spell.material.costGp !== undefined ? ['Costs gold'] : []),
    ...(spell.material.consumed ? ['Consumed'] : []),
  ]
  return values.length > 0 ? values : ['Cheap and kept']
})

const duration: Fact<Spell> = {
  key: 'duration',
  label: 'Duration',
  text: (s) => s.duration,
}

const concentration: Fact<Spell> = {
  key: 'concentration',
  label: 'Concentration',
  text: (spell) => (spell.concentration ? YES : ''),
}

const ritual: Fact<Spell> = {
  key: 'ritual',
  label: 'Ritual',
  text: (spell) => (spell.ritual ? YES : ''),
}

const damage: Fact<Spell> = { key: 'damage', label: 'Damage', text: (s) => s.damage }

/** The damage cell: the first two amounts, the rest on a tooltip. */
const damageCell = (spell: Spell) => {
  const parts = spell.damage.split('; ')
  if (parts.length <= 2) return <>{spell.damage}</>
  const rest = parts.slice(2)
  return (
    <>
      {parts.slice(0, 2).join('; ')}{' '}
      <OverlayTrigger placement="top" overlay={<Tooltip>{rest.join('; ')}</Tooltip>}>
        <span className="text-body-secondary">+{rest.length} more</span>
      </OverlayTrigger>
    </>
  )
}

const damageTypes: Fact<Spell> = {
  key: 'damageTypes',
  label: 'Damage type',
  text: (spell) => spell.damageTypes.join(', '),
}

const healing: Fact<Spell> = { key: 'healing', label: 'Healing', text: (s) => s.healing }

const save: Fact<Spell> = {
  key: 'save',
  label: 'Saving throw',
  text: (spell) => spell.save.join(', '),
}

const attack: Fact<Spell> = {
  key: 'attack',
  label: 'Attack',
  text: (spell) => (spell.attack ? `${spell.attack} attack` : ''),
}

/** The one column a player reads for how a spell is resisted or aimed. */
const saveOrAttack: Fact<Spell> = {
  key: 'saveOrAttack',
  label: 'Save or attack',
  text: (spell) => [save.text(spell), attack.text(spell)].filter(Boolean).join('; '),
}
const saveOrAttackValues = perEntry((spell: Spell): string[] => {
  const values = [...spell.save, ...(spell.attack ? [ATTACK_ROLL] : [])]
  return values.length > 0 ? values : [NO_VALUE]
})

const conditions: Fact<Spell> = {
  key: 'conditions',
  label: 'Conditions',
  text: (spell) => spell.conditions.join(', '),
}

const area: Fact<Spell> = { key: 'area', label: 'Area', text: (s) => s.area }

const affects: Fact<Spell> = {
  key: 'affects',
  label: 'Affects',
  text: (spell) => spell.creatureTypes.join(', '),
}

const tags: Fact<Spell> = { key: 'tags', label: 'Tags', text: (s) => s.tags.join(', ') }

const upcast: Fact<Spell> = {
  key: 'upcast',
  label: 'Higher slots',
  text: (s) => s.upcast,
}

const cantripScaling: Fact<Spell> = {
  key: 'cantripScaling',
  label: 'Cantrip scaling',
  text: (spell) => spell.cantripScaling,
}

const classLists: Fact<Spell> = {
  key: 'classLists',
  label: 'Class lists',
  text: (spell) => classNames(spell).join(', '),
}

const basics: Fact<Spell>[] = [
  level,
  school,
  casting,
  range,
  area,
  components,
  material,
  duration,
  concentration,
  ritual,
  damage,
  damageTypes,
  healing,
  save,
  attack,
  conditions,
  affects,
  tags,
  upcast,
  cantripScaling,
  classLists,
  sourceFact,
  editionFact,
]

const entriesText = (entries: Entry[]) =>
  entries.length > 0 ? JSON.stringify(entries) : ''
const higherEntries = (spell: Spell) =>
  (spell.entriesHigherLevel ?? []).filter((block) => !isCantripUpgrade(block))
const upgradeEntries = (spell: Spell) =>
  (spell.entriesHigherLevel ?? []).filter(isCantripUpgrade)

const description: Fact<Spell> = {
  key: 'description',
  label: 'Description',
  text: (spell) => entriesText(spell.entries),
  render: (spell) => <Entries entries={spell.entries} />,
}
const atHigherLevels: Fact<Spell> = {
  key: 'higher',
  label: 'At higher levels',
  text: (spell) => entriesText(higherEntries(spell)),
  render: (spell) => <Entries entries={higherEntries(spell)} />,
}
const cantripUpgrade: Fact<Spell> = {
  key: 'upgrade',
  label: 'Cantrip upgrade',
  text: (spell) => entriesText(upgradeEntries(spell)),
  render: (spell) => <Entries entries={upgradeEntries(spell)} />,
}

export const describeSpells: Describe<Spell> = () => [
  { key: 'basics', title: 'Spell', facts: basics },
  { key: 'text', title: 'Text', facts: [description, atHigherLevels, cantripUpgrade] },
]

// ---- Table ------------------------------------------------------------------

/** What a player compares on comes first after the name; the rest is in the chooser. */
export const spellColumns: Column<Spell>[] = [
  {
    key: 'name',
    header: 'Spell',
    render: (spell) => (
      <>
        <strong>{spell.name}</strong>
        {spell.ritual && (
          <Badge bg="secondary" className="ms-2">
            Ritual
          </Badge>
        )}
        {spell.concentration && (
          <Badge bg="secondary" className="ms-1">
            Concentration
          </Badge>
        )}
      </>
    ),
    sortValue: spellName,
    filterable: false,
  },
  factColumn(level, {
    sortValue: (spell) => spell.level,
    filterValue: (spell) => spellLevelLabel(spell.level),
  }),
  factColumn(school),
  factColumn(casting, {
    sortValue: (spell) => spell.castingMinutes,
    filterValue: (spell) => spell.castingUnit,
  }),
  factColumn(range, {
    sortValue: (spell) => spell.rangeFeet,
    filterValue: rangeKind,
  }),
  factColumn(duration, { filterValue: (spell) => spell.durationKind }),
  factColumn(components, { filterValue: componentValues }),
  {
    ...factColumn(damage, {
      sortValue: (spell) => spell.damageAverage,
      filterValue: (spell) => (spell.damage ? spell.damage.split('; ') : [NO_VALUE]),
    }),
    render: (spell) => (spell.damage ? damageCell(spell) : NO_VALUE),
  },
  factColumn(damageTypes, {
    filterValue: (spell) =>
      spell.damageTypes.length > 0 ? spell.damageTypes : [NO_VALUE],
  }),
  factColumn(saveOrAttack, { filterValue: saveOrAttackValues }),
  factColumn(sourceFact),
  factColumn(editionFact),
  factColumn(area, { defaultHidden: true }),
  factColumn(material, { filterValue: materialValues, defaultHidden: true }),
  factColumn(concentration, {
    filterValue: (spell) => (spell.concentration ? YES : 'No'),
    defaultHidden: true,
  }),
  factColumn(ritual, {
    filterValue: (spell) => (spell.ritual ? YES : 'No'),
    defaultHidden: true,
  }),
  factColumn(healing, {
    filterValue: (spell) => (spell.healing ? YES : 'No'),
    defaultHidden: true,
  }),
  factColumn(save, {
    filterValue: (spell) => (spell.save.length > 0 ? spell.save : [NO_VALUE]),
    defaultHidden: true,
  }),
  factColumn(attack, {
    filterValue: (spell) => spell.attack || NO_VALUE,
    defaultHidden: true,
  }),
  factColumn(conditions, {
    filterValue: (spell) => (spell.conditions.length > 0 ? spell.conditions : [NO_VALUE]),
    defaultHidden: true,
  }),
  factColumn(affects, {
    filterValue: (spell) =>
      spell.creatureTypes.length > 0 ? spell.creatureTypes : [NO_VALUE],
    defaultHidden: true,
  }),
  factColumn(tags, {
    filterValue: (spell) => (spell.tags.length > 0 ? spell.tags : [NO_VALUE]),
    defaultHidden: true,
  }),
  factColumn(upcast, {
    filterValue: (spell) => (spell.upcast ? YES : 'No'),
    defaultHidden: true,
  }),
  factColumn(cantripScaling, { filterable: false, defaultHidden: true }),
  factColumn(classLists, {
    filterValue: (spell) => {
      const names = classNames(spell)
      return names.length > 0 ? names : [NO_VALUE]
    },
    defaultHidden: true,
  }),
]

/**
 * The cantrip tier's table: every row's Level reads "Cantrip", which the tier
 * already says, so the column starts hidden there (the chooser still has it).
 */
export const spellCantripColumns: Column<Spell>[] = spellColumns.map((column) =>
  column.key === 'level' ? { ...column, defaultHidden: true } : column,
)

const SUMMARY_KEYS = [
  'name',
  'level',
  'casting',
  'range',
  'duration',
  'components',
  'damage',
  'damageTypes',
  'saveOrAttack',
]

/** The short table of chosen spells: the stats played with, nothing to hunt through. */
export const spellSummaryColumns: Column<Spell>[] = SUMMARY_KEYS.flatMap((key) =>
  spellColumns.filter((column) => column.key === key),
)

/** The chosen cantrips: as the summary, without the Level that is always "Cantrip". */
export const spellCantripSummaryColumns: Column<Spell>[] = spellSummaryColumns.filter(
  (column) => column.key !== 'level',
)

/** Where a spell the character is given comes from: a note per spell key, blank for a pick. */
export const grantedColumn = (notes: Map<string, string>): Column<Spell> => ({
  key: 'granted',
  header: 'Granted',
  render: (spell) => notes.get(spell.key) ?? NO_VALUE,
  sortValue: (spell) => notes.get(spell.key) ?? '',
  filterable: false,
})

/**
 * The columns with the edition year beside the name of each spell printed in both
 * editions (its key is in `twins`), so two rows of one name are never alike.
 */
export const withVersions = (
  columns: Column<Spell>[],
  twins: Set<string> | undefined,
): Column<Spell>[] =>
  !twins || twins.size === 0
    ? columns
    : columns.map((column) =>
        column.key === 'name'
          ? {
              ...column,
              render: (spell) => (
                <>
                  {column.render(spell)}
                  {twins.has(spell.key) && (
                    <Badge bg="light" text="dark" className="ms-1 border">
                      {editionYear(spell.edition)}
                    </Badge>
                  )}
                </>
              ),
            }
          : column,
      )

/** Everything the search box looks through for a spell: what it is and what it does. */
export const spellSearchText = perEntry((spell: Spell) =>
  [
    spell.name,
    ...spell.aliases,
    spell.srdName ?? '',
    schoolName(spell.school),
    classNames(spell).join(' '),
    spell.damageTypes.join(' '),
    spell.conditions.join(' '),
    spell.tags.join(' '),
    spell.source,
    stripTags(JSON.stringify(spell.entries)),
    stripTags(JSON.stringify(spell.entriesHigherLevel ?? [])),
  ].join(' '),
)
