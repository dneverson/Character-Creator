// Feat prerequisite checks. Each check answers met / unmet / unknown ("could not
// be checked": the data or the character does not track what it needs). The
// Feats section only flags unmet prerequisites; it never blocks a pick.

import type { AbilityKey } from '../dice/dice'
import type { Feat, FeatPrerequisite } from '../data/feats'
import type { LoadedClass } from '../data/class'
import type { PlayableRace } from '../data/race'
import type { Character } from './model'

export type PrereqResult = 'met' | 'unmet' | 'unknown'

/**
 * Armor and martial-weapon proficiencies known from structured data. `martial`
 * is 'some' when only part of the group is known (e.g. "Martial weapons that
 * have the Light property", or specific weapons without item data to classify).
 */
export interface ProficiencySet {
  armor: Set<string>
  martial: 'full' | 'some' | 'none'
}

/** What a prerequisite check needs to know, as of one feat slot. */
export interface PrereqContext {
  character: Character
  race?: PlayableRace
  /** Character level the slot is gained at (1 for race/background slots). */
  level: number
  /** Class levels by lowercase class name. */
  classLevels: Map<string, number>
  /** Ability totals before this slot's increase. */
  abilities: Record<AbilityKey, number>
  /** Feats taken in earlier slots. */
  priorFeats: Feat[]
  /** Feats taken in every other slot (for "no other" rules). */
  otherFeats: Feat[]
  /** Class and subclass feature names (lowercase). */
  features: Set<string>
  proficiencies: ProficiencySet
}

/** Combine AND-ed results: any unmet fails, else any unknown is unknown. */
function all(results: PrereqResult[]): PrereqResult {
  if (results.includes('unmet')) return 'unmet'
  return results.includes('unknown') ? 'unknown' : 'met'
}

/** Combine OR-ed results: any met passes, else any unknown is unknown. */
function any(results: PrereqResult[]): PrereqResult {
  if (results.includes('met')) return 'met'
  return results.includes('unknown') ? 'unknown' : 'unmet'
}

const bool = (ok: boolean): PrereqResult => (ok ? 'met' : 'unmet')

function levelMet(level: NonNullable<FeatPrerequisite['level']>, ctx: PrereqContext) {
  if (typeof level === 'number') return bool(ctx.level >= level)
  if (!level.class) return bool(ctx.level >= level.level)
  return bool((ctx.classLevels.get(level.class.name.toLowerCase()) ?? 0) >= level.level)
}

function raceMet(
  r: NonNullable<FeatPrerequisite['race']>[number],
  ctx: PrereqContext,
): PrereqResult {
  const ref = ctx.character.race
  if (!ref) return 'unmet'
  if (r.name === 'small race') {
    return ctx.race ? bool(ctx.race.size?.includes('S') === true) : 'unknown'
  }
  if (ref.baseName.toLowerCase() !== r.name.toLowerCase()) return 'unmet'
  if (!r.subrace) return 'met'
  // 2024 species pick a lineage in play rather than as a subrace.
  if (!ref.subraceName) return 'unknown'
  return bool(ref.subraceName.toLowerCase().includes(r.subrace.toLowerCase()))
}

/**
 * A feat reference "name|source|display". When the display names a version in
 * parentheses ("(fire strike)"), the taken feat must be that version; a feat
 * without versions leaves the choice untracked (unknown).
 */
function featRefMet(ref: string, ctx: PrereqContext): PrereqResult {
  const [name = '', source = '', display = ''] = ref.toLowerCase().split('|')
  const taken = ctx.priorFeats.filter(
    (f) => f.baseName.toLowerCase() === name && f.source.toLowerCase() === source,
  )
  if (taken.length === 0) return 'unmet'
  const wanted = /\(([^)]+)\)/.exec(display)?.[1]
  if (!wanted) return 'met'
  return any(
    taken.map((f) => {
      if (f.name === f.baseName) return 'unknown'
      const version = f.name
        .slice(f.name.indexOf(';') + 1)
        .trim()
        .toLowerCase()
      return bool(wanted.includes(version))
    }),
  )
}

function proficiencyMet(
  p: NonNullable<FeatPrerequisite['proficiency']>[number],
  ctx: PrereqContext,
): PrereqResult {
  const { armor, martial } = ctx.proficiencies
  if (p.armor) return bool(armor.has(p.armor))
  // "A martial weapon": one known martial weapon is enough.
  if (p.weapon === 'martial') {
    if (martial === 'full') return 'met'
    return martial === 'some' ? 'unknown' : 'unmet'
  }
  // "Martial weapons" (the group): only full proficiency counts.
  if (p.weaponGroup === 'martial') return bool(martial === 'full')
  return 'unknown'
}

const hasCasting = (ctx: PrereqContext) =>
  ctx.features.has('spellcasting') || ctx.features.has('pact magic')

/** Every key in one prerequisite alternative (AND). */
function alternativeMet(p: FeatPrerequisite, ctx: PrereqContext): PrereqResult {
  const results: PrereqResult[] = []
  if (p.level !== undefined) results.push(levelMet(p.level, ctx))
  if (p.ability?.length) {
    results.push(
      bool(
        p.ability.some((min) =>
          Object.entries(min).every(
            ([k, v]) => ctx.abilities[k as AbilityKey] >= (v ?? 0),
          ),
        ),
      ),
    )
  }
  if (p.race?.length) results.push(any(p.race.map((r) => raceMet(r, ctx))))
  if (p.background?.length) {
    const name = ctx.character.background?.name.toLowerCase()
    results.push(bool(p.background.some((b) => b.name.toLowerCase() === name)))
  }
  if (p.feature?.length) {
    results.push(bool(p.feature.some((f) => ctx.features.has(f.toLowerCase()))))
  }
  if (p.feat?.length) results.push(any(p.feat.map((ref) => featRefMet(ref, ctx))))
  if (p.featCategory?.length) {
    const codes = p.featCategory
    results.push(bool(ctx.priorFeats.some((f) => codes.includes(f.category ?? ''))))
  }
  if (p.exclusiveFeatCategory?.length) {
    const codes = p.exclusiveFeatCategory
    results.push(bool(!ctx.otherFeats.some((f) => codes.includes(f.category ?? ''))))
  }
  if (p.spellcastingFeature) results.push(bool(ctx.features.has('spellcasting')))
  if (p.spellcasting2020) results.push(bool(hasCasting(ctx)))
  // Racial and feat spells also count; those are not tracked yet.
  if (p.spellcasting) results.push(hasCasting(ctx) ? 'met' : 'unknown')
  if (p.proficiency?.length) {
    results.push(any(p.proficiency.map((q) => proficiencyMet(q, ctx))))
  }
  if (p.campaign?.length || p.other || p.otherSummary) results.push('unknown')
  return all(results)
}

/** Whether a feat's prerequisites are met (alternatives are OR-ed). */
export function prerequisitesMet(feat: Feat, ctx: PrereqContext): PrereqResult {
  if (feat.prerequisites.length === 0) return 'met'
  return any(feat.prerequisites.map((p) => alternativeMet(p, ctx)))
}

// ---- Proficiencies ----------------------------------------------------------

const ARMOR_TOKENS = ['light', 'medium', 'heavy', 'shield']
const MARTIAL_RANK = { none: 0, some: 1, full: 2 } as const

function raiseMartial(set: ProficiencySet, level: ProficiencySet['martial']) {
  if (MARTIAL_RANK[level] > MARTIAL_RANK[set.martial]) set.martial = level
}

/** Class armor/weapon entries: plain strings, tagged items, or `{ proficiency }`. */
function addClassProficiencies(
  set: ProficiencySet,
  armor: unknown[] | undefined,
  weapons: unknown[] | undefined,
) {
  for (const a of armor ?? []) {
    const token = typeof a === 'string' ? a : (a as { proficiency?: unknown }).proficiency
    if (typeof token === 'string' && ARMOR_TOKENS.includes(token)) set.armor.add(token)
  }
  for (const w of weapons ?? []) {
    if (typeof w !== 'string') continue
    if (w === 'martial') raiseMartial(set, 'full')
    else if (w !== 'simple') raiseMartial(set, 'some')
  }
}

/** Race/feat blocks: `{ light: true }`, `{ "longsword|phb": true }`, `{ choose }`. */
function addBlockProficiencies(
  set: ProficiencySet,
  armor: unknown[] | undefined,
  weapons: unknown[] | undefined,
) {
  for (const block of armor ?? []) {
    for (const [k, v] of Object.entries(block ?? {})) {
      if (v === true && ARMOR_TOKENS.includes(k)) set.armor.add(k)
    }
  }
  for (const block of weapons ?? []) {
    for (const [k, v] of Object.entries(block ?? {})) {
      if (k === 'martial' && v === true) raiseMartial(set, 'full')
      else if (k.includes('|') && v === true) raiseMartial(set, 'some')
      else if (k === 'choose') {
        const filter = (v as { fromFilter?: unknown }).fromFilter
        if (typeof filter === 'string' && filter.includes('martial weapon')) {
          raiseMartial(set, 'some')
        }
      }
    }
  }
}

/**
 * Armor and martial-weapon proficiencies from classes (full list for the first
 * class, multiclass list for the rest), race, and the given feats.
 */
export function proficiencySet(
  character: Character,
  classByKey: Map<string, LoadedClass>,
  race: PlayableRace | undefined,
  feats: Feat[],
): ProficiencySet {
  const set: ProficiencySet = { armor: new Set(), martial: 'none' }
  character.classes.forEach((c, i) => {
    const entry = classByKey.get(`${c.name}|${c.source}`)?.entry
    const profs =
      i === 0 ? entry?.startingProficiencies : entry?.multiclassing?.proficienciesGained
    addClassProficiencies(set, profs?.armor, profs?.weapons)
  })
  addBlockProficiencies(set, race?.armorProficiencies, race?.weaponProficiencies)
  for (const f of feats)
    addBlockProficiencies(set, f.armorProficiencies, f.weaponProficiencies)
  return set
}
