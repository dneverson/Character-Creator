// Skill proficiency aggregation: combine the grants from background, classes,
// and race, track which chosen skills consume which source's budget, and
// compute each skill's modifier. Kept out of components for reuse/testing.

import { abilityMod, formatMod, type AbilityKey } from '../dice/dice'
import {
  SKILLS,
  parseSkillGrants,
  skillLabel,
  proficiencyBonus,
  type SkillChoice,
} from '../data/skills'
import type { LoadedClass } from '../data/class'
import type { PlayableBackground } from '../data/background'
import type { PlayableRace } from '../data/race'
import type { Character, SkillProficiencies } from './model'
import { characterAbilityTotals, totalLevel } from './derive'
import {
  MANUAL_TAG,
  picksCharged,
  skillPicks,
  type PickCard,
  type PickChip,
  type PickKind,
  type SkillSourceKind,
} from './picks'

export { MANUAL_TAG }

/** Source tag for a class's skill grant. */
export function classSourceTag(name: string, source: string): string {
  return `class:${name}|${source}`
}

export type { SkillSourceKind }

/** One provider of skill proficiencies (background, a class, or race). */
export interface SkillSource {
  tag: string
  label: string
  kind: SkillSourceKind
  /** Skills granted outright (always proficient). */
  fixed: string[]
  /** "Choose N from a list" grants. */
  choices: SkillChoice[]
  /** Other kinds of pick the same budget pays for (Skilled: a skill or a tool). */
  shares?: PickKind[]
}

/** A background's or race's skill grant as a source, when it grants any skill. */
function grantSource(
  tag: string,
  label: string,
  kind: SkillSourceKind,
  blocks?: unknown[],
): SkillSource[] {
  const { fixed, choices } = parseSkillGrants(blocks)
  return fixed.length > 0 || choices.length > 0
    ? [{ tag, label, kind, fixed, choices }]
    : []
}

/** Build the ordered list of skill sources for a character. */
export function buildSkillSources(
  character: Character,
  classByKey: Map<string, LoadedClass>,
  background?: PlayableBackground,
  race?: PlayableRace,
): SkillSource[] {
  const sources: SkillSource[] = []

  if (background) {
    sources.push(
      ...grantSource(
        'bg',
        `Background · ${background.name}`,
        'background',
        background.skillProficiencies,
      ),
    )
  }

  character.classes.forEach((c, i) => {
    const lc = classByKey.get(`${c.name}|${c.source}`)
    if (!lc) return
    // Only the first class grants its full skill list; multiclassing grants a
    // reduced set via `multiclassing.proficienciesGained`.
    const raw =
      i === 0
        ? lc.entry.startingProficiencies?.skills
        : lc.entry.multiclassing?.proficienciesGained?.skills
    const { choices } = parseSkillGrants(raw as unknown[] | undefined)
    if (choices.length === 0) return
    sources.push({
      tag: classSourceTag(c.name, c.source),
      label: i === 0 ? `Class · ${c.name}` : `Multiclass · ${c.name}`,
      kind: i === 0 ? 'class' : 'multiclass',
      fixed: [],
      choices,
    })
  })

  if (race) {
    sources.push(
      ...grantSource('race', `Race · ${race.name}`, 'race', race.skillProficiencies),
    )
  }

  return sources
}

/** Total "choose" budget offered by a source. */
function budgetOf(source: SkillSource): number {
  return source.choices.reduce((n, c) => n + c.count, 0)
}

/** The union of skills a source lets you choose from. */
function chooseSetOf(source: SkillSource): Set<string> {
  const set = new Set<string>()
  for (const c of source.choices) for (const s of c.from) set.add(s)
  return set
}

/** Skills granted outright, mapped skill -> the first source tag that grants it. */
export function fixedGrants(sources: SkillSource[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const src of sources) {
    for (const f of src.fixed) if (!m.has(f)) m.set(f, src.tag)
  }
  return m
}

export interface SourceBudget {
  tag: string
  label: string
  count: number
  used: number
  over: boolean
}

/** Per-source budget usage (how many chosen skills are charged to each). */
export function sourceBudgets(
  chosen: SkillProficiencies,
  sources: SkillSource[],
): SourceBudget[] {
  return sources
    .filter((s) => s.choices.length > 0)
    .map((s) => {
      const count = budgetOf(s)
      const used = Object.values(chosen).filter((tag) => tag === s.tag).length
      return { tag: s.tag, label: s.label, count, used, over: used > count }
    })
}

/**
 * Toggle a skill's proficiency, returning the next chosen-skills map. Fixed
 * grants are locked and never change. When selecting, the pick is charged to
 * the first source that offers it and still has budget; if none does, it is
 * marked "manual" (off-standard, but allowed).
 */
export function toggleSkillProficiency(
  chosen: SkillProficiencies,
  sources: SkillSource[],
  skillKey: string,
): SkillProficiencies {
  const fixed = fixedGrants(sources)
  if (fixed.has(skillKey)) return chosen // locked on

  if (skillKey in chosen) return pickSkill(chosen, skillKey, chosen[skillKey])

  // Find a source that offers this skill and still has room.
  for (const src of sources) {
    if (!chooseSetOf(src).has(skillKey)) continue
    const used = Object.values(chosen).filter((tag) => tag === src.tag).length
    if (used < budgetOf(src)) return pickSkill(chosen, skillKey, src.tag)
  }
  return pickSkill(chosen, skillKey, MANUAL_TAG)
}

/**
 * Charge a skill to an explicit source (`MANUAL_TAG` for a non-standard pick), or
 * take it back when it is already chosen. No guessing which source pays.
 */
export function pickSkill(
  chosen: SkillProficiencies,
  skillKey: string,
  tag: string,
): SkillProficiencies {
  if (skillKey in chosen) {
    const next = { ...chosen }
    delete next[skillKey]
    return next
  }
  return { ...chosen, [skillKey]: tag }
}

export interface SkillRow {
  key: string
  label: string
  ability: AbilityKey
  proficient: boolean
  /** Source tag responsible, or undefined when not proficient. */
  source?: string
  /** Fixed grant - cannot be toggled off. */
  locked: boolean
  /** Off-standard pick (not offered by any source). */
  nonStandard: boolean
  modifier: number
  /** Expertise: what gives it, when the proficiency bonus counts twice. */
  expertise?: string
}

/** Compute the full 18-skill table for display. `featBonus`: feat ability increases. */
export function skillRows(
  character: Character,
  sources: SkillSource[],
  featBonus: Partial<Record<AbilityKey, number>> = {},
  /** The skills the character has expertise in, each with what gives it. */
  expertise: ReadonlyMap<string, string> = new Map(),
): SkillRow[] {
  const fixed = fixedGrants(sources)
  const chosen = skillPicks(character)
  const totals = characterAbilityTotals(character, featBonus)
  const pb = proficiencyBonus(totalLevel(character))

  return SKILLS.map((skill) => {
    const fixedTag = fixed.get(skill.key)
    const chosenTag = chosen[skill.key]
    const proficient = fixedTag != null || chosenTag != null
    const source = fixedTag ?? chosenTag
    const base = abilityMod(totals[skill.ability])
    const doubled = proficient ? expertise.get(skill.key) : undefined
    return {
      key: skill.key,
      label: skill.label,
      ability: skill.ability,
      proficient,
      source,
      locked: fixedTag != null,
      nonStandard: chosenTag === MANUAL_TAG,
      modifier: base + (proficient ? pb : 0) + (doubled === undefined ? 0 : pb),
      expertise: doubled,
    }
  })
}

/** What a source is called in a short phrase: "Background", "Race", or the class or feat name. */
export function sourceName(source: SkillSource): string {
  if (source.kind === 'background') return 'Background'
  if (source.kind === 'race') return 'Race'
  return source.label.split(' · ').slice(1).join(' · ') || source.label
}

/** One fixed grant in the "Granted" line. */
export interface GrantedSkill {
  label: string
  source: string
}

/** Every fixed grant with its source; a source granting all skills collapses to one entry. */
export function grantedLine(sources: SkillSource[]): GrantedSkill[] {
  const out: GrantedSkill[] = []
  const seen = new Set<string>()
  for (const src of sources) {
    const fresh = src.fixed.filter((f) => !seen.has(f))
    if (fresh.length === 0) continue
    fresh.forEach((f) => seen.add(f))
    if (src.fixed.length === SKILLS.length) {
      out.push({ label: 'All skills', source: sourceName(src) })
      continue
    }
    for (const f of fresh) out.push({ label: skillLabel(f), source: sourceName(src) })
  }
  return out
}

/** Display name for a stored source tag. */
export function tagName(tag: string, sources: SkillSource[]): string {
  if (tag === MANUAL_TAG) return 'Non-standard'
  const src = sources.find((s) => s.tag === tag)
  return src ? sourceName(src) : tag
}

/** A card per source that offers a choice: its whole allowed list and each skill's state. */
export function skillCards(
  character: Character,
  sources: SkillSource[],
  rows: SkillRow[],
): PickCard[] {
  const chosen = skillPicks(character)
  const fixed = fixedGrants(sources)
  const rowOf = new Map(rows.map((r) => [r.key, r]))
  const pb = proficiencyBonus(totalLevel(character))
  return sources
    .filter((s) => s.choices.length > 0)
    .map((src) => {
      const count = budgetOf(src)
      const picks = Object.keys(chosen).filter((k) => chosen[k] === src.tag)
      // A budget shared with another kind of pick (Skilled) is spent by both.
      const kinds: PickKind[] = ['skill', ...(src.shares ?? [])]
      const used = picksCharged(character.grantPicks, src.tag, kinds)
      const allowed = chooseSetOf(src)
      const chips = SKILLS.filter((sk) => allowed.has(sk.key)).map((sk): PickChip => {
        const row = rowOf.get(sk.key)
        const modifier = row ? row.modifier + (row.proficient ? 0 : pb) : 0
        const base = {
          kind: 'skill' as const,
          value: sk.key,
          label: sk.label,
          hint: formatMod(modifier),
        }
        const fixedTag = fixed.get(sk.key)
        if (chosen[sk.key] === src.tag) return { ...base, state: 'picked' }
        if (fixedTag !== undefined) {
          return { ...base, state: 'taken', takenBy: tagName(fixedTag, sources) }
        }
        if (sk.key in chosen) {
          return { ...base, state: 'taken', takenBy: tagName(chosen[sk.key], sources) }
        }
        return { ...base, state: used >= count ? 'full' : 'available' }
      })
      return {
        tag: src.tag,
        label: src.label,
        name: sourceName(src),
        kind: src.kind,
        noun: 'skills',
        kinds,
        count,
        used,
        left: Math.max(0, count - used),
        over: used > count,
        picks,
        chips,
        note:
          kinds.length > 1
            ? `Shared with your ${kinds.slice(1).join(' and ')} picks, in Proficiencies.`
            : undefined,
      }
    })
}

/** A pick outside every source's list, or tagged with a source the character no longer has. */
export interface OtherPick {
  skill: string
  tag: string
  /** The stored tag names no source of this character. */
  orphan: boolean
}

export function otherPicks(
  chosen: SkillProficiencies,
  sources: SkillSource[],
): OtherPick[] {
  const known = new Set(sources.map((s) => s.tag))
  return Object.entries(chosen)
    .filter(([, tag]) => tag === MANUAL_TAG || !known.has(tag))
    .map(([skill, tag]) => ({ skill, tag, orphan: tag !== MANUAL_TAG }))
}
