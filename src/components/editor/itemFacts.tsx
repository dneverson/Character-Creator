// How an item is described: every stat a player compares items by, as facts. The
// item tables hand this one description to the shared chooser, which draws the
// columns, the detail pane, the compare window and the chosen items' short table
// from it, so an item is always said the same way and nobody needs a book.

import Badge from 'react-bootstrap/Badge'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'
import { CUSTOM_SOURCE } from '../../character/inventory'
import { costLabel, rarityLabel, type Item } from '../../data/items'
import { chargesText, nameSortKey, rangeLabel } from '../../data/itemText'
import { ARMOR_CLASS_LABELS, editionYear } from '../../data/labels'
import { Entries } from '../../text/Entries'
import { stripTags } from '../../text/tags'
import { Abbr, AbbrText } from '../Abbr'
import { factColumn, NO_VALUE, perEntry, type Describe, type Fact } from '../table/facts'
import type { Column, RowMeta } from '../table/types'
import { editionFact, sourceFact } from './grantFacts'

export const itemKey = (item: Item) => item.key
export const itemName = (item: Item) => item.name
/** The edition year rides with the name, so a 2014 and a 2024 item stay apart. */
export const itemTags = (item: Item) => [editionYear(item.edition)]

const YES = 'Yes'
const NO = 'No'

/** Rarity from the commonest to the rarest; "varies" and "unknown" come after. */
const RARITY_ORDER = [
  'none',
  'common',
  'uncommon',
  'rare',
  'very rare',
  'legendary',
  'artifact',
]

const rarityText = (item: Item) =>
  item.rarity === undefined || item.rarity === 'none' ? '' : rarityLabel(item.rarity)

const rarityRank = (item: Item) => {
  if (item.rarity === undefined) return -1
  const rank = RARITY_ORDER.indexOf(item.rarity)
  return rank >= 0 ? rank : RARITY_ORDER.length
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const pounds = (n: number) => `${n} lb.`

// ---- Reading an item into words ---------------------------------------------

/** "1d8, versatile 1d10": the dice a weapon rolls; its damage type is apart. */
export function damageText(item: Item): string {
  const weapon = item.weapon
  if (!weapon?.damage) return ''
  return [
    weapon.damage.text,
    weapon.versatile ? `versatile ${weapon.versatile.text}` : '',
  ]
    .filter(Boolean)
    .join(', ')
}

/** "Slashing", "Piercing or Slashing": the kind of damage a weapon deals. */
export const damageTypeText = (item: Item): string =>
  (item.weapon?.damageTypes ?? []).join(' or ')

/** The dice a weapon rolls, each its own value to filter by ("1d8", "1d10"). */
const diceValues = (item: Item): string[] =>
  [item.weapon?.damage?.text, item.weapon?.versatile?.text].filter(
    (text): text is string => text !== undefined,
  )

/** The average of the best die the weapon can roll, to sort damage by. */
const damageAverage = (item: Item) =>
  Math.max(item.weapon?.damage?.average ?? 0, item.weapon?.versatile?.average ?? 0)

/** "16", "11 + Dexterity", "12 + Dexterity (max 2)", "+2" (a shield). */
export function armorText(item: Item): string {
  const armor = item.armor
  if (!armor) return ''
  if (armor.bonus !== undefined) return `+${armor.bonus}`
  if (armor.base === undefined) return ''
  if (armor.class === 'heavy' || armor.class === undefined) return String(armor.base)
  const max = armor.dexterityMax !== undefined ? ` (max ${armor.dexterityMax})` : ''
  return `${armor.base} + Dexterity${max}`
}

/** What attuning asks: "Yes", "By a wizard", "Optional". Blank when it needs none. */
export function attunementText(item: Item): string {
  const attunement = item.attunement
  if (!attunement) return ''
  if (attunement.optional) return 'Optional'
  return attunement.text ? capitalize(attunement.text) : YES
}

const weightText = (item: Item) =>
  [item.weight !== undefined ? pounds(item.weight) : '', item.weightNote ?? '']
    .filter(Boolean)
    .join(', ')

const costText = (item: Item) => (item.value === undefined ? '' : costLabel(item.value))

const rangeText = (item: Item) =>
  item.weapon?.range ? rangeLabel(item.weapon.range) : ''

/** Every property of a weapon, and its 2024 masteries, as the table names them. */
const propertyNames = perEntry((item: Item): string[] => [
  ...(item.weapon?.properties.map((p) => p.label) ?? []),
  ...(item.weapon?.mastery.map((m) => `Mastery: ${m.name}`) ?? []),
])

/** What a property's filter offers: its name, not "Versatile (1d10)". */
const propertyFilterValues = perEntry((item: Item): string[] => {
  const values = [
    ...(item.weapon?.properties.map((p) => p.name) ?? []),
    ...(item.weapon?.mastery.map((m) => `Mastery: ${m.name}`) ?? []),
  ]
  return values.length > 0 ? values : [NO_VALUE]
})

const bonusText = (item: Item) =>
  item.bonuses.map((bonus) => `${bonus.value} ${bonus.what}`).join(', ')

const spellsText = (item: Item) =>
  item.spells.map((s) => (s.how ? `${s.name} (${s.how})` : s.name)).join(', ')

const containerText = (item: Item) =>
  item.container
    ? `Holds ${pounds(item.container.weight)}${
        item.container.weightless ? ', contents weigh nothing' : ''
      }`
    : ''

const packText = (item: Item) =>
  (item.pack ?? [])
    .map((part) => (part.quantity === 1 ? part.name : `${part.name} (${part.quantity})`))
    .join(', ')

const vehicleParts = (item: Item): [string, string][] => {
  const v = item.vehicle
  if (!v) return []
  const parts: [string, string | undefined][] = [
    ['Speed', v.speed],
    ['Armor class', v.ac?.toString()],
    ['Hit points', v.hp?.toString()],
    ['Damage threshold', v.damageThreshold?.toString()],
    ['Crew', v.crew],
    ['Passengers', v.passengers?.toString()],
    ['Cargo', v.cargoTons === undefined ? undefined : `${v.cargoTons} tons`],
    ['Carries', v.carrying === undefined ? undefined : pounds(v.carrying)],
  ]
  return parts.flatMap(([label, value]) => (value === undefined ? [] : [[label, value]]))
}

const vehicleText = (item: Item) =>
  vehicleParts(item)
    .map(([label, value]) => `${label} ${value}`)
    .join('; ')

// ---- Drawing the parts that need more than text -----------------------------

/** A word with the rule behind it on a tooltip, in the style of <Abbr>. */
const ruleCell = (label: string, rule: string) => {
  if (!rule) return <>{label}</>
  return (
    <OverlayTrigger placement="top" overlay={<Tooltip>{rule}</Tooltip>}>
      <abbr className="abbr">{label}</abbr>
    </OverlayTrigger>
  )
}

/** The weapon's properties, each with its rule on hover, then its masteries. */
const propertiesCell = (item: Item) => {
  const weapon = item.weapon
  const parts = [
    ...(weapon?.properties.map((p) => ({ label: p.label, rule: p.rule })) ?? []),
    ...(weapon?.mastery.map((m) => ({ label: `Mastery: ${m.name}`, rule: m.rule })) ??
      []),
  ]
  return (
    <>
      {parts.map((part, i) => (
        <span key={part.label}>
          {i > 0 && ', '}
          {ruleCell(part.label, part.rule)}
        </span>
      ))}
    </>
  )
}

/** A price with its coin spelled out on hover: the "gp" of "5 gp". */
const costCell = (item: Item) => <AbbrText text={costText(item)} kind="currency" />
const weightCell = (item: Item) => <AbbrText text={weightText(item)} kind="term" />
const rangeCell = (item: Item) => <AbbrText text={rangeText(item)} kind="term" />

/** An item that is a template, not a thing to own: it says what to choose. */
const isTemplate = (item: Item) => item.variant !== undefined

// ---- Facts ------------------------------------------------------------------

const type: Fact<Item> = {
  key: 'type',
  label: 'Type',
  text: (item) => item.category ?? '',
}

const cost: Fact<Item> = { key: 'cost', label: 'Cost', text: costText, render: costCell }

const weight: Fact<Item> = {
  key: 'weight',
  label: 'Weight',
  text: weightText,
  render: weightCell,
}

const rarity: Fact<Item> = { key: 'rarity', label: 'Rarity', text: rarityText }

const appliesTo: Fact<Item> = {
  key: 'appliesTo',
  label: 'Applies to',
  text: (item) => item.variant?.appliesTo ?? '',
}

const partOf: Fact<Item> = {
  key: 'partOf',
  label: 'Part of',
  text: (item) => item.groups.join(', '),
}

const tier: Fact<Item> = {
  key: 'tier',
  label: 'Tier',
  text: (item) => (item.tier ? capitalize(item.tier) : ''),
}

const freeRules: Fact<Item> = {
  key: 'free',
  label: 'In the free rules',
  text: (item) => (item.free ? YES : ''),
}

const page: Fact<Item> = {
  key: 'page',
  label: 'Page',
  text: (item) => (item.page === undefined ? '' : `p. ${item.page}`),
}

const weaponCategory: Fact<Item> = {
  key: 'weaponCategory',
  label: 'Weapon category',
  text: (item) =>
    item.weapon?.category
      ? `${capitalize(item.weapon.category)} ${item.weapon.melee ? 'melee' : 'ranged'}`
      : '',
}

const damage: Fact<Item> = { key: 'damage', label: 'Damage', text: damageText }

const damageType: Fact<Item> = {
  key: 'damageType',
  label: 'Damage type',
  text: damageTypeText,
}

const range: Fact<Item> = {
  key: 'range',
  label: 'Range',
  text: rangeText,
  render: rangeCell,
}

const properties: Fact<Item> = {
  key: 'properties',
  label: 'Properties',
  text: (item) => propertyNames(item).join(', '),
  render: propertiesCell,
}

const ammunition: Fact<Item> = {
  key: 'ammunition',
  label: 'Ammunition',
  text: (item) => item.weapon?.ammoType ?? '',
}

const armorClass: Fact<Item> = {
  key: 'ac',
  label: <Abbr code="AC" kind="stat" />,
  text: armorText,
}

const strength: Fact<Item> = {
  key: 'strength',
  label: 'Strength needed',
  text: (item) =>
    item.armor?.strength === undefined ? '' : `Strength ${item.armor.strength}`,
}

const stealth: Fact<Item> = {
  key: 'stealth',
  label: 'Stealth',
  text: (item) => (item.armor?.stealth ? 'Disadvantage' : ''),
}

const attunement: Fact<Item> = {
  key: 'attunement',
  label: 'Attunement',
  text: attunementText,
}

const bonuses: Fact<Item> = { key: 'bonuses', label: 'Bonuses', text: bonusText }

const charges: Fact<Item> = {
  key: 'charges',
  label: 'Charges',
  text: (item) => (item.charges ? chargesText(item.charges) : ''),
}

const spells: Fact<Item> = { key: 'spells', label: 'Spells', text: spellsText }

const traits: Fact<Item> = {
  key: 'traits',
  label: 'Properties of the item',
  text: (item) => item.traits.join('; '),
}

const details: Fact<Item> = {
  key: 'details',
  label: 'Varies',
  text: (item) => item.details.join('; '),
}

const container: Fact<Item> = {
  key: 'container',
  label: 'Capacity',
  text: containerText,
}

const pack: Fact<Item> = { key: 'pack', label: 'Contents', text: packText }

const vehicle: Fact<Item> = { key: 'vehicle', label: 'Vehicle', text: vehicleText }

const vehicleFacts: Fact<Item>[] = [
  'Speed',
  'Armor class',
  'Hit points',
  'Damage threshold',
  'Crew',
  'Passengers',
  'Cargo',
  'Carries',
].map((label) => ({
  key: `vehicle-${label}`,
  label,
  text: (item) => vehicleParts(item).find(([name]) => name === label)?.[1] ?? '',
}))

const entriesText = (item: Item) =>
  item.entries.length > 0 ? JSON.stringify(item.entries) : ''

const description: Fact<Item> = {
  key: 'description',
  label: 'Description',
  text: entriesText,
  render: (item) => <Entries entries={item.entries} />,
}

export const describeItems: Describe<Item> = () => [
  {
    key: 'overview',
    title: 'Item',
    facts: [
      type,
      cost,
      weight,
      rarity,
      attunement,
      appliesTo,
      partOf,
      tier,
      details,
      sourceFact,
      editionFact,
      freeRules,
      page,
    ],
  },
  {
    key: 'weapon',
    title: 'Weapon',
    facts: [weaponCategory, damage, damageType, range, properties, ammunition],
  },
  { key: 'armor', title: 'Armor', facts: [armorClass, strength, stealth] },
  { key: 'magic', title: 'Magic', facts: [bonuses, charges, spells, traits] },
  { key: 'container', title: 'Container and pack', facts: [container, pack] },
  { key: 'vehicle', title: 'Vehicle', facts: vehicleFacts },
  { key: 'text', title: 'Text', facts: [description] },
]

// ---- Table ------------------------------------------------------------------

/** A fact that is blank for most items filters as Yes or No. */
const yesNo = (fact: Fact<Item>) => (item: Item) => (fact.text(item) ? YES : NO)

/** Items listing several things filter by each: blank is one option of its own. */
const eachOf = (values: (item: Item) => string[]) => (item: Item) => {
  const found = values(item)
  return found.length > 0 ? found : [NO_VALUE]
}

/** What a player compares on comes first after the name; the rest is in the chooser. */
export const itemColumns: Column<Item>[] = [
  {
    key: 'name',
    header: 'Item',
    render: (item) => (
      <>
        <strong>{item.name}</strong>
        {item.source === CUSTOM_SOURCE && (
          <Badge bg="secondary" className="ms-2">
            Custom
          </Badge>
        )}
        {isTemplate(item) && (
          <span className="ms-2 small text-body-secondary">Choose a base</span>
        )}
      </>
    ),
    sortValue: (item) => nameSortKey(item.name),
    filterable: false,
  },
  factColumn(type),
  factColumn(cost, { sortValue: (item) => item.value ?? -1 }),
  factColumn(weight, { sortValue: (item) => item.weight ?? -1 }),
  factColumn(damage, { sortValue: damageAverage, filterValue: eachOf(diceValues) }),
  factColumn(damageType, {
    filterValue: eachOf((item) => item.weapon?.damageTypes ?? []),
  }),
  factColumn(properties, { filterValue: propertyFilterValues }),
  factColumn(armorClass, {
    sortValue: (item) => item.armor?.base ?? item.armor?.bonus ?? -1,
    filterValue: (item) =>
      item.armor?.class ? ARMOR_CLASS_LABELS[item.armor.class] : NO_VALUE,
  }),
  factColumn(rarity, { sortValue: rarityRank }),
  {
    ...factColumn(attunement, {
      filterValue: (item) => attunementText(item) || NO,
    }),
    render: (item) => attunementText(item) || NO,
  },
  factColumn(editionFact),
  factColumn(sourceFact),
  factColumn(range, {
    sortValue: (item) => item.weapon?.range?.normal ?? -1,
    defaultHidden: true,
  }),
  factColumn(weaponCategory, { defaultHidden: true }),
  factColumn(strength, {
    sortValue: (item) => item.armor?.strength ?? -1,
    defaultHidden: true,
  }),
  factColumn(stealth, { filterValue: yesNo(stealth), defaultHidden: true }),
  factColumn(bonuses, {
    filterValue: eachOf((item) => item.bonuses.map((b) => b.what)),
    defaultHidden: true,
  }),
  factColumn(charges, { filterValue: yesNo(charges), defaultHidden: true }),
  factColumn(spells, {
    filterValue: eachOf((item) => item.spells.map((s) => s.name)),
    defaultHidden: true,
  }),
  factColumn(container, { filterValue: yesNo(container), defaultHidden: true }),
  factColumn(pack, { filterable: false, defaultHidden: true }),
  factColumn(traits, { filterable: false, defaultHidden: true }),
  factColumn(vehicle, { filterable: false, defaultHidden: true }),
  factColumn(tier, { defaultHidden: true }),
  factColumn(freeRules, { filterValue: yesNo(freeRules), defaultHidden: true }),
  factColumn(page, {
    sortValue: (item) => item.page ?? -1,
    filterable: false,
    defaultHidden: true,
  }),
]

const SUMMARY_KEYS = [
  'name',
  'type',
  'damage',
  'damageType',
  'ac',
  'properties',
  'weight',
  'cost',
]

/** The short table of chosen items: the stats played with, nothing to hunt through. */
export const itemSummaryColumns: Column<Item>[] = SUMMARY_KEYS.flatMap((key) =>
  itemColumns.filter((column) => column.key === key),
)

/**
 * The columns with the edition year beside the name of each item printed in both
 * editions (it has a twin), so two rows of one name are never alike.
 */
export const withItemVersions = (columns: Column<Item>[]): Column<Item>[] =>
  columns.map((column) =>
    column.key === 'name'
      ? {
          ...column,
          render: (item) => (
            <>
              {column.render(item)}
              {item.twin !== undefined && (
                <Badge bg="light" text="dark" className="ms-1 border">
                  {editionYear(item.edition)}
                </Badge>
              )}
            </>
          ),
        }
      : column,
  )

/** The name of an item from its key: "Longsword XPHB". */
const twinLabel = (key: string) => {
  const [name, source] = key.split('|')
  return source ? `${name} ${source}` : name
}

/**
 * Whether an item is the character's edition: the other edition's version of an item
 * is greyed, with the reason, and a choice the switch can allow.
 */
export const itemRowMeta =
  (edition: Item['edition']) =>
  (item: Item): Omit<RowMeta, 'id'> =>
    item.twin !== undefined && item.edition !== edition
      ? {
          standard: false,
          reason: `${editionYear(item.edition)} version; the ${editionYear(edition)} one is ${twinLabel(item.twin)}`,
        }
      : { standard: true }

/** Everything the search box looks through for an item: what it is and what it does. */
export const itemSearchText = perEntry((item: Item) =>
  [
    item.name,
    item.srdName ?? '',
    ...item.groups,
    item.category ?? '',
    propertyNames(item).join(' '),
    item.spells.map((s) => s.name).join(' '),
    item.source,
    stripTags(JSON.stringify(item.entries)),
  ].join(' '),
)
