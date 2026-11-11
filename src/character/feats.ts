// Feats & Ability Score Improvements: the slots a character gains (race,
// background, class features, and player-added bonus slots), what fills each
// one, and the combined effects (ability increases, hit points, skills). Rules
// problems are flagged on the slot, never blocked.

import { ABILITIES, ABILITY_NAMES, type AbilityKey } from '../dice/dice'
import { featuresForClass, type LoadedClass } from '../data/class'
import {
  ABILITY_SCORE_MAX,
  increasesLeft,
  optionIncreases,
  type AbilityOption,
} from '../data/abilityOptions'
import {
  ASI_OPTIONS,
  featCategoryLabel,
  featKey,
  prerequisiteText,
  type Feat,
} from '../data/feats'
import type { PlayableBackground } from '../data/background'
import type { PlayableRace } from '../data/race'
import type { Entry } from '../text/Entries'
import type { Character, FeatChoice } from './model'
import type { SkillSource } from './skills'
import { characterAbilityTotals, totalLevel } from './derive'
import { prerequisitesMet, proficiencySet, type PrereqContext } from './featPrereqs'

/** One place a character gains a feat (or an Ability Score Improvement). */
export interface FeatSlot {
  id: string
  label: string
  origin: 'race' | 'background' | 'class' | 'bonus'
  /** The slot may take an Ability Score Improvement instead of a feat. */
  allowsAsi: boolean
  /** Feat categories the slot takes ('any' = any feat, [] = named feats only). */
  categories: 'any' | string[]
  /** Specific feats (lowercase "name|source" keys) the slot offers. */
  named: string[]
  /** Categories the picker starts on (e.g. Epic Boon for the Epic Boon feature). */
  preferred: string[]
  /** Class level the slot is gained at (1 for race/background, 0 for bonus). */
  level: number
}

export type FeatFlagKind =
  'prerequisite' | 'unchecked' | 'cap' | 'repeat' | 'category' | 'incomplete' | 'missing'

export interface FeatFlag {
  kind: FeatFlagKind
  message: string
  /** For a repeat: the label of the slot that already has the feat. */
  takenIn?: string
}

/** A feat another slot has, with that slot's label. */
export interface TakenFeat {
  feat: Feat
  slotLabel: string
}

export interface ResolvedFeatSlot {
  slot: FeatSlot
  choice?: FeatChoice
  kind?: 'asi' | 'feat'
  feat?: Feat
  /** Filled automatically (the slot grants exactly one feat). */
  auto: boolean
  /** The chosen feat's reference when it is not in the loaded data. */
  missing?: string
  option?: AbilityOption
  /** The character as it stands before this slot, for checking any feat against it. */
  context: PrereqContext
  increases: Partial<Record<AbilityKey, number>>
  flags: FeatFlag[]
}

export interface FeatSummary {
  slots: ResolvedFeatSlot[]
  /** Ability increases from every slot combined. */
  abilityBonus: Partial<Record<AbilityKey, number>>
  /** Hit-point maximum increase: per character level, and flat. */
  hp: { perLevel: number; flat: number }
  skillSources: SkillSource[]
}

export interface FeatContext {
  /** Every loaded feat (not book-filtered, so saved picks always resolve). */
  feats: Feat[]
  classByKey: Map<string, LoadedClass>
  race?: PlayableRace
  background?: PlayableBackground
}

export const FEAT_SKILL_TAG_PREFIX = 'feat:'

// ---- Slots ------------------------------------------------------------------

const numbered = (base: string, i: number, total: number) =>
  total > 1 ? `${base} ${i + 1}` : base

/** Feat keys named by `refFeat` entries, walking nested entries. */
function refFeats(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const v of value) refFeats(v, out)
  } else if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (obj.type === 'refFeat' && typeof obj.feat === 'string') {
      const [name = '', source = ''] = obj.feat.split('|')
      const key = featKey(name, source)
      if (!out.includes(key)) out.push(key)
    }
    for (const v of Object.values(obj)) refFeats(v, out)
  }
  return out
}

/** Feat categories a feature's text links to via `{@filter ...|feats|category=...}`. */
function filterCategories(entries: Entry[]): string[] {
  const out: string[] = []
  for (const m of JSON.stringify(entries).matchAll(
    /\{@filter [^}]*?\|feats\|([^}]*)\}/g,
  )) {
    const part = m[1].split('|').find((p) => p.startsWith('category='))
    for (const c of part?.slice('category='.length).split(';') ?? []) {
      if (c && !out.includes(c)) out.push(c)
    }
  }
  return out
}

type ClassSlotKind = Pick<FeatSlot, 'allowsAsi' | 'categories' | 'named' | 'preferred'>

/** Whether a class feature grants a feat, and which kind. */
function classSlotKind(name: string, entries: Entry[]): ClassSlotKind | undefined {
  if (name === 'Ability Score Improvement') {
    return { allowsAsi: true, categories: 'any', named: [], preferred: [] }
  }
  if (name === 'Epic Boon') {
    return { allowsAsi: true, categories: 'any', named: [], preferred: ['EB'] }
  }
  const categories = filterCategories(entries)
  if (categories.length === 0) return undefined
  return { allowsAsi: false, categories, named: refFeats(entries), preferred: categories }
}

function classSlots(character: Character, classByKey: Map<string, LoadedClass>) {
  const found: { slot: FeatSlot; classIndex: number }[] = []
  const ids = new Set<string>()
  character.classes.forEach((c, classIndex) => {
    const loaded = classByKey.get(`${c.name}|${c.source}`)
    if (!loaded) return
    for (const f of featuresForClass(loaded, c)) {
      const kind = classSlotKind(f.name, f.entries)
      if (!kind) continue
      const base = `class:${c.name}|${c.source}:${f.level}:${f.name}`
      let id = base
      for (let n = 2; ids.has(id); n++) id = `${base}#${n}`
      ids.add(id)
      found.push({
        classIndex,
        slot: {
          id,
          label: `${c.name} level ${f.level} - ${f.name}`,
          origin: 'class',
          level: f.level,
          ...kind,
        },
      })
    }
  })
  found.sort((a, b) => a.slot.level - b.slot.level || a.classIndex - b.classIndex)
  return found.map((f) => f.slot)
}

/** Every feat slot the character has, in the order they are gained. */
export function featSlots(character: Character, ctx: FeatContext): FeatSlot[] {
  const slots: FeatSlot[] = []
  const { race, background } = ctx
  const raceRef = character.race
  if (race && raceRef) {
    const prefix = `race:${raceRef.baseName}|${raceRef.subraceName ?? ''}|${raceRef.source}`
    race.featGrants.forEach((g, j, all) =>
      slots.push({
        id: `${prefix}:${j}`,
        label: `${race.name} - ${numbered('Feat', j, all.length)}`,
        origin: 'race',
        allowsAsi: false,
        categories: g.categories,
        named: g.named,
        preferred: g.categories === 'any' ? [] : g.categories,
        level: 1,
      }),
    )
  }
  if (background && character.background) {
    background.featGrants.forEach((g, j, all) =>
      slots.push({
        id: `bg:${background.name}|${background.source}:${j}`,
        label: `${background.name} background - ${numbered('Feat', j, all.length)}`,
        origin: 'background',
        allowsAsi: false,
        categories: g.categories,
        named: g.named,
        preferred: g.categories === 'any' ? [] : g.categories,
        level: 1,
      }),
    )
  }
  slots.push(...classSlots(character, ctx.classByKey))
  const bonus = character.feats.bonusSlots
  bonus.forEach((id, i) =>
    slots.push({
      id,
      label: numbered('Bonus feat', i, bonus.length),
      origin: 'bonus',
      allowsAsi: true,
      categories: 'any',
      named: [],
      preferred: [],
      level: 0,
    }),
  )
  return slots
}

// ---- Resolution -------------------------------------------------------------

function addInto(
  target: Partial<Record<AbilityKey, number>>,
  add: Partial<Record<AbilityKey, number>>,
) {
  for (const k of ABILITIES) if (add[k]) target[k] = (target[k] ?? 0) + (add[k] ?? 0)
}

function orLabels(codes: string[]) {
  return codes.map(featCategoryLabel).join(' or ')
}

/** First pass: what fills each slot (before any rules checks). */
function fillSlot(
  slot: FeatSlot,
  record: FeatChoice | undefined,
  featByKey: Map<string, Feat>,
): Omit<ResolvedFeatSlot, 'increases' | 'flags' | 'context'> {
  // A stale ASI record on a slot that cannot take one counts as no choice.
  const choice = record?.kind === 'asi' && !slot.allowsAsi ? undefined : record
  if (!choice) {
    const auto =
      slot.named.length === 1 && slot.categories !== 'any' && slot.categories.length === 0
    if (auto && !slot.allowsAsi) {
      const feat = featByKey.get(slot.named[0])
      return {
        slot,
        kind: 'feat',
        feat,
        auto: true,
        missing: feat ? undefined : slot.named[0],
      }
    }
    return { slot, auto: false }
  }
  if (choice.kind === 'asi') {
    return {
      slot,
      choice,
      kind: 'asi',
      auto: false,
      option: pickOption(ASI_OPTIONS, choice),
    }
  }
  const ref = choice.feat
  const feat = ref ? featByKey.get(featKey(ref.name, ref.source)) : undefined
  return {
    slot,
    choice,
    kind: 'feat',
    feat,
    auto: false,
    missing: ref && !feat ? `${ref.name} (${ref.source})` : undefined,
    option: feat ? pickOption(feat.abilityOptions, choice) : undefined,
  }
}

function pickOption(options: AbilityOption[], choice: FeatChoice) {
  return options[choice.abilityOption ?? 0] ?? options[0]
}

function prereqBase(character: Character, ctx: FeatContext) {
  const classLevels = new Map<string, number>()
  const features = new Set<string>()
  for (const c of character.classes) {
    const name = c.name.toLowerCase()
    classLevels.set(name, (classLevels.get(name) ?? 0) + (c.level || 0))
    const loaded = ctx.classByKey.get(`${c.name}|${c.source}`)
    if (!loaded) continue
    for (const f of featuresForClass(loaded, c)) features.add(f.name.toLowerCase())
  }
  return { classLevels, features, level: totalLevel(character) }
}

/**
 * The rules problems a feat has in a slot: an unmet prerequisite, a repeat of a feat
 * already `taken`, and a category or named grant the slot does not take. `context` is
 * the character as it stands before the slot. Resolution passes the feats of earlier
 * slots; a table that greys rows passes the feats of every other slot.
 */
export function featRuleFlags(
  feat: Feat,
  slot: FeatSlot,
  context: PrereqContext,
  taken: TakenFeat[],
): FeatFlag[] {
  const flags: FeatFlag[] = []
  const text = prerequisiteText(feat.prerequisites)
  const met = prerequisitesMet(feat, context)
  if (met === 'unmet') {
    flags.push({ kind: 'prerequisite', message: `Prerequisite not met: ${text}` })
  } else if (met === 'unknown') {
    flags.push({
      kind: 'unchecked',
      message: `Prerequisite could not be checked: ${text}`,
    })
  }

  const same = taken.filter(
    (t) => t.feat.baseName === feat.baseName && t.feat.source === feat.source,
  )
  if (!feat.repeatable && same.length > 0) {
    flags.push({
      kind: 'repeat',
      message: 'Already taken; this feat is not repeatable',
      takenIn: same[0].slotLabel,
    })
  } else if (feat.name !== feat.baseName) {
    const twin = same.find((t) => t.feat.key === feat.key)
    if (twin) {
      flags.push({
        kind: 'repeat',
        message: 'Already taken with this option',
        takenIn: twin.slotLabel,
      })
    }
  }

  const cats = slot.categories
  if (
    cats !== 'any' &&
    !slot.named.includes(feat.key) &&
    !cats.includes(feat.category ?? '')
  ) {
    flags.push({
      kind: 'category',
      message:
        cats.length === 0
          ? 'Not the feat this slot grants'
          : `Not in the ${orLabels(cats)} feat category`,
    })
  }
  return flags
}

/** Resolve every slot, its flags, and the combined effects. */
export function resolveFeats(character: Character, ctx: FeatContext): FeatSummary {
  const featByKey = new Map(ctx.feats.map((f) => [f.key, f]))
  const filled = featSlots(character, ctx).map((slot) =>
    fillSlot(slot, character.feats.choices[slot.id], featByKey),
  )
  const base = prereqBase(character, ctx)
  const abilityBonus: Partial<Record<AbilityKey, number>> = {}
  const hp = { perLevel: 0, flat: 0 }
  const skillSources: SkillSource[] = []
  const prior: TakenFeat[] = []

  const slots = filled.map((f, i): ResolvedFeatSlot => {
    const flags: FeatFlag[] = []
    const before = characterAbilityTotals(character, abilityBonus)
    const { slot, feat, option } = f
    const context: PrereqContext = {
      character,
      race: ctx.race,
      level: slot.origin === 'race' || slot.origin === 'background' ? 1 : base.level,
      classLevels: base.classLevels,
      abilities: before,
      priorFeats: prior.map((p) => p.feat),
      otherFeats: filled.flatMap((o, j) => (j !== i && o.feat ? [o.feat] : [])),
      features: base.features,
      proficiencies: proficiencySet(
        character,
        ctx.classByKey,
        ctx.race,
        prior.map((p) => p.feat),
      ),
    }
    const taken = prior
    const increases = option
      ? optionIncreases(option, f.choice?.abilityChoices ?? {})
      : {}

    if (!f.kind) flags.push({ kind: 'incomplete', message: 'No choice made yet' })
    else if (f.kind === 'feat' && !f.choice?.feat && !f.auto) {
      flags.push({ kind: 'incomplete', message: 'No feat chosen yet' })
    }
    if (f.missing) {
      flags.push({ kind: 'missing', message: `Feat not found in the data: ${f.missing}` })
    }
    if (option) {
      if (increasesLeft(option, f.choice?.abilityChoices ?? {}) > 0) {
        const needed = option.amounts.length
        const noun = needed === 1 ? 'ability score' : 'ability scores'
        flags.push({
          kind: 'incomplete',
          message: `Choose ${needed} ${noun} to increase`,
        })
      }
      const max = option.max ?? ABILITY_SCORE_MAX
      const over = ABILITIES.filter(
        (k) => increases[k] && before[k] + (increases[k] ?? 0) > max,
      )
      if (over.length > 0) {
        const names = over.map((k) => ABILITY_NAMES[k]).join(', ')
        flags.push({ kind: 'cap', message: `Raises ${names} above ${max}` })
      }
    }

    if (feat) {
      flags.push(...featRuleFlags(feat, slot, context, taken))

      hp.perLevel += feat.hp.perLevel
      hp.flat += feat.hp.flat
      if (feat.skills.fixed.length > 0 || feat.skills.choices.length > 0) {
        skillSources.push({
          tag: `${FEAT_SKILL_TAG_PREFIX}${slot.id}`,
          label: `Feat · ${feat.label}`,
          kind: 'feat',
          fixed: feat.skills.fixed,
          choices: feat.skills.choices,
        })
      }
      prior.push({ feat, slotLabel: slot.label })
    }

    addInto(abilityBonus, increases)
    return { ...f, context, increases, flags }
  })

  return { slots, abilityBonus, hp, skillSources }
}
