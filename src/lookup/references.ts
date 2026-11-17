// Which {@tag ...} markup of the data refers to an entry Quick lookup holds, and how to
// find that entry. Every tag kind the data uses is in one of the two tables below, so a
// new tag in the data is noticed by the audit test (references.audit.test.ts).

import type { Beast } from '../data/beasts'
import { sizeLabel } from '../data/labels'
import { memoizeContent } from '../content/epoch'
import { applyVariant, variantApplies } from '../data/itemVariants'
import { loadLookupRows, rowText, tableCaptions, uniqueIds } from './rows'
import type { LookupKind, LookupRow } from './types'

/** A tag that names an entry: the kind it is, and the book it is from when none is given. */
interface ReferenceTag {
  kind: LookupKind
  defaultSource?: string
  /** Other kinds the entry may be of when none of `kind` has it: an item group. */
  alsoKinds?: LookupKind[]
}

/** The tags that link to an entry of the lookup. Default books are those of 5etools. */
export const REFERENCE_TAGS: Readonly<Record<string, ReferenceTag>> = {
  spell: { kind: 'spell', defaultSource: 'PHB' },
  item: { kind: 'item', defaultSource: 'DMG', alsoKinds: ['itemGroup'] },
  condition: { kind: 'condition', defaultSource: 'PHB' },
  disease: { kind: 'disease', defaultSource: 'DMG' },
  status: { kind: 'status' },
  action: { kind: 'action', defaultSource: 'PHB' },
  sense: { kind: 'sense', defaultSource: 'PHB' },
  skill: { kind: 'skill', defaultSource: 'PHB' },
  language: { kind: 'language', defaultSource: 'PHB' },
  variantrule: { kind: 'variantRule', defaultSource: 'DMG' },
  feat: { kind: 'feat', defaultSource: 'PHB' },
  background: { kind: 'background', defaultSource: 'PHB' },
  race: { kind: 'race', defaultSource: 'PHB' },
  class: { kind: 'class', defaultSource: 'PHB' },
  subclass: { kind: 'subclass', defaultSource: 'PHB' },
  classFeature: { kind: 'classFeature', defaultSource: 'PHB' },
  subclassFeature: { kind: 'subclassFeature', defaultSource: 'PHB' },
  optfeature: { kind: 'optionalFeature', defaultSource: 'PHB' },
  reward: { kind: 'reward', defaultSource: 'DMG' },
  deity: { kind: 'deity' },
  trap: { kind: 'trap', defaultSource: 'DMG' },
  hazard: { kind: 'hazard', defaultSource: 'DMG' },
  cult: { kind: 'cult' },
  facility: { kind: 'facility' },
  vehupgrade: { kind: 'vehicleUpgrade' },
  charoption: { kind: 'characterOption' },
  creature: { kind: 'creature', defaultSource: 'MM' },
  object: { kind: 'object', defaultSource: 'DMG' },
  vehicle: { kind: 'vehicle' },
  recipe: { kind: 'recipe' },
  deck: { kind: 'deck' },
  card: { kind: 'card' },
  itemProperty: { kind: 'itemProperty', defaultSource: 'PHB' },
  itemMastery: { kind: 'itemMastery', defaultSource: 'XPHB' },
  table: { kind: 'table' },
}

const ROLL = 'a roll, nothing to look up'
const NUMBER = 'a number, nothing to look up'
const MONSTER_ACTION = 'a label of a monster action, nothing to look up'
const STYLE = 'styling of text'
const NOT_HELD = 'is not held by the lookup'

/** The tags that stay plain text, each with why. */
export const PLAIN_TAGS: Readonly<Record<string, string>> = {
  damage: ROLL,
  dice: ROLL,
  scaledamage: ROLL,
  scaledice: ROLL,
  d20: ROLL,
  coinflip: ROLL,
  dc: NUMBER,
  hit: NUMBER,
  chance: NUMBER,
  recharge: NUMBER,
  hitYourSpellAttack: NUMBER,
  dcYourSpellSave: NUMBER,
  skillCheck: NUMBER,
  atk: 'an attack label, nothing to look up',
  atkr: 'an attack label, nothing to look up',
  h: 'the word Hit, nothing to look up',
  actSave: MONSTER_ACTION,
  actSaveFail: MONSTER_ACTION,
  actSaveFailBy: MONSTER_ACTION,
  actSaveSuccess: MONSTER_ACTION,
  actSaveSuccessOrFail: MONSTER_ACTION,
  actTrigger: MONSTER_ACTION,
  actResponse: MONSTER_ACTION,
  i: STYLE,
  b: STYLE,
  italic: STYLE,
  bold: STYLE,
  note: STYLE,
  color: STYLE,
  font: STYLE,
  style: STYLE,
  sup: STYLE,
  unit: STYLE,
  m: 'the word Miss, nothing to look up',
  area: 'a label of a map, nothing to look up',
  book: `a place in a book, which ${NOT_HELD}`,
  adventure: `an adventure, which ${NOT_HELD}`,
  quickref: `a place in a book, which ${NOT_HELD}`,
  filter: 'a list of the 5etools site',
  footnote: 'a footnote of the text itself',
  link: 'a web address',
  tip: 'a hint of the text itself',
  '5etools': 'a pointer to the 5etools site',
  hom: 'the words Hit or Miss, nothing to look up',
  legroup: `a group of monsters, which ${NOT_HELD}`,
  comic: 'a comic, not a rule',
}

/** What a reference names: the entry to find. */
export interface Reference {
  kind: LookupKind
  name: string
  source?: string
  /** Where it is from, for a feature (class and level) or a subclass (its class). */
  context?: string
  defaultSource?: string
  alsoKinds?: LookupKind[]
}

/** The entry a tag refers to, or none when the tag is not a reference. */
export function referenceOf(tag: string, content: string): Reference | undefined {
  const found = REFERENCE_TAGS[tag]
  if (!found) return undefined
  const p = content.split('|').map((part) => part.trim())
  const name = p[0]
  if (!name) return undefined
  const base = {
    kind: found.kind,
    name,
    defaultSource: found.defaultSource,
    alsoKinds: found.alsoKinds,
  }
  switch (tag) {
    // name|class|classSource|level|source
    case 'classFeature':
      return { ...base, source: p[4], context: `${p[1]} ${p[3]}` }
    // name|class|classSource|subclassShortName|subclassSource|level|source
    case 'subclassFeature':
      return { ...base, source: p[6], context: `${p[1]}, ${p[3]} ${p[5]}` }
    // shortName|class|classSource|source
    case 'subclass':
      return { ...base, source: p[3], context: p[1] }
    // name|pantheon|source
    case 'deity':
      return { ...base, source: p[2] }
    // name|deck|source
    case 'card':
      return { ...base, source: p[2], context: p[1] }
    default:
      return { ...base, source: p[1] }
  }
}

/** Finds the row a reference names, and the row an entry id names. */
export interface Resolver {
  find: (reference: Reference) => LookupRow | undefined
  byId: (id: string) => LookupRow | undefined
}

const keyOf = (kind: LookupKind, name: string) => `${kind}|${name.toLowerCase()}`

/**
 * A name as a reference spells it or the data does: "Flame Tongue (Longsword)", and a
 * subrace of the books, "Elf (Zendikar; Joraga Nation)" for "Elf (Zendikar) (Joraga Nation)".
 */
const plainName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[(),;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * The items the generic variants make of the base items ("+1 Longsword"), as rows of
 * the lookup, though the lookup holds only the variants themselves. Made the first time
 * a reference names one: there are thousands of them.
 */
function madeItems(rows: LookupRow[]): LookupRow[] {
  const items = rows.flatMap((r) => (r.subject.type === 'item' ? [r.subject.value] : []))
  const bases = items.filter((item) => !item.variant && !item.magic)
  const made = items
    .filter((item) => item.variant)
    .flatMap((template) =>
      bases
        .filter((base) => variantApplies(template, base))
        .map((base): LookupRow => {
          const made = applyVariant(template, base)
          return {
            id: `item:${made.key}`,
            kind: 'item',
            name: made.name,
            source: made.source,
            edition: made.edition,
            subject: { type: 'item', value: made },
          }
        }),
    )
  return uniqueIds(made)
}

/** Rows grouped under each of the names `namesOf` gives them. */
function groupedBy(
  rows: LookupRow[],
  namesOf: (row: LookupRow) => string[],
): Map<string, LookupRow[]> {
  const found = new Map<string, LookupRow[]>()
  for (const row of rows)
    for (const name of namesOf(row)) {
      const key = plainName(name)
      const list = found.get(key)
      if (list) list.push(row)
      else found.set(key, [row])
    }
  return found
}

/** Works a value out the first time it is asked for. */
function once<T>(make: () => T): () => T {
  let made: { value: T } | undefined
  return () => (made ??= { value: make() }).value
}

function buildResolver(rows: LookupRow[]): Resolver {
  const byName = new Map<string, LookupRow[]>()
  const add = (kind: LookupKind, name: string, row: LookupRow) => {
    const key = keyOf(kind, name)
    const list = byName.get(key)
    if (list) list.push(row)
    else byName.set(key, [row])
  }
  for (const row of rows) {
    add(row.kind, row.name, row)
    for (const alias of row.aliases ?? []) add(row.kind, alias, row)
    // A subclass is named in the data by its short name ("Moon"), not its full one.
    if (row.subject.type === 'class' && row.subject.value.subclass)
      add(row.kind, row.subject.value.subclass.shortName, row)
  }
  const score = (row: LookupRow, ref: Reference): number => {
    let points = 0
    if (ref.context && row.context?.toLowerCase().startsWith(ref.context.toLowerCase()))
      points += 4
    const source = row.source.toLowerCase()
    if (ref.source) points += source === ref.source.toLowerCase() ? 2 : 0
    else if (ref.defaultSource && source === ref.defaultSource.toLowerCase()) points += 1
    return points
  }
  const best = (candidates: LookupRow[] | undefined, ref: Reference) => {
    let found: LookupRow | undefined
    let foundScore = -1
    for (const row of candidates ?? []) {
      const points = score(row, ref)
      if (points > foundScore) {
        found = row
        foundScore = points
      }
    }
    return found
  }
  const ids = new Map(rows.map((row) => [row.id, row]))
  const made = once(() => {
    const items = madeItems(rows)
    return {
      byName: groupedBy(items, (r) => [r.name]),
      byId: new Map(items.map((r) => [r.id, r])),
    }
  })
  // A name spelled another way (a subrace) is found by what it says, in its own kind.
  const spelled = once(() => {
    const found = new Map<string, LookupRow[]>()
    for (const row of rows)
      for (const name of [row.name, ...(row.aliases ?? [])]) {
        const key = keyOf(row.kind, plainName(name))
        found.set(key, [...(found.get(key) ?? []), row])
      }
    return found
  })
  // A table named in the text is found inside the entry that holds it.
  const tables = once(() => groupedBy(rows, tableCaptions))
  return {
    find: (ref) => {
      for (const kind of [ref.kind, ...(ref.alsoKinds ?? [])]) {
        const found = best(byName.get(keyOf(kind, ref.name)), ref)
        if (found) return found
      }
      for (const kind of [ref.kind, ...(ref.alsoKinds ?? [])]) {
        const found = best(spelled().get(keyOf(kind, plainName(ref.name))), ref)
        if (found) return found
      }
      if (ref.kind === 'item') return best(made().byName.get(plainName(ref.name)), ref)
      if (ref.kind === 'table')
        return best(
          ref.name.split(';').flatMap((part) => tables().get(plainName(part)) ?? []),
          ref,
        )
      return undefined
    },
    byId: (id) =>
      ids.get(id) ?? (id.startsWith('item:') ? made().byId.get(id) : undefined),
  }
}

/** The resolver for the loaded content. Built the first time a reference is hovered. */
export const loadResolver = memoizeContent(async (): Promise<Resolver> =>
  buildResolver(await loadLookupRows()),
)

/** What a creature is at a glance: "Medium beast, challenge 1/4, Armor Class 13...". */
function creatureLine(c: Beast): string {
  const kind = [sizeLabel(c.size), c.type].filter(Boolean).join(' ').toLowerCase()
  return [
    kind,
    c.hasCr && `challenge ${c.cr}`,
    c.ac > 0 && `Armor Class ${c.ac}`,
    c.hp > 0 && `Hit Points ${c.hp}`,
  ]
    .filter(Boolean)
    .join(', ')
}

/** The first words of a row's text, for a tooltip: cut at a word, never mid-word. */
export function summaryOf(row: LookupRow, width: number): string {
  const text =
    row.subject.type === 'creature' ? creatureLine(row.subject.value) : rowText(row)
  if (text.length <= width) return text
  const cut = text.slice(0, width)
  const space = cut.lastIndexOf(' ')
  return `${(space > width / 2 ? cut.slice(0, space) : cut).trimEnd()}...`
}
