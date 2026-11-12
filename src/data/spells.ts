// Spell data: load every spell file, read its facts into text (see spellText),
// and attach the class spell lists from the generated spell-source lookup (spell
// entries carry no `classes` field in current 5etools data). A class list is the
// list of one class source, so a 2014 Wizard and a 2024 Wizard keep their own.

import { memoizeContent } from '../content/epoch'
import { titleCase } from '../text/titleCase'
import type { Entry } from '../text/Entries'
import { fetchData } from './dataClient'
import { loadBookEditions, type Edition } from './edition'
import { editionYear } from './labels'
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
  /**
   * Of those, the lists that hold it only where a book defines it (Booming Blade on
   * the Wizard list, from SCAG): class key -> those books.
   */
  definedIn?: Record<string, string[]>
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
 * `class: {classSource: {ClassName: true | {definedInSources}}}`, `classVariant: {classSource:
 * {ClassName: {definedInSources}}}`, `subclass: {classSource: {ClassName:
 * {subclassSource: {shortName: {...}}}}}`.
 */
interface LookupEntry {
  class?: Record<string, Record<string, true | { definedInSources?: string[] }>>
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

/** A caster as the lists see it: its class, its casting subclass, its edition. */
export interface ListCaster {
  classKey: string
  subclassKey?: string
  edition?: Spell['edition']
}

/** How a caster has a spell: from one of its lists, or always prepared or known. */
export type SpellAccess =
  | 'class list'
  | 'optional list'
  | 'subclass list'
  | 'expanded list'
  | 'always prepared'
  | 'always known'

/** What a source gives a class beyond its lists: a spell added to it, or one it always has. */
export type GrantedAccess = Extract<
  SpellAccess,
  'expanded list' | 'always prepared' | 'always known'
>

/** Which of the caster's own lists holds the spell, if any. */
function listAccess(
  spell: Pick<Spell, 'lists' | 'edition'>,
  caster: ListCaster,
  selectedBooks: string[],
): SpellAccess | undefined {
  const selected = (books: string[] | undefined) =>
    (books ?? []).some((book) => selectedBooks.includes(book))
  // The lookup puts a spell of either edition on both editions' subclass lists, so a
  // subclass list also asks that the spell is of the class's own edition.
  if (caster.subclassKey)
    return spell.lists.subclasses.includes(caster.subclassKey) &&
      (caster.edition === undefined || spell.edition === caster.edition)
      ? 'subclass list'
      : undefined
  const definedIn = spell.lists.definedIn?.[caster.classKey]
  if (
    spell.lists.classes.includes(caster.classKey) &&
    (!definedIn || selected(definedIn))
  )
    return 'class list'
  return selected(spell.lists.variants[caster.classKey]) ? 'optional list' : undefined
}

/**
 * Whether the spell is on the caster's own list: the list of the class's own source
 * (never another edition's) where no book conditions it or that book is selected, an
 * optional list (Tasha's and later) while the book that defines it is selected, or the
 * subclass's list for a third caster (of the class's edition). The one place "on the
 * list" is decided.
 */
export function isOnClassList(
  spell: Pick<Spell, 'lists' | 'edition'>,
  caster: ListCaster,
  selectedBooks: string[],
): boolean {
  return listAccess(spell, caster, selectedBooks) !== undefined
}

/** Where a spell stands for a caster. */
export type ListStanding =
  /** On one of its lists, or added to it by a source. */
  | { kind: 'listed'; access: SpellAccess }
  /** Always prepared or known through a source. */
  | { kind: 'granted'; access: GrantedAccess }
  /** Not this printing, but the caster has the other edition's, in this way. */
  | { kind: 'printing'; twin: Spell; access: SpellAccess }
  | { kind: 'off' }

export interface StandingContext {
  selectedBooks: string[]
  /** Every spell by lower case name, to find the other edition's printing. */
  byName: Map<string, Spell[]>
  /** What the character's sources give this class: a spell added to its list, or one it always has. */
  granted?: (spell: Spell) => GrantedAccess | undefined
}

/**
 * Where a spell stands for a caster: on its list, always had, the other edition's
 * printing of one it has (a 2014 Druid's Circle gives the 2014 Guiding Bolt), or off
 * its list. A caster has a spell when one of its lists holds it or a source gives it.
 */
export function listStanding(
  spell: Spell,
  caster: ListCaster,
  { selectedBooks, byName, granted }: StandingContext,
): ListStanding {
  const accessOf = (s: Spell) => listAccess(s, caster, selectedBooks) ?? granted?.(s)
  const own = granted?.(spell)
  if (own && own !== 'expanded list') return { kind: 'granted', access: own }
  const access = accessOf(spell)
  if (access) return { kind: 'listed', access }
  for (const twin of byName.get(spell.name.toLowerCase()) ?? []) {
    if (twin.edition === spell.edition || !selectedBooks.includes(twin.source)) continue
    const had = accessOf(twin)
    if (had) return { kind: 'printing', twin, access: had }
  }
  return { kind: 'off' }
}

/**
 * What is wrong with a spell's standing, in words naming the class's edition, or
 * undefined when the caster has it: "2024 printing - your 2014 Druid has the 2014 one
 * (always prepared)", "Not on the 2014 Druid list".
 */
export function standingProblem(
  standing: ListStanding,
  spell: Spell,
  caster: { name: string; edition?: Spell['edition'] },
): string | undefined {
  const yours = `${editionYear(caster.edition)} ${caster.name}`
  if (standing.kind === 'printing')
    return `${editionYear(spell.edition)} printing - your ${yours} has the ${editionYear(standing.twin.edition)} one (${standing.access})`
  if (standing.kind === 'off') return `Not on the ${yours} list`
  return undefined
}

/** The lists the lookup puts a spell on, per class source. */
function listsFor(entry: LookupEntry | undefined): SpellLists {
  const classes: string[] = []
  const definedIn: Record<string, string[]> = {}
  for (const [classSource, byClass] of Object.entries(entry?.class ?? {}))
    for (const [className, listed] of Object.entries(byClass)) {
      const key = `${className}|${classSource}`
      classes.push(key)
      if (listed !== true && listed.definedInSources)
        definedIn[key] = listed.definedInSources
    }

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

  return { classes: classes.sort(), definedIn, variants, subclasses: subclasses.sort() }
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
