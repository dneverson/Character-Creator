// Class data: loading and resolving the normalized 5etools class format.
// `classFeatures` are string refs ("Rage|Barbarian||1") resolved against the
// file's top-level `classFeature[]`; subclasses work the same way. A class or
// subclass with `_copy` (a reprint, or one book's version of another's subclass)
// is resolved against its original when the files load, so every record a
// caller sees is complete.

import type { AbilityKey } from '../dice/dice'
import { fetchData } from './dataClient'
import { resolveCopy, type Copyable, type CopyRef } from './copy'
import type { Entry } from '../text/Entries'
import type { ClassRef } from '../character/model'
import type { OptionalFeatureProgression } from './classOptions'

export interface HitDice {
  number: number
  faces: number
}

export interface SkillChoice {
  choose?: { from: string[]; count?: number }
}

export interface StartingProficiencies {
  skills?: SkillChoice[]
  armor?: unknown[]
  weapons?: unknown[]
  tools?: unknown[]
  /** The same lists as blocks (`{ light: true }`), where the data has them. */
  armorProficiencies?: unknown[]
  weaponProficiencies?: unknown[]
  toolProficiencies?: unknown[]
}

export interface Multiclassing {
  requirements?: MulticlassRequirements
  proficienciesGained?: StartingProficiencies
}

/** e.g. { str: 13 } or { or: [{ str: 13 }, { dex: 13 }] }. */
export type MulticlassRequirements = Partial<Record<AbilityKey, number>> & {
  or?: Partial<Record<AbilityKey, number>>[]
}

export type ClassFeatureRef =
  string | { classFeature: string; gainSubclassFeature?: boolean }

export interface ClassTableGroup {
  title?: string
  colLabels?: string[]
  rows?: Entry[][]
  /** Spell-slot progression tables use this instead of `rows`. */
  rowsSpellProgression?: Entry[][]
}

/**
 * How a class, or a subclass that casts (Eldritch Knight, Arcane Trickster),
 * casts spells. A class with no subclass casting carries these itself.
 */
export interface SpellcastingFields {
  spellcastingAbility?: string
  /** 'full' | '1/2' | '1/3' | 'artificer' | 'pact'; absent for non-casters. */
  casterProgression?: string
  /** Cantrips known indexed by class level - 1. */
  cantripProgression?: number[]
  /** Spells known indexed by class level - 1 (2014 known casters). */
  spellsKnownProgression?: number[]
  /** Prepared-spells formula, e.g. "<$level$> + <$wis_mod$>" (2014 prepared casters). */
  preparedSpells?: string
  /** Spells prepared indexed by class level - 1 (every 2024 caster). */
  preparedSpellsProgression?: number[]
  /** Spells added to the spellbook per level gained (the Wizard: 6, then 2 a level). */
  spellsKnownProgressionFixed?: number[]
  /** When the prepared list can change: after a long rest, or on gaining a level. */
  preparedSpellsChange?: 'restLong' | 'level'
  /** Spells always known or prepared, and list additions (domain, oath and the like). */
  additionalSpells?: unknown[]
}

/** What a class starts with: blocks of fixed gear and options, and (2014) a gold roll. */
export interface ClassStartingEquipment {
  defaultData?: unknown[]
  goldAlternative?: unknown
}

/** The optional features a class (or subclass) gives, and how many by class level. */
export type { OptionalFeatureProgression }

export interface ClassEntry extends SpellcastingFields, Copyable {
  name: string
  source: string
  edition?: 'classic' | 'one'
  page?: number
  /** Optional: the sidekicks (TCE) level by the creature's own hit dice. */
  hd?: HitDice
  /** Saving-throw proficiency abilities. */
  proficiency?: string[]
  startingProficiencies?: StartingProficiencies
  startingEquipment?: ClassStartingEquipment
  /** Absent on a class the data gives no features. */
  classFeatures?: ClassFeatureRef[]
  optionalfeatureProgression?: OptionalFeatureProgression[]
  classTableGroups?: ClassTableGroup[]
  multiclassing?: Multiclassing
  /** 2024: the abilities the class relies on most. The options are alternatives
   * (Fighter: `[{ str: true }, { dex: true }]`); one option's abilities are all
   * needed (Monk: `[{ dex: true, wis: true }]`). */
  primaryAbility?: Partial<Record<AbilityKey, true>>[]
  subclassTitle?: string
}

/** The score a 2024 multiclass needs in each primary ability. */
const PRIMARY_ABILITY_MIN = 13

/**
 * The ability scores multiclassing into or out of a class needs, in the form
 * `meetsRequirements` reads ("or" lists the alternatives). 2014: the class's
 * `multiclassing.requirements`, where the abilities of one "or" group are
 * alternatives (Fighter: Strength 13 or Dexterity 13). 2024: 13 in the primary
 * ability (Fighter: Strength or Dexterity; Monk: Dexterity and Wisdom).
 */
export function multiclassRequirements(
  entry: ClassEntry,
): MulticlassRequirements | undefined {
  const req = entry.multiclassing?.requirements
  if (req) {
    const { or, ...direct } = req
    if (!or?.length) return req
    // Each group is met by any one of its abilities, and every group is needed.
    const options = or.reduce<Partial<Record<AbilityKey, number>>[]>(
      (acc, group) =>
        acc.flatMap((option) =>
          (Object.entries(group) as [AbilityKey, number][]).map(([ability, min]) => ({
            ...option,
            [ability]: min,
          })),
        ),
      [{}],
    )
    return { ...direct, or: options }
  }
  if (entry.edition !== 'one' || !entry.primaryAbility?.length) return undefined
  const options = entry.primaryAbility.map((primary) => {
    const option: Partial<Record<AbilityKey, number>> = {}
    for (const ability of Object.keys(primary) as AbilityKey[]) {
      option[ability] = PRIMARY_ABILITY_MIN
    }
    return option
  })
  return options.length === 1 ? options[0] : { or: options }
}

/** Display label for a class hit die, e.g. "d10"; a class without one shows a hyphen. */
export function hitDieLabel(entry: ClassEntry): string {
  return entry.hd ? `d${entry.hd.faces}` : '-'
}

/** A class feature as the data has it; a `_copy` one inherits its text. */
interface ClassFeatureRecord extends Copyable {
  name: string
  source: string
  className: string
  classSource: string
  level: number
  entries?: Entry[]
}

export interface ClassFeatureEntry extends ClassFeatureRecord {
  entries: Entry[]
}

/** A subclass as the data has it; a `_copy` one inherits its features. */
interface SubclassRecord extends SpellcastingFields, Copyable {
  name: string
  shortName: string
  source: string
  className: string
  classSource: string
  edition?: 'classic' | 'one'
  subclassFeatures?: string[]
  /** The level table of a subclass that casts (Eldritch Knight, Arcane Trickster). */
  subclassTableGroups?: ClassTableGroup[]
  optionalfeatureProgression?: OptionalFeatureProgression[]
}

export interface SubclassEntry extends SubclassRecord {
  subclassFeatures: string[]
}

/** A subclass feature as the data has it; a `_copy` one inherits its text. */
interface SubclassFeatureRecord extends Copyable {
  name: string
  source: string
  className: string
  classSource: string
  subclassShortName: string
  subclassSource: string
  level: number
  entries?: Entry[]
}

export interface SubclassFeatureEntry extends SubclassFeatureRecord {
  entries: Entry[]
}

/** A class file with its `_copy` records resolved (`resolveClassFiles`). */
export interface ClassFile {
  class?: ClassEntry[]
  subclass?: SubclassEntry[]
  classFeature?: ClassFeatureEntry[]
  subclassFeature?: SubclassFeatureEntry[]
}

/** A class file as the data has it, where a `_copy` record lacks what it inherits. */
export interface RawClassFile {
  class?: ClassEntry[]
  subclass?: SubclassRecord[]
  classFeature?: ClassFeatureRecord[]
  subclassFeature?: SubclassFeatureRecord[]
}

/** A class entry together with the file it came from (for feature resolution). */
export interface LoadedClass {
  entry: ClassEntry
  file: ClassFile
}

type ClassIndex = Record<string, string>

async function loadClassIndex(): Promise<ClassIndex> {
  return fetchData<ClassIndex>('class/index.json')
}

/** Load every class entry (both editions) with its owning file. */
export async function loadClasses(): Promise<LoadedClass[]> {
  const index = await loadClassIndex()
  const files = await Promise.all(
    Object.values(index).map((f) => fetchData<RawClassFile>(`class/${f}`)),
  )
  const out: LoadedClass[] = []
  for (const file of resolveClassFiles(files)) {
    for (const entry of file.class ?? []) out.push({ entry, file })
  }
  out.sort((a, b) => a.entry.name.localeCompare(b.entry.name))
  return out
}

/**
 * The class files with every `_copy` record resolved against its original: a class
 * (the Priest copies the Cleric), a subclass (a book's version of another class's)
 * and a feature. The original may sit in another file. A file also gets the
 * features its records name that live in another file, so every record's features
 * resolve from its own file. The given files are not changed.
 */
export function resolveClassFiles(files: readonly RawClassFile[]): ClassFile[] {
  const findClass = copyFinder(files.flatMap((f) => f.class ?? []))
  const findSubclass = copyFinder(files.flatMap((f) => f.subclass ?? []))
  const findClassFeature = copyFinder(files.flatMap((f) => f.classFeature ?? []))
  const findSubclassFeature = copyFinder(files.flatMap((f) => f.subclassFeature ?? []))
  // A copy whose original is missing from the data keeps only its own fields.
  const ownFeatures = files.map((file) => ({
    classFeature: (file.classFeature ?? []).map((f) => {
      const resolved = resolveCopy(f, findClassFeature)
      return { ...resolved, entries: resolved.entries ?? [] }
    }),
    subclassFeature: (file.subclassFeature ?? []).map((f) => {
      const resolved = resolveCopy(f, findSubclassFeature)
      return { ...resolved, entries: resolved.entries ?? [] }
    }),
  }))
  const classPool = ownFeatures.flatMap((f) => f.classFeature)
  const subclassPool = ownFeatures.flatMap((f) => f.subclassFeature)
  return files.map((file, i) => {
    const ownClasses = file.class?.map((c) => resolveCopy(c, findClass))
    const ownSubclasses = file.subclass?.map((s) => {
      const resolved = resolveCopy(s, findSubclass)
      return { ...resolved, subclassFeatures: resolved.subclassFeatures ?? [] }
    })
    const classFeature = withBorrowed(
      ownFeatures[i].classFeature,
      classPool,
      (ownClasses ?? []).flatMap((c) => (c.classFeatures ?? []).map(classFeatureRefOf)),
      (f, ref) => isClassFeature(f, parseFeatureRef(ref)),
    )
    const subclassFeature = withBorrowed(
      ownFeatures[i].subclassFeature,
      subclassPool,
      (ownSubclasses ?? []).flatMap((s) => s.subclassFeatures),
      (f, ref) => isSubclassFeature(f, parseSubclassFeatureRef(ref)),
    )
    return {
      ...(ownClasses && { class: ownClasses }),
      ...(ownSubclasses && { subclass: ownSubclasses }),
      ...(classFeature.length > 0 && { classFeature }),
      ...(subclassFeature.length > 0 && { subclassFeature }),
    }
  })
}

/** What names a class record beyond its name and source, as a `_copy` gives it. */
const COPY_IDENTITY = [
  'className',
  'classSource',
  'shortName',
  'subclassShortName',
  'subclassSource',
  'level',
] as const

/**
 * Finds the original a `_copy` names among the records: by name and source, and
 * by the class, subclass and level the reference also names (two classes may
 * each have a "Hunter" subclass, and the features of one subclass share a book).
 */
function copyFinder<T extends Copyable>(records: readonly T[]) {
  return (name: string, source: string, ref: CopyRef) =>
    records.find(
      (r) =>
        r.name === name &&
        r.source === source &&
        COPY_IDENTITY.every((key) => !(key in ref) || r[key] === ref[key]),
    )
}

/** A file's own features, then each named one it lacks, found in every file. */
function withBorrowed<F>(
  own: readonly F[],
  all: readonly F[],
  refs: readonly string[],
  matches: (feature: F, ref: string) => boolean,
): F[] {
  const borrowed = new Set<F>()
  for (const ref of refs) {
    if (own.some((f) => matches(f, ref))) continue
    const found = all.find((f) => matches(f, ref))
    if (found) borrowed.add(found)
  }
  return [...own, ...borrowed]
}

// ---- Feature resolution ---------------------------------------------------

export interface ResolvedFeature {
  name: string
  level: number
  entries: Entry[]
  /** A marker slot for a subclass feature gained at this level. */
  isSubclassSlot?: boolean
}

interface ParsedRef {
  name: string
  className: string
  classSource: string
  level: number
  /** The feature's own source, when the ref names one. */
  source?: string
}

/** The book a feature ref means when it leaves a source out, as 5etools reads it. */
const DEFAULT_REF_SOURCE = 'PHB'

const classFeatureRefOf = (item: ClassFeatureRef) =>
  typeof item === 'string' ? item : item.classFeature

/** A class feature ref, "Rage|Barbarian|XPHB|1": the class source, and the
 * feature's own source after the level, are optional. */
function parseFeatureRef(ref: string): ParsedRef {
  const [name = '', className = '', classSource = '', level = '1', source = ''] =
    ref.split('|')
  return {
    name,
    className,
    classSource: classSource || DEFAULT_REF_SOURCE,
    level: Number(level) || 1,
    ...(source && { source }),
  }
}

/** Whether a pool feature is the one a ref names, by its whole identity. */
const isClassFeature = (f: ClassFeatureEntry, ref: ParsedRef) =>
  f.name === ref.name &&
  f.className === ref.className &&
  f.classSource === ref.classSource &&
  f.level === ref.level &&
  (ref.source === undefined || f.source === ref.source)

/** Resolve a class's features into a level-indexed list (levels 1..20). */
export function resolveClassFeatures(
  loaded: LoadedClass,
): Map<number, ResolvedFeature[]> {
  const { entry, file } = loaded
  const pool = file.classFeature ?? []
  const byLevel = new Map<number, ResolvedFeature[]>()

  const add = (level: number, feature: ResolvedFeature) => {
    const list = byLevel.get(level) ?? []
    list.push(feature)
    byLevel.set(level, list)
  }

  for (const item of entry.classFeatures ?? []) {
    const isSubclassSlot = typeof item === 'object' && item.gainSubclassFeature === true
    const parsed = parseFeatureRef(classFeatureRefOf(item))

    if (isSubclassSlot) {
      add(parsed.level, {
        name: `${entry.subclassTitle ?? 'Subclass'} Feature`,
        level: parsed.level,
        entries: [],
        isSubclassSlot: true,
      })
      continue
    }

    const match = pool.find((f) => isClassFeature(f, parsed))
    if (match) {
      add(parsed.level, { name: match.name, level: match.level, entries: match.entries })
    } else {
      add(parsed.level, { name: parsed.name, level: parsed.level, entries: [] })
    }
  }

  return byLevel
}

/** A subclass feature ref, "Frenzy|Barbarian||Berserker||3" (sources optional). */
function parseSubclassFeatureRef(ref: string) {
  const parts = ref.split('|')
  return {
    name: parts[0] ?? '',
    className: parts[1] ?? '',
    classSource: parts[2] || DEFAULT_REF_SOURCE,
    subclassShortName: parts[3] ?? '',
    subclassSource: parts[4] || DEFAULT_REF_SOURCE,
    level: Number(parts[5]) || 1,
  }
}

/** Whether a pool feature is the one a ref names, by its whole identity: the 2014
 * and 2024 versions of a subclass share feature names and levels. */
const isSubclassFeature = (
  f: SubclassFeatureEntry,
  ref: ReturnType<typeof parseSubclassFeatureRef>,
) =>
  f.name === ref.name &&
  f.className === ref.className &&
  f.classSource === ref.classSource &&
  f.subclassShortName === ref.subclassShortName &&
  f.subclassSource === ref.subclassSource &&
  f.level === ref.level

/** Resolve a subclass's features into a level-indexed list. */
export function resolveSubclassFeatures(
  file: ClassFile,
  subclass: SubclassEntry,
): Map<number, ResolvedFeature[]> {
  const pool = file.subclassFeature ?? []
  const byLevel = new Map<number, ResolvedFeature[]>()
  for (const ref of subclass.subclassFeatures) {
    const parsed = parseSubclassFeatureRef(ref)
    const match = pool.find((f) => isSubclassFeature(f, parsed))
    const list = byLevel.get(parsed.level) ?? []
    list.push({
      name: match?.name ?? parsed.name,
      level: parsed.level,
      entries: match?.entries ?? [],
    })
    byLevel.set(parsed.level, list)
  }
  return byLevel
}

/**
 * The class level at which the subclass is chosen - the first level that grants
 * a subclass feature (`gainSubclassFeature`). Paladins pick at 3, Clerics at 1,
 * Wizards at 2, etc. Falls back to 1 if the class carries no such marker.
 */
export function subclassUnlockLevel(loaded: LoadedClass): number {
  let min = Number.POSITIVE_INFINITY
  for (const item of loaded.entry.classFeatures ?? []) {
    if (typeof item === 'object' && item.gainSubclassFeature === true) {
      const parsed = parseFeatureRef(item.classFeature)
      if (parsed.level < min) min = parsed.level
    }
  }
  return Number.isFinite(min) ? min : 1
}

/**
 * Subclasses available for a given class entry: its own, but not one marked for
 * the other edition (a 2014 subclass the data also lists under the 2024 class).
 * A subclass the data marks with no edition (the 2024 Artificer's) is the class's.
 */
export function subclassesFor(loaded: LoadedClass): SubclassEntry[] {
  const { entry, file } = loaded
  return (file.subclass ?? []).filter(
    (s) =>
      s.className === entry.name &&
      s.classSource === entry.source &&
      (!entry.edition || !s.edition || s.edition === entry.edition),
  )
}

/** The subclass a character's class names, among those its class offers. */
export function subclassOf(
  loaded: LoadedClass,
  chosen: { shortName: string; source: string } | undefined,
): SubclassEntry | undefined {
  if (!chosen) return undefined
  return subclassesFor(loaded).find(
    (s) => s.shortName === chosen.shortName && s.source === chosen.source,
  )
}

/** A class's features up to its level, with the chosen subclass's features in place. */
export function featuresForClass(loaded: LoadedClass, cls: ClassRef): ResolvedFeature[] {
  const classFeatures = resolveClassFeatures(loaded)
  const useSubclass = subclassOf(loaded, cls.subclass)
  const subFeatures = useSubclass
    ? resolveSubclassFeatures(loaded.file, useSubclass)
    : undefined

  const out: ResolvedFeature[] = []
  for (let level = 1; level <= cls.level; level++) {
    for (const f of classFeatures.get(level) ?? []) {
      // Skip the placeholder slot if we have real subclass features to show.
      if (f.isSubclassSlot && subFeatures) continue
      out.push(f)
    }
    for (const f of subFeatures?.get(level) ?? []) out.push(f)
  }
  return out
}
