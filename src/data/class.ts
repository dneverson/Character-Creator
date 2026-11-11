// Class data: loading and resolving the normalized 5etools class format.
// `classFeatures` are string refs ("Rage|Barbarian||1") resolved against the
// file's top-level `classFeature[]`; subclasses work the same way.

import type { AbilityKey } from '../dice/dice'
import { fetchData } from './dataClient'
import type { Entry } from '../text/Entries'
import type { ClassRef } from '../character/model'

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
export interface OptionalFeatureProgression {
  name: string
  featureType: string[]
  /** Class level -> how many are known at that level ("1": 1). */
  progression: Record<string, number>
}

export interface ClassEntry extends SpellcastingFields {
  name: string
  source: string
  edition?: 'classic' | 'one'
  page?: number
  /** Optional: reprints and partial `_copy` stubs in the source data omit it. */
  hd?: HitDice
  /** Saving-throw proficiency abilities. */
  proficiency?: string[]
  startingProficiencies?: StartingProficiencies
  startingEquipment?: ClassStartingEquipment
  classFeatures: ClassFeatureRef[]
  optionalfeatureProgression?: OptionalFeatureProgression[]
  classTableGroups?: ClassTableGroup[]
  multiclassing?: Multiclassing
  subclassTitle?: string
}

/** Display label for a class hit die, e.g. "d10". Entries without a hit die
 * (reprints / partial `_copy` stubs) render as an em dash. */
export function hitDieLabel(entry: ClassEntry): string {
  return entry.hd ? `d${entry.hd.faces}` : '-'
}

export interface ClassFeatureEntry {
  name: string
  source: string
  className: string
  classSource: string
  level: number
  entries: Entry[]
}

export interface SubclassEntry extends SpellcastingFields {
  name: string
  shortName: string
  source: string
  className: string
  classSource: string
  edition?: 'classic' | 'one'
  subclassFeatures: string[]
  optionalfeatureProgression?: OptionalFeatureProgression[]
}

export interface SubclassFeatureEntry {
  name: string
  source: string
  className: string
  classSource: string
  subclassShortName: string
  subclassSource: string
  level: number
  entries: Entry[]
}

export interface ClassFile {
  class?: ClassEntry[]
  subclass?: SubclassEntry[]
  classFeature?: ClassFeatureEntry[]
  subclassFeature?: SubclassFeatureEntry[]
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
    Object.values(index).map((f) => fetchData<ClassFile>(`class/${f}`)),
  )
  const out: LoadedClass[] = []
  for (const file of files) {
    for (const entry of file.class ?? []) out.push({ entry, file })
  }
  out.sort((a, b) => a.entry.name.localeCompare(b.entry.name))
  return out
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
}

function parseFeatureRef(ref: string, defaultSource: string): ParsedRef {
  const [name = '', className = '', classSource = '', level = '1'] = ref.split('|')
  return {
    name,
    className,
    classSource: classSource || defaultSource,
    level: Number(level) || 1,
  }
}

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

  for (const item of entry.classFeatures) {
    const isSubclassSlot = typeof item === 'object' && item.gainSubclassFeature === true
    const ref = typeof item === 'string' ? item : item.classFeature
    const parsed = parseFeatureRef(ref, entry.source)

    if (isSubclassSlot) {
      add(parsed.level, {
        name: `${entry.subclassTitle ?? 'Subclass'} Feature`,
        level: parsed.level,
        entries: [],
        isSubclassSlot: true,
      })
      continue
    }

    const match = pool.find(
      (f) =>
        f.name === parsed.name &&
        f.level === parsed.level &&
        f.classSource === parsed.classSource,
    )
    if (match) {
      add(parsed.level, { name: match.name, level: match.level, entries: match.entries })
    } else {
      add(parsed.level, { name: parsed.name, level: parsed.level, entries: [] })
    }
  }

  return byLevel
}

function parseSubclassFeatureRef(ref: string, defaultClassSource: string) {
  const parts = ref.split('|')
  return {
    name: parts[0] ?? '',
    className: parts[1] ?? '',
    classSource: parts[2] || defaultClassSource,
    subclassShortName: parts[3] ?? '',
    subclassSource: parts[4] || defaultClassSource,
    level: Number(parts[5]) || 1,
  }
}

/** Resolve a subclass's features into a level-indexed list. */
export function resolveSubclassFeatures(
  file: ClassFile,
  subclass: SubclassEntry,
): Map<number, ResolvedFeature[]> {
  const pool = file.subclassFeature ?? []
  const byLevel = new Map<number, ResolvedFeature[]>()
  for (const ref of subclass.subclassFeatures) {
    const parsed = parseSubclassFeatureRef(ref, subclass.classSource)
    const match = pool.find(
      (f) =>
        f.name === parsed.name &&
        f.level === parsed.level &&
        f.subclassShortName === parsed.subclassShortName,
    )
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
  for (const item of loaded.entry.classFeatures) {
    if (typeof item === 'object' && item.gainSubclassFeature === true) {
      const parsed = parseFeatureRef(item.classFeature, loaded.entry.source)
      if (parsed.level < min) min = parsed.level
    }
  }
  return Number.isFinite(min) ? min : 1
}

/** Subclasses available for a given class entry (matched by name + edition). */
export function subclassesFor(loaded: LoadedClass): SubclassEntry[] {
  const { entry, file } = loaded
  return (file.subclass ?? []).filter(
    (s) =>
      s.className === entry.name &&
      s.classSource === entry.source &&
      (entry.edition ? s.edition === entry.edition : true),
  )
}

/** A class's features up to its level, with the chosen subclass's features in place. */
export function featuresForClass(loaded: LoadedClass, cls: ClassRef): ResolvedFeature[] {
  const classFeatures = resolveClassFeatures(loaded)
  const useSubclass = cls.subclass
    ? subclassesFor(loaded).find(
        (s) =>
          s.shortName === cls.subclass!.shortName && s.source === cls.subclass!.source,
      )
    : undefined
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
