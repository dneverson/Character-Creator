// Feat data: resolve `_copy`, expand `_versions` (e.g. Magic Initiate per spell
// list) into separate picks, and normalize the grants the character sheet uses:
// ability increases, skill proficiencies, hit-point bonuses, and prerequisites.

import { ABILITY_NAMES, type AbilityKey } from '../dice/dice'
import { parseAbilityOptions, type AbilityOption } from './abilityOptions'
import { PROFICIENCY_FIELDS, type ProficiencyField } from './grants'
import { fetchData } from './dataClient'
import { resolveCopy, type Copyable } from './copy'
import { parseSkillGrants, SKILL_KEYS, type SkillGrants } from './skills'
import { featHpRule } from '../rules/hpSources'
import { stripTags } from '../text/tags'
import { titleCase } from '../text/titleCase'
import type { Entry } from '../text/Entries'

/** One prerequisite alternative; every key present must be met (AND). */
export interface FeatPrerequisite {
  level?: number | { level: number; class?: { name: string; visible?: boolean } }
  /** Any one of these minimum scores (OR). */
  ability?: Partial<Record<AbilityKey, number>>[]
  race?: { name: string; subrace?: string; displayEntry?: string }[]
  background?: { name: string; displayEntry?: string }[]
  /** Any one of these class features (OR). */
  feature?: string[]
  /** Any one of these feats, as "name|source" or "name|source|display" (OR). */
  feat?: string[]
  featCategory?: string[]
  exclusiveFeatCategory?: string[]
  spellcasting?: boolean
  spellcasting2020?: boolean
  spellcastingFeature?: boolean
  proficiency?: {
    weapon?: string
    weaponGroup?: string
    armor?: string
    tool?: string[]
  }[]
  campaign?: string[]
  other?: string
  otherSummary?: { entry: string; entrySummary?: string }
}

export interface FeatEntry
  extends Copyable, Partial<Record<ProficiencyField, unknown[]>> {
  category?: string
  prerequisite?: FeatPrerequisite[]
  ability?: unknown[]
  repeatable?: boolean
  expertise?: unknown[]
  savingThrowProficiencies?: unknown[]
  resist?: unknown[]
  immune?: unknown[]
  conditionImmune?: unknown[]
  senses?: unknown[]
  bonusSenses?: unknown[]
  additionalSpells?: unknown[]
  optionalfeatureProgression?: unknown[]
  entries?: Entry[]
  _versions?: FeatVersion[]
}

type FeatVersion = Record<string, unknown> & {
  name: string
  source?: string
  _mod?: NonNullable<Copyable['_copy']>['_mod']
}

interface FeatsFile {
  feat: FeatEntry[]
}

export interface Feat extends Partial<Record<ProficiencyField, unknown[]>> {
  /** Lowercase "name|source", the form backgrounds and prerequisites reference. */
  key: string
  /** Data name; a version reads "Magic Initiate; Cleric". */
  name: string
  /** Display name; a version reads "Magic Initiate (Cleric)". */
  label: string
  /** Name without the version suffix (used for repeat checks). */
  baseName: string
  source: string
  /** The 2024 books sort feats into categories; the 2014 ones do not. */
  edition: 'classic' | 'one'
  category?: string
  prerequisites: FeatPrerequisite[]
  abilityOptions: AbilityOption[]
  repeatable: boolean
  skills: SkillGrants
  /** Hit-point maximum increase: per character level, and flat. */
  hp: { perLevel: number; flat: number }
  // Carried as the data has them, for the feat's facts.
  expertise?: unknown[]
  savingThrowProficiencies?: unknown[]
  resist?: unknown[]
  immune?: unknown[]
  conditionImmune?: unknown[]
  senses?: unknown[]
  bonusSenses?: unknown[]
  additionalSpells?: unknown[]
  optionalfeatureProgression?: unknown[]
  entries: Entry[]
}

/** Feat categories in full, with a short explanation for tooltips. */
export const FEAT_CATEGORIES: Record<string, { label: string; description: string }> = {
  O: {
    label: 'Origin',
    description: 'Feats gained at level 1, typically from a background or species.',
  },
  G: {
    label: 'General',
    description:
      'Feats open to any character who meets the prerequisites, usually taken in place of an Ability Score Improvement.',
  },
  FS: {
    label: 'Fighting Style',
    description: 'Combat-style feats gained with the Fighting Style class feature.',
  },
  'FS:P': {
    label: 'Fighting Style Replacement (Paladin)',
    description: 'Options a Paladin can take in place of a Fighting Style feat.',
  },
  'FS:R': {
    label: 'Fighting Style Replacement (Ranger)',
    description: 'Options a Ranger can take in place of a Fighting Style feat.',
  },
  EB: {
    label: 'Epic Boon',
    description: 'Level 19+ feats, usually taken with the Epic Boon class feature.',
  },
  D: {
    label: 'Dragonmark',
    description: 'Eberron feats tied to a dragonmark; a character can have only one.',
  },
  DG: {
    label: 'Dark Gift',
    description: 'Ravenloft gifts of dark power, granted by certain backgrounds.',
  },
}

/** Label for feats without a category (the 2014 rules have none). */
export const UNCATEGORIZED_LABEL = 'Uncategorized (2014 rules)'
export const UNCATEGORIZED_DESCRIPTION =
  'The 2014 rules do not sort feats into categories; any feat slot may take them.'

/** Full label for a feat category code. */
export function featCategoryLabel(code: string | undefined): string {
  if (!code) return UNCATEGORIZED_LABEL
  return FEAT_CATEGORIES[code]?.label ?? code
}

/** Tooltip text for a feat category code. */
export function featCategoryDescription(code: string | undefined): string {
  if (!code) return UNCATEGORIZED_DESCRIPTION
  return FEAT_CATEGORIES[code]?.description ?? ''
}

/** The 2024 "Ability Score Improvement" feat; slots offer it as their own choice. */
export const ASI_FEAT_KEY = 'ability score improvement|xphb'

// Feats whose text allows taking them again but whose data does not say so, checked
// against the book's sentence.
const REPEATABLE_BY_TEXT = new Set([
  // "You can select this feat multiple times. Each time ... a different damage type."
  'elemental adept|phb',
])

/** The two ways to spend an Ability Score Improvement, as the 2024 feat prints them. */
export const ASI_OPTIONS = parseAbilityOptions([
  { choose: { amount: 2 } },
  { choose: { count: 2 } },
])

/** Lowercase lookup key for a feat reference. */
export function featKey(name: string, source: string): string {
  return `${name}|${source}`.toLowerCase()
}

// Skilled offers "any combination of three skills or tools"; tools are not
// tracked yet, so it counts as three skill choices.
function parseSkills(entry: FeatEntry): SkillGrants {
  const grants = parseSkillGrants(entry.skillProficiencies)
  for (const block of entry.skillToolLanguageProficiencies ?? []) {
    const choose = (block as { choose?: unknown }).choose
    for (const c of Array.isArray(choose) ? choose : []) {
      const { from, count } = c as { from?: string[]; count?: number }
      if (from?.includes('anySkill'))
        grants.choices.push({ count: count ?? 1, from: [...SKILL_KEYS] })
    }
  }
  return grants
}

const CARRIED_FIELDS = [
  'expertise',
  'savingThrowProficiencies',
  'resist',
  'immune',
  'conditionImmune',
  'senses',
  'bonusSenses',
  'additionalSpells',
  'optionalfeatureProgression',
] as const

function toFeat(entry: FeatEntry, baseName: string): Feat {
  const key = featKey(entry.name, entry.source)
  const hp = featHpRule(key)
  const feat: Feat = {
    key,
    name: entry.name,
    label: entry.name.replace(/;\s*(.+)$/, ' ($1)'),
    baseName,
    source: entry.source,
    edition: entry.category ? 'one' : 'classic',
    category: entry.category,
    prerequisites: entry.prerequisite ?? [],
    abilityOptions: parseAbilityOptions(entry.ability),
    repeatable: entry.repeatable === true || REPEATABLE_BY_TEXT.has(key),
    skills: parseSkills(entry),
    hp: { perLevel: hp?.perLevel ?? 0, flat: hp?.flat ?? 0 },
    entries: entry.entries ?? [],
  }
  for (const field of PROFICIENCY_FIELDS) feat[field] = entry[field] ?? []
  for (const field of CARRIED_FIELDS) if (entry[field]) feat[field] = entry[field]
  return feat
}

/**
 * Expand a feat's `_versions` into standalone feats. Each version is the base
 * feat with the version's `_mod` applied (via the `_copy` resolver) and its own
 * fields overlaid. A feat without versions is returned as-is.
 */
export function expandVersions(base: FeatEntry): FeatEntry[] {
  if (!base._versions?.length) return [base]
  const { _versions: versions, ...plain } = base
  return versions.map((v) => {
    const { _mod, ...own } = v
    const synthetic: FeatEntry = {
      ...own,
      name: v.name,
      source: v.source ?? base.source,
      _copy: { name: base.name, source: base.source, _mod },
    }
    return resolveCopy(synthetic, () => plain)
  })
}

/** Convert raw feat data (already `_copy`-resolved) into playable feats. */
export function featsFromEntries(entries: FeatEntry[]): Feat[] {
  const feats: Feat[] = []
  for (const entry of entries) {
    for (const version of expandVersions(entry)) feats.push(toFeat(version, entry.name))
  }
  return feats.sort((a, b) => a.label.localeCompare(b.label))
}

/** Load all feats, with `_copy` resolved and versions expanded. */
export async function loadFeats(): Promise<Feat[]> {
  const data = await fetchData<FeatsFile>('feats.json')
  const all = data.feat
  const find = (name: string, source: string) =>
    all.find((e) => e.name === name && e.source === source)
  return featsFromEntries(all.map((f) => resolveCopy(f, find)))
}

// ---- Feat grants (race / background) ---------------------------------------

/**
 * One feat a race or background grants. `named` lists the specific feats
 * (lowercase "name|source" keys) it offers; `categories` lists the feat
 * categories it may be taken from ('any' = any feat, [] = named feats only).
 */
export interface FeatGrant {
  named: string[]
  categories: 'any' | string[]
}

function blockGrants(block: Record<string, unknown>): FeatGrant[] {
  const grants: FeatGrant[] = []
  for (const [key, value] of Object.entries(block)) {
    if (key === 'any') {
      const count = typeof value === 'number' ? value : 1
      for (let i = 0; i < count; i++) grants.push({ named: [], categories: 'any' })
    } else if (key === 'anyFromCategory' && value && typeof value === 'object') {
      const { category, count } = value as { category?: unknown; count?: number }
      const categories = Array.isArray(category)
        ? category.filter((c): c is string => typeof c === 'string')
        : []
      for (let i = 0; i < (count ?? 1); i++) grants.push({ named: [], categories })
    } else if (key.includes('|') && value === true) {
      grants.push({ named: [key.toLowerCase()], categories: [] })
    }
  }
  return grants
}

function mergeGrant(a: FeatGrant | undefined, b: FeatGrant): FeatGrant {
  if (!a) return { named: [...b.named], categories: b.categories }
  const named = [...a.named, ...b.named.filter((n) => !a.named.includes(n))]
  const categories =
    a.categories === 'any' || b.categories === 'any'
      ? 'any'
      : [...a.categories, ...b.categories.filter((c) => !a.categories.includes(c))]
  return { named, categories }
}

/**
 * Parse a race/background `feats` array into one grant per feat gained. The
 * array's elements are alternatives (the player picks one), so with several
 * elements each gained feat offers the union of what the alternatives offer.
 */
export function parseFeatGrants(blocks: unknown[] | undefined): FeatGrant[] {
  const alternatives = (blocks ?? [])
    .filter((b): b is Record<string, unknown> => !!b && typeof b === 'object')
    .map(blockGrants)
  const merged: FeatGrant[] = []
  for (const grants of alternatives) {
    grants.forEach((g, i) => {
      merged[i] = mergeGrant(merged[i], g)
    })
  }
  return merged
}

function choiceOfFeats(categories: FeatGrant['categories'], count: number): string {
  const kind = categories === 'any' ? '' : `${orList(categories.map(featCategoryLabel))} `
  return `${count} ${kind}feat${count === 1 ? '' : 's'} of your choice`
}

/**
 * The feats a race or background grants, in words: "Tough", "1 Origin feat of
 * your choice", "Lucky or Magic Initiate". Empty when it grants none.
 */
export function featGrantLabel(grants: FeatGrant[]): string {
  const parts: string[] = []
  // Free choices of the same kind are counted together ("2 feats of your choice").
  const free = new Map<string, { categories: FeatGrant['categories']; count: number }>()
  for (const grant of grants) {
    const open = grant.categories === 'any' || grant.categories.length > 0
    if (grant.named.length > 0) {
      const offers = grant.named.map(featRefText)
      if (open) offers.push(choiceOfFeats(grant.categories, 1))
      parts.push(orList(offers))
    } else if (open) {
      const key = String(grant.categories)
      const counted = free.get(key) ?? { categories: grant.categories, count: 0 }
      counted.count += 1
      free.set(key, counted)
    }
  }
  for (const { categories, count } of free.values())
    parts.push(choiceOfFeats(categories, count))
  return parts.join(', ')
}

// ---- Prerequisite text ------------------------------------------------------

function orList(items: string[]): string {
  return items.join(' or ')
}

function abilityText(options: Partial<Record<AbilityKey, number>>[]): string {
  const pairs = options.flatMap((o) =>
    Object.entries(o).map(([k, v]) => [ABILITY_NAMES[k as AbilityKey] ?? k, v] as const),
  )
  const values = new Set(pairs.map(([, v]) => v))
  if (values.size === 1)
    return `${orList(pairs.map(([n]) => n))} ${pairs[0][1]} or higher`
  return `${orList(pairs.map(([n, v]) => `${n} ${v}`))} or higher`
}

function proficiencyText(p: NonNullable<FeatPrerequisite['proficiency']>[number]) {
  if (p.armor === 'shield') return 'shields'
  if (p.armor) return `${p.armor} armor`
  if (p.tool) return orList(p.tool.map(titleCase))
  return `${p.weapon ?? p.weaponGroup} weapons`
}

/** Display text of a feat reference "name|source|display". */
export function featRefText(ref: string): string {
  const [name, , display] = ref.split('|')
  return titleCase(display || name)
}

function elementText(p: FeatPrerequisite): string {
  const parts: string[] = []
  if (p.level !== undefined) {
    const lvl = typeof p.level === 'number' ? { level: p.level } : p.level
    parts.push(lvl.class ? `${lvl.class.name} level ${lvl.level}` : `Level ${lvl.level}`)
  }
  if (p.ability?.length) parts.push(abilityText(p.ability))
  if (p.race?.length) {
    parts.push(
      orList(
        p.race.map((r) =>
          r.displayEntry
            ? stripTags(r.displayEntry)
            : titleCase(r.subrace ? `${r.name} (${r.subrace})` : r.name),
        ),
      ),
    )
  }
  if (p.background?.length) {
    const names = p.background.map((b) => stripTags(b.displayEntry ?? b.name))
    parts.push(`${orList(names)} background`)
  }
  if (p.feature?.length) parts.push(`${orList(p.feature)} feature`)
  if (p.feat?.length) parts.push(`${orList(p.feat.map(featRefText))} feat`)
  if (p.featCategory?.length) {
    parts.push(`${orList(p.featCategory.map(featCategoryLabel))} feat`)
  }
  if (p.exclusiveFeatCategory?.length) {
    parts.push(`No other ${orList(p.exclusiveFeatCategory.map(featCategoryLabel))} feat`)
  }
  if (p.spellcasting) parts.push('The ability to cast at least one spell')
  if (p.spellcasting2020) parts.push('Spellcasting or Pact Magic feature')
  if (p.spellcastingFeature) parts.push('Spellcasting feature')
  if (p.proficiency?.length) {
    parts.push(`Proficiency with ${orList(p.proficiency.map(proficiencyText))}`)
  }
  if (p.campaign?.length) parts.push(`${orList(p.campaign)} campaign`)
  if (p.other) parts.push(p.other)
  if (p.otherSummary) parts.push(p.otherSummary.entry)
  return parts.join(', ')
}

/** Readable prerequisite text: alternatives joined with "; or ", '' if none. */
export function prerequisiteText(prerequisites: FeatPrerequisite[]): string {
  return prerequisites
    .map(elementText)
    .filter((t) => t)
    .join('; or ')
}
