// Spell data: load every spell file, read its facts into text (see spellText),
// and attach the class spell lists from the generated spell-source lookup (spell
// entries carry no `classes` field in current 5etools data). A class list is the
// list of one class source, so a 2014 Wizard and a 2024 Wizard keep their own.

import { memoizeContent } from '../content/epoch'
import { titleCase } from '../text/titleCase'
import type { Entry } from '../text/Entries'
import { fetchData } from './dataClient'
import { loadBookEditions, type Edition } from './edition'
import {
  areaOf,
  attackOf,
  cantripScalingOf,
  castingMinutesOf,
  castingUnitOf,
  componentsOf,
  damageOf,
  durationKindOf,
  durationText,
  healingOf,
  materialOf,
  ordinal,
  rangeFeetOf,
  rangeText,
  tagsOf,
  timeText,
  upcastOf,
  type RawComponents,
  type RawDuration,
  type RawRange,
  type RawScalingLevelDice,
  type RawTime,
  type SpellComponents,
  type SpellMaterial,
} from './spellText'
import { srdNameOf } from './srd'

/** The spell lists a spell is on, keyed by class source ("Wizard|XPHB"), never merged across editions. */
export interface SpellLists {
  /** Classes whose own list holds the spell: "Wizard|PHB", "Wizard|XPHB". */
  classes: string[]
  /** Optional additions (Tasha's and later): class key -> the books that add it. */
  variants: Record<string, string[]>
  /** Subclass lists (the third casters): "Fighter|XPHB|Eldritch Knight". */
  subclasses: string[]
}

export interface Spell {
  /** Lowercase "name|source". */
  key: string
  name: string
  source: string
  /** What the SRD calls the spell, when that is another name (full content only). */
  srdName?: string
  /** Other names the spell goes by (Fire Bolt: "Firebolt"). */
  aliases: string[]
  /** The rules edition of the book it is printed in. */
  edition: Edition
  /** 0 = cantrip. */
  level: number
  school: string
  ritual: boolean
  concentration: boolean
  /** "1 action", "1 reaction, which you take when ...", "1 minute". */
  casting: string
  /** Filter value: Action, Bonus action, Reaction, Minute, Hour, Other. */
  castingUnit: string
  /** Sort value: action 0, bonus 0.01, reaction 0.02, minute n, hour 60n. */
  castingMinutes: number
  /** "150 ft.", "Self (30-ft. cone)", "Touch", "Sight", "Unlimited", "Special". */
  range: string
  /** Sort value: self 0, touch 5, sight and unlimited last. */
  rangeFeet: number
  components: SpellComponents
  material?: SpellMaterial
  /** "Instantaneous", "Concentration, up to 1 minute", "1 hour", "Until dispelled". */
  duration: string
  /** Filter value: Instantaneous, Concentration, Timed, Permanent, Special. */
  durationKind: string
  /** The dice it rolls, "8d6", "1d6; 2d8"; "" when none. Its types are apart. */
  damage: string
  /** The average of its biggest roll (a scaling cantrip's first), to sort by; 0 when none. */
  damageAverage: number
  damageTypes: string[]
  /** "2d8 + spellcasting modifier", "Yes", or "". */
  healing: string
  /** Saving-throw abilities in full ("Dexterity"). */
  save: string[]
  attack: '' | 'Melee' | 'Ranged'
  conditions: string[]
  creatureTypes: string[]
  /** "30-ft. cone", "Sphere", "Single target"; "" when the data gives none. */
  area: string
  /** The decoded miscellaneous tags ("Teleportation", "Summons"). */
  tags: string[]
  /** "+1d6 per slot level above 3rd", "Yes" (see the description), or "". */
  upcast: string
  /** "1d6, 2d6 at 5, 3d6 at 11, 4d6 at 17", or "". */
  cantripScaling: string
  entries: Entry[]
  entriesHigherLevel?: Entry[]
  lists: SpellLists
}

interface SpellFile {
  spell?: RawSpell[]
}

interface RawSpell {
  name: string
  source: string
  level: number
  school: string
  alias?: string[]
  meta?: { ritual?: boolean }
  time?: RawTime[]
  range?: RawRange
  components?: RawComponents
  duration?: RawDuration[]
  entries?: Entry[]
  entriesHigherLevel?: Entry[]
  damageInflict?: string[]
  savingThrow?: string[]
  spellAttack?: string[]
  conditionInflict?: string[]
  affectsCreatureType?: string[]
  areaTags?: string[]
  miscTags?: string[]
  scalingLevelDice?: RawScalingLevelDice | RawScalingLevelDice[]
}

/**
 * spell-source lookup: source -> spellName -> where the spell is listed:
 * `class: {classSource: {ClassName: true}}`, `classVariant: {classSource:
 * {ClassName: {definedInSources}}}`, `subclass: {classSource: {ClassName:
 * {subclassSource: {shortName: {...}}}}}`.
 */
interface LookupEntry {
  class?: Record<string, Record<string, unknown>>
  classVariant?: Record<string, Record<string, { definedInSources?: string[] }>>
  subclass?: Record<string, Record<string, Record<string, Record<string, unknown>>>>
}
type SpellLookup = Record<string, Record<string, LookupEntry>>

export const SCHOOLS: Record<string, string> = {
  A: 'Abjuration',
  C: 'Conjuration',
  D: 'Divination',
  E: 'Enchantment',
  V: 'Evocation',
  I: 'Illusion',
  N: 'Necromancy',
  T: 'Transmutation',
  P: 'Psionic',
}

export function schoolName(code: string): string {
  return SCHOOLS[code] ?? code
}

/** Ordinal spell-level label, e.g. "Cantrip", "1st level", "3rd level". */
export function spellLevelLabel(level: number): string {
  return level === 0 ? 'Cantrip' : `${ordinal(level)} level`
}

/**
 * Whether the spell is on the caster's own list: the list of the class's own source
 * (never another edition's), an optional list (Tasha's and later) while the book
 * that defines it is selected, or the subclass's list for a third caster (of the class's
 * edition). The one
 * place "on the list" is decided.
 */
export function isOnClassList(
  spell: Spell,
  caster: { classKey: string; subclassKey?: string; edition?: Spell['edition'] },
  selectedBooks: string[],
): boolean {
  // The lookup puts a spell of either edition on both editions' subclass lists, so a
  // subclass list also asks that the spell is of the class's own edition.
  if (caster.subclassKey)
    return (
      spell.lists.subclasses.includes(caster.subclassKey) &&
      (caster.edition === undefined || spell.edition === caster.edition)
    )
  if (spell.lists.classes.includes(caster.classKey)) return true
  return (spell.lists.variants[caster.classKey] ?? []).some((book) =>
    selectedBooks.includes(book),
  )
}

/** The lists the lookup puts a spell on, per class source. */
function listsFor(entry: LookupEntry | undefined): SpellLists {
  const classes: string[] = []
  for (const [classSource, byClass] of Object.entries(entry?.class ?? {}))
    for (const className of Object.keys(byClass))
      classes.push(`${className}|${classSource}`)

  const variants: Record<string, string[]> = {}
  for (const [classSource, byClass] of Object.entries(entry?.classVariant ?? {}))
    for (const [className, variant] of Object.entries(byClass))
      variants[`${className}|${classSource}`] = variant.definedInSources ?? []

  const subclasses: string[] = []
  for (const [classSource, byClass] of Object.entries(entry?.subclass ?? {}))
    for (const [className, bySource] of Object.entries(byClass))
      for (const byShortName of Object.values(bySource))
        for (const shortName of Object.keys(byShortName))
          subclasses.push(`${className}|${classSource}|${shortName}`)

  return { classes: classes.sort(), variants, subclasses: subclasses.sort() }
}

/** Load every spell with its facts read and its class lists attached. */
export const loadSpells = memoizeContent(async (): Promise<Spell[]> => {
  const index = await fetchData<Record<string, string>>('spells/index.json')
  const lookup = await fetchData<SpellLookup>(
    'generated/gendata-spell-source-lookup.json',
  )
  const editionOfBook = await loadBookEditions()

  const files = await Promise.all(
    Object.values(index).map((file) => fetchData<SpellFile>(`spells/${file}`)),
  )

  const spells: Spell[] = []
  for (const file of files) {
    for (const raw of file.spell ?? []) {
      const scales = raw.level === 0 && raw.scalingLevelDice !== undefined
      const damage = damageOf(raw.entries, raw.damageInflict, scales)
      spells.push({
        key: `${raw.name}|${raw.source}`.toLowerCase(),
        name: raw.name,
        source: raw.source,
        srdName: srdNameOf(raw),
        aliases: raw.alias ?? [],
        edition: editionOfBook(raw.source),
        level: raw.level,
        school: raw.school,
        ritual: raw.meta?.ritual === true,
        concentration: (raw.duration ?? []).some((d) => d?.concentration === true),
        casting: timeText(raw.time),
        castingUnit: castingUnitOf(raw.time),
        castingMinutes: castingMinutesOf(raw.time),
        range: rangeText(raw.range),
        rangeFeet: rangeFeetOf(raw.range),
        components: componentsOf(raw.components),
        material: materialOf(raw.components),
        duration: durationText(raw.duration),
        durationKind: durationKindOf(raw.duration),
        damage: damage.text,
        damageAverage: damage.average,
        damageTypes: damage.types,
        healing: healingOf(raw.entries, raw.miscTags),
        save: (raw.savingThrow ?? []).map(titleCase),
        attack: attackOf(raw.spellAttack),
        conditions: (raw.conditionInflict ?? []).map(titleCase),
        creatureTypes: (raw.affectsCreatureType ?? []).map(titleCase),
        area: areaOf(raw.range, raw.areaTags),
        tags: tagsOf(raw.miscTags),
        upcast: upcastOf(raw.entriesHigherLevel),
        cantripScaling: cantripScalingOf(raw.scalingLevelDice),
        entries: raw.entries ?? [],
        entriesHigherLevel: raw.entriesHigherLevel,
        lists: listsFor(lookup[raw.source.toLowerCase()]?.[raw.name.toLowerCase()]),
      })
    }
  }
  spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  return spells
})

/** Reset the module cache (tests). */
export function _clearSpellCache(): void {
  loadSpells.clear()
}
