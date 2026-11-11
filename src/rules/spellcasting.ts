// Spellcasting rules: determine each class's caster kind (known vs prepared),
// its cantrip / known / prepared counts, and the character's spell slots
// (standard multiclass table plus Warlock Pact Magic). RAW by default; the UI
// flags anything the player pushes past these limits.

import { type AbilityKey } from '../dice/dice'
import type { ClassEntry, SpellcastingFields, SubclassEntry } from '../data/class'

export type CasterKind = 'none' | 'known' | 'prepared'

/** Standard multiclass / full-caster slot table, indexed by caster level - 1. */
// prettier-ignore
const FULL_SLOTS: number[][] = [
  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
]

/** Single-class half-caster slot table (Paladin / Ranger), indexed by level - 1. */
// prettier-ignore
const HALF_SLOTS: number[][] = [
  [0, 0, 0, 0, 0],
  [2, 0, 0, 0, 0],
  [3, 0, 0, 0, 0],
  [3, 0, 0, 0, 0],
  [4, 2, 0, 0, 0],
  [4, 2, 0, 0, 0],
  [4, 3, 0, 0, 0],
  [4, 3, 0, 0, 0],
  [4, 3, 2, 0, 0],
  [4, 3, 2, 0, 0],
  [4, 3, 3, 0, 0],
  [4, 3, 3, 0, 0],
  [4, 3, 3, 1, 0],
  [4, 3, 3, 1, 0],
  [4, 3, 3, 2, 0],
  [4, 3, 3, 2, 0],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2],
]

/** Single-class third-caster slot table (Eldritch Knight, Arcane Trickster), indexed by level - 1. */
// prettier-ignore
const THIRD_SLOTS: number[][] = [
  [0, 0, 0, 0], [0, 0, 0, 0], [2, 0, 0, 0], [3, 0, 0, 0], [3, 0, 0, 0],
  [3, 0, 0, 0], [4, 2, 0, 0], [4, 2, 0, 0], [4, 2, 0, 0], [4, 3, 0, 0],
  [4, 3, 0, 0], [4, 3, 0, 0], [4, 3, 2, 0], [4, 3, 2, 0], [4, 3, 2, 0],
  [4, 3, 3, 0], [4, 3, 3, 0], [4, 3, 3, 0], [4, 3, 3, 1], [4, 3, 3, 1],
]

/** Warlock Pact Magic, indexed by level - 1: [slotCount, slotLevel]. */
// prettier-ignore
const PACT: [number, number][] = [
  [1, 1], [2, 1], [2, 2], [2, 2], [2, 3], [2, 3], [2, 4], [2, 4], [2, 5], [2, 5],
  [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [4, 5], [4, 5], [4, 5], [4, 5],
]

function clampLevel(level: number): number {
  return Math.max(1, Math.min(20, Math.floor(level)))
}

/** A class's contribution to the combined multiclass caster level. */
export function casterLevelContribution(progression: string, level: number): number {
  const l = Math.max(0, Math.floor(level))
  switch (progression) {
    case 'full':
      return l
    case 'artificer':
      return Math.ceil(l / 2)
    case '1/2':
      return Math.floor(l / 2)
    case '1/3':
      return Math.floor(l / 3)
    default:
      return 0 // pact / none don't add to the standard table
  }
}

export interface SpellClassInput {
  entry: ClassEntry
  level: number
  /** Modifier of the class's spellcasting ability (for prepared counts). */
  abilityMod: number
  /** The chosen subclass; when it casts (Eldritch Knight) it supplies the casting. */
  subclass?: SubclassEntry
}

export interface ClassCaster {
  classKey: string
  /** The class, with a casting subclass in brackets: "Fighter (Eldritch Knight)". */
  name: string
  source: string
  level: number
  /** "Fighter|XPHB|Eldritch Knight" when a subclass does the casting: its list key. */
  subclassKey?: string
  ability?: AbilityKey
  progression: string
  kind: CasterKind
  isPact: boolean
  cantripsKnown: number
  /** Known-spell cap for known casters. */
  spellsKnown?: number
  /** Prepared-spell cap for prepared casters. */
  preparedMax?: number
  /** When the prepared list can change (2024 classes). */
  changes?: 'restLong' | 'level'
  /** Spells the spellbook gets for free by this level, when the class data states it. */
  spellbookFree?: number
}

/** Evaluate a 5etools prepared-spells formula, e.g. "<$level$> + <$wis_mod$>". */
export function evalPreparedFormula(
  formula: string,
  level: number,
  abilityMod: number,
): number {
  const half = /\/\s*2/.test(formula)
  const base = half ? Math.floor(level / 2) : level
  return Math.max(1, base + abilityMod)
}

/**
 * Whether a class prepares its spells from a spellbook rather than its whole
 * class list. In 5e RAW this is the Wizard's defining feature (the spellbook),
 * and no class-data flag marks it, so the class name is the reliable signal.
 */
export function usesSpellbook(className: string): boolean {
  return className === 'Wizard'
}

/**
 * The number of spells a wizard adds to their spellbook for free from leveling:
 * six at 1st level, then two per level gained (or what the class data says,
 * `fixed`, per level). Copied spells (from scrolls or other books) legitimately
 * push the book beyond this, so it is a baseline, not a cap.
 */
export function spellbookFreeCount(level: number, fixed?: number[]): number {
  const lvl = clampLevel(level)
  if (fixed) return fixed.slice(0, lvl).reduce((sum, n) => sum + n, 0)
  return 6 + 2 * (lvl - 1)
}

interface CasterIdentity {
  classKey: string
  name: string
  source: string
  subclassKey?: string
}

/**
 * Classify one source of spellcasting at a level: a class entry, or the subclass
 * of a third caster. One function for both, so Eldritch Knight is a caster with
 * no second code path. 2014 casters cap by `spellsKnownProgression` or the
 * `preparedSpells` formula; 2024 casters by `preparedSpellsProgression`.
 */
export function casterFrom(
  source: SpellcastingFields,
  identity: CasterIdentity,
  level: number,
  abilityMod: number,
): ClassCaster {
  const progression = source.casterProgression ?? 'none'
  const ability = source.spellcastingAbility as AbilityKey | undefined
  const lvl = clampLevel(level)
  const base: ClassCaster = {
    ...identity,
    level,
    ability,
    progression,
    kind: 'none',
    isPact: progression === 'pact',
    cantripsKnown: source.cantripProgression?.[lvl - 1] ?? 0,
    changes: source.preparedSpellsChange,
    spellbookFree: source.spellsKnownProgressionFixed
      ? spellbookFreeCount(level, source.spellsKnownProgressionFixed)
      : undefined,
  }
  if (progression === 'none') return base

  if (source.spellsKnownProgression) {
    return {
      ...base,
      kind: 'known',
      spellsKnown: source.spellsKnownProgression[lvl - 1] ?? 0,
    }
  }
  if (source.preparedSpellsProgression) {
    return {
      ...base,
      kind: 'prepared',
      preparedMax: source.preparedSpellsProgression[lvl - 1] ?? 0,
    }
  }
  if (source.preparedSpells) {
    return {
      ...base,
      kind: 'prepared',
      preparedMax: evalPreparedFormula(source.preparedSpells, level, abilityMod),
    }
  }
  // Caster with slots but neither known nor prepared metadata (rare) - treat as
  // prepared-from-list without a computed cap.
  return { ...base, kind: 'prepared' }
}

/** Classify one class's spellcasting for a given level, with its casting subclass if any. */
export function classCaster(input: SpellClassInput): ClassCaster {
  const { entry, level, abilityMod, subclass } = input
  const classKey = `${entry.name}|${entry.source}`
  if (subclass?.casterProgression) {
    return casterFrom(
      subclass,
      {
        classKey,
        name: `${entry.name} (${subclass.name})`,
        source: entry.source,
        subclassKey: `${classKey}|${subclass.shortName}`,
      },
      level,
      abilityMod,
    )
  }
  return casterFrom(
    entry,
    { classKey, name: entry.name, source: entry.source },
    level,
    abilityMod,
  )
}

export interface SpellSlots {
  /** Slots per spell level 1..9 (index 0 = 1st level). */
  standard: number[]
  /** Warlock Pact Magic, when present. */
  pact?: { slots: number; level: number }
  /** Highest spell level castable (standard or pact). */
  maxSpellLevel: number
}

/** Compute a character's spell slots from its classes' progressions. */
export function spellSlots(casters: ClassCaster[]): SpellSlots {
  const nonPact = casters.filter((c) => c.progression !== 'none' && !c.isPact)
  let standard = new Array(9).fill(0)

  if (nonPact.length === 1) {
    const c = nonPact[0]
    const lvl = clampLevel(c.level)
    if (c.progression === 'full') standard = [...FULL_SLOTS[lvl - 1]]
    else if (c.progression === '1/2') standard = [...HALF_SLOTS[lvl - 1], 0, 0, 0, 0]
    else if (c.progression === '1/3') standard = [...THIRD_SLOTS[lvl - 1], 0, 0, 0, 0, 0]
    else {
      // artificer single class: use the combined-table method.
      const cl = casterLevelContribution(c.progression, c.level)
      if (cl >= 1) standard = [...FULL_SLOTS[clampLevel(cl) - 1]]
    }
  } else if (nonPact.length > 1) {
    const casterLevel = nonPact.reduce(
      (sum, c) => sum + casterLevelContribution(c.progression, c.level),
      0,
    )
    if (casterLevel >= 1) standard = [...FULL_SLOTS[clampLevel(casterLevel) - 1]]
  }

  let pact: SpellSlots['pact']
  const warlock = casters.find((c) => c.isPact)
  if (warlock) {
    const [slots, level] = PACT[clampLevel(warlock.level) - 1]
    pact = { slots, level }
  }

  let maxSpellLevel = 0
  for (let i = 0; i < standard.length; i++) if (standard[i] > 0) maxSpellLevel = i + 1
  if (pact) maxSpellLevel = Math.max(maxSpellLevel, pact.level)

  return { standard, pact, maxSpellLevel }
}

/**
 * The highest spell level this class can learn or prepare on its own table, as
 * if it were the only class (RAW: spells known and prepared are per class, even
 * when the slots are the combined multiclass table). Pact Magic gives its slot level.
 */
export function classMaxSpellLevel(caster: ClassCaster): number {
  return spellSlots([caster]).maxSpellLevel
}
