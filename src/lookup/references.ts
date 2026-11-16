// Which {@tag ...} markup of the data refers to an entry Quick lookup holds, and how to
// find that entry. Every tag kind the data uses is in one of the two tables below, so a
// new tag in the data is noticed by the audit test (references.audit.test.ts).

import { memoizeContent } from '../content/epoch'
import { loadLookupRows, rowText } from './rows'
import type { LookupKind, LookupRow } from './types'

/** A tag that names an entry: the kind it is, and the book it is from when none is given. */
interface ReferenceTag {
  kind: LookupKind
  defaultSource?: string
}

/** The tags that link to an entry of the lookup. Default books are those of 5etools. */
export const REFERENCE_TAGS: Readonly<Record<string, ReferenceTag>> = {
  spell: { kind: 'spell', defaultSource: 'PHB' },
  item: { kind: 'item', defaultSource: 'DMG' },
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
  m: STYLE,
  area: 'a label of a map, nothing to look up',
  book: `a place in a book, which ${NOT_HELD}`,
  adventure: `an adventure, which ${NOT_HELD}`,
  quickref: `a place in a book, which ${NOT_HELD}`,
  filter: 'a list of the 5etools site',
  footnote: 'a footnote of the text itself',
  link: 'a web address',
  tip: 'a hint of the text itself',
  '5etools': 'a pointer to the 5etools site',
  hom: 'a marker of homebrew',
  legroup: `a group of monsters, which ${NOT_HELD}`,
  creature: `a monster (a statblock), which ${NOT_HELD}`,
  object: `an object (a statblock), which ${NOT_HELD}`,
  vehicle: `a vehicle (a statblock), which ${NOT_HELD}`,
  recipe: `a recipe, which ${NOT_HELD} yet`,
  deck: `a deck of cards, which ${NOT_HELD} yet`,
  card: `a card, which ${NOT_HELD} yet`,
  table: 'names a table inside another entry, not a row of the lookup (11 of 587 found)',
  comic: 'a comic, not a rule',
  itemProperty: `an item property, which has no row of its own in the lookup yet`,
  itemMastery: `a weapon mastery, which has no row of its own in the lookup yet`,
}

/** What a reference names: the entry to find. */
export interface Reference {
  kind: LookupKind
  name: string
  source?: string
  /** Where it is from, for a feature (class and level) or a subclass (its class). */
  context?: string
  defaultSource?: string
}

/** The entry a tag refers to, or none when the tag is not a reference. */
export function referenceOf(tag: string, content: string): Reference | undefined {
  const found = REFERENCE_TAGS[tag]
  if (!found) return undefined
  const p = content.split('|').map((part) => part.trim())
  const name = p[0]
  if (!name) return undefined
  const base = { kind: found.kind, name, defaultSource: found.defaultSource }
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
    default:
      return { ...base, source: p[1] }
  }
}

/** Finds the row a reference names. */
export interface Resolver {
  find: (reference: Reference) => LookupRow | undefined
}

const keyOf = (kind: LookupKind, name: string) => `${kind}|${name.toLowerCase()}`

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
  return {
    find: (ref) => {
      let best: LookupRow | undefined
      let bestScore = -1
      for (const row of byName.get(keyOf(ref.kind, ref.name)) ?? []) {
        const points = score(row, ref)
        if (points > bestScore) {
          best = row
          bestScore = points
        }
      }
      return best
    },
  }
}

/** The resolver for the loaded content. Built the first time a reference is hovered. */
export const loadResolver = memoizeContent(async (): Promise<Resolver> =>
  buildResolver(await loadLookupRows()),
)

/** The first words of a row's text, for a tooltip: cut at a word, never mid-word. */
export function summaryOf(row: LookupRow, width: number): string {
  const text = rowText(row)
  if (text.length <= width) return text
  const cut = text.slice(0, width)
  const space = cut.lastIndexOf(' ')
  return `${(space > width / 2 ? cut.slice(0, space) : cut).trimEnd()}...`
}
