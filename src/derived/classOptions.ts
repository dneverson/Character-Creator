// The options a class, subclass or feat lets the player choose, as pick cards of the same
// kind as the others. Two shapes of the data are read, both generically:
//
// - optional features (`optionalfeatureProgression`): fighting styles, Eldritch
//   Invocations, Pact Boons, maneuvers, Metamagic, infusions, Arcane Shots, runes and
//   elemental disciplines. How many come from the progression of the class, its subclass,
//   a feat (Martial Adept) or an option already taken (Superior Technique teaches a
//   maneuver). Picks are stored in `classOptions` under `<owner tag>|<feature type>`;
//   the rules of an option read it through `Sources.options`.
// - a feature's list of other features to choose from (a Totem Spirit, a Hunter's Prey, a
//   2024 Divine Order): stored under `<class tag>|feature:<name>|<level>` as the data's
//   reference of the feature taken; only the one taken counts as held.

import type { Character } from '../character/model'
import type { ChosenOption } from '../character/spellGrants'
import type { PickCard, PickChip, PickChipDetail } from '../character/picks'
import type { SkillSource, SkillSourceKind } from '../character/skills'
import { subclassOf, type LoadedClass } from '../data/class'
import {
  FIGHTING_STYLE_TYPE,
  isRepeatable,
  progressionCount,
  readProgressions,
  requiredAt,
  type ClassOption,
  type OptionalFeatureProgression,
} from '../data/classOptions'
import type { Edition } from '../data/edition'
import { parseSkillGrants } from '../data/skills'
import { styleAppliedFor } from '../rules/fightingStyles'
import {
  FEATURE_CHOICE_FOLLOWS,
  FEATURE_GOES_WITH,
  FEATURE_OPTIONS_NOT_CHOSEN,
  VARIANT_OF_BUILD,
} from '../rules/featureChoices'
import { holderId, type Holder } from '../rules/holder'
import { AC_RULES } from '../rules/acRules'
import { INITIATIVE_RULES, PASSIVE_EDGE_RULES } from '../rules/combatRules'
import { FEATURE_PICKS } from '../rules/featurePicks'
import { OPTION_EFFECTS, SUPERIORITY_TYPES } from '../rules/optionEffects'
import { RESOURCE_RULES } from '../rules/resources'
import { SENSE_RULES } from '../rules/senseRules'
import { MOVE_RULES, SPEED_RULES } from '../rules/speedRules'
import type { Entry } from '../text/Entries'
import { optionPrereqs } from './optionPrereqs'
import { featurePickCards, featurePickWord } from './featurePicks'
import { MASTERY_MARK, masteryCards } from './weaponMastery'
import { fallbackEdition } from './edition'
import type { ClassSource, DeriveDeps, HeldFeat, Sources } from './sources'

// ---- Who offers options -------------------------------------------------------------

/** A class or feat that offers options. */
export interface OptionOwner {
  /** "class:Fighter|PHB", or a feat's slot tag "feat:<slot id>". */
  tag: string
  /** The class or the feat, by name. */
  name: string
  kind: SkillSourceKind
  /** The class level, or the character level for a feat. */
  level: number
  /** The rules edition the class or feat is written for. */
  edition?: Edition
}

/** One feature type of one owner, and how many options of it the owner has. */
export interface OptionSlot {
  /** `<owner tag>|<feature types>`: the key the picks are stored under. */
  tag: string
  owner: OptionOwner
  types: string[]
  /** The data's name of the progression: "Eldritch Invocations", "Maneuvers". */
  title: string
  count: number
  /** Options known outright, within the count (Elemental Attunement). */
  required: string[]
}

const typesKey = (types: readonly string[]) => types.join(',')

const subclassOfSource = (c: ClassSource) =>
  c.loaded ? subclassOf(c.loaded, c.row.subclass) : undefined

const totalLevel = (classes: readonly ClassSource[]) =>
  Math.max(
    1,
    classes.reduce((n, c) => n + c.level, 0),
  )

/** A class of the character as the owner of its options. */
const classOwner = (c: ClassSource, index: number, loaded: LoadedClass): OptionOwner => ({
  tag: `class:${c.row.name}|${c.row.source}`,
  name: c.row.name,
  kind: index > 0 ? 'multiclass' : 'class',
  level: c.level,
  edition: loaded.entry.edition,
})

/** The owners a character has and the progressions each gives. */
function ownersOf(
  classes: readonly ClassSource[],
  feats: readonly HeldFeat[],
): { owner: OptionOwner; progressions: OptionalFeatureProgression[] }[] {
  const out: { owner: OptionOwner; progressions: OptionalFeatureProgression[] }[] = []
  classes.forEach((c, index) => {
    if (!c.loaded || c.level < 1) return
    out.push({
      owner: classOwner(c, index, c.loaded),
      progressions: [
        ...(c.loaded.entry.optionalfeatureProgression ?? []),
        ...(subclassOfSource(c)?.optionalfeatureProgression ?? []),
      ],
    })
  })
  const level = totalLevel(classes)
  for (const { feat, source } of feats) {
    const progressions = readProgressions(feat.optionalfeatureProgression)
    if (progressions.length === 0) continue
    out.push({
      owner: {
        tag: source.tag,
        name: feat.label,
        kind: 'feat',
        level,
        edition: feat.edition,
      },
      progressions,
    })
  }
  return out
}

/**
 * Every option slot of the character: of its classes and subclasses, its feats, and the
 * options it took that teach options in turn (merged into the owner's slot of the type).
 */
export function optionSlots(
  character: Character,
  classes: readonly ClassSource[],
  feats: readonly HeldFeat[],
  catalog: readonly ClassOption[],
): OptionSlot[] {
  const slots = new Map<string, OptionSlot>()
  const add = (owner: OptionOwner, progression: OptionalFeatureProgression) => {
    const count = progressionCount(progression.progression, owner.level)
    if (count === 0) return
    const tag = `${owner.tag}|${typesKey(progression.featureType)}`
    const required = requiredAt(progression, owner.level)
    const found = slots.get(tag)
    if (found) {
      found.count += count
      found.required.push(...required)
    } else {
      slots.set(tag, {
        tag,
        owner,
        types: progression.featureType,
        title: progression.name,
        count,
        required: [...required],
      })
    }
  }
  for (const { owner, progressions } of ownersOf(classes, feats))
    for (const progression of progressions) add(owner, progression)

  // An option taken that teaches options (Superior Technique) adds to its owner's slots.
  const byKey = new Map(catalog.map((o) => [o.key, o]))
  const taught = new Set<string>()
  for (let grew = true; grew;) {
    grew = false
    for (const slot of [...slots.values()]) {
      for (const key of character.classOptions[slot.tag] ?? []) {
        const option = byKey.get(key)
        const id = `${slot.tag}>${key}`
        if (!option?.optionalfeatureProgression || taught.has(id)) continue
        taught.add(id)
        grew = true
        for (const progression of option.optionalfeatureProgression)
          add(slot.owner, progression)
      }
    }
  }
  return [...slots.values()]
}

/** The options the character holds: those picked in a slot it has, and those known outright. */
export function heldOptions(
  character: Character,
  slots: readonly OptionSlot[],
): Set<string> {
  const held = new Set<string>()
  for (const slot of slots) {
    for (const key of character.classOptions[slot.tag] ?? []) held.add(key)
    for (const key of slot.required) held.add(key)
  }
  return held
}

// ---- Features that list other features to choose from --------------------------------

/** One feature the player picks from, read from the data's reference. */
export interface FeatureOption {
  /** The data's reference: "Bear|Barbarian||Totem Warrior||3". */
  ref: string
  name: string
  holder: Holder
  level: number
  source: string
  entries: Entry[]
}

/** A feature that lists features to choose from. */
export interface FeatureChoiceSlot {
  /** `<class tag>|feature:<name>|<level>`: the key the pick is stored under. */
  tag: string
  owner: OptionOwner
  /** The feature's data identity, as the holder table writes it. */
  id: string
  name: string
  level: number
  count: number
  options: FeatureOption[]
  /** The feature whose pick this one follows (Storm Soul follows Storm Aura). */
  follows?: string
  /** The option held while none is picked: the feature an optional one would replace. */
  fallback?: string
  /** The choice of an optional class feature or the feature it replaces. */
  variant?: true
}

type Json = Record<string, unknown>
const isJson = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

interface PoolFeature {
  /** The data's reference of the feature, with its class's book filled in. */
  ref: string
  name: string
  source: string
  level: number
  entries: Entry[]
  holder: Holder
  /** An optional class feature (Tasha's), by the data's mark. */
  variant?: true
}

/** Resolves a class feature reference: "Protector|Cleric|XPHB|1|XPHB". */
function classFeatureByRef(loaded: LoadedClass, ref: string): PoolFeature | undefined {
  const [name, className, classSource, level] = ref.split('|')
  const source = classSource || 'PHB'
  const f = loaded.file.classFeature?.find(
    (x) =>
      x.name === name &&
      x.className === className &&
      x.classSource === source &&
      x.level === Number(level),
  )
  return f
    ? {
        ref: [name, className, source, level].join('|'),
        name: f.name,
        source: f.source,
        level: f.level,
        entries: f.entries,
        holder: {
          classFeature: { className: f.className, source: f.source, name: f.name },
        },
        ...(f.isClassFeatureVariant && { variant: true as const }),
      }
    : undefined
}

/** Resolves a subclass feature reference: "Bear|Barbarian||Totem Warrior||3". */
function subclassFeatureByRef(loaded: LoadedClass, ref: string): PoolFeature | undefined {
  const [name, className, classSource, shortName, subclassSource, level] = ref.split('|')
  const f = loaded.file.subclassFeature?.find(
    (x) =>
      x.name === name &&
      x.className === className &&
      x.classSource === (classSource || 'PHB') &&
      x.subclassShortName === shortName &&
      x.subclassSource === (subclassSource || 'PHB') &&
      x.level === Number(level),
  )
  return f
    ? {
        ref: [
          name,
          className,
          classSource || 'PHB',
          shortName,
          subclassSource || 'PHB',
          level,
        ].join('|'),
        name: f.name,
        source: f.source,
        level: f.level,
        entries: f.entries,
        holder: {
          subclassFeature: {
            className: f.className,
            shortName: f.subclassShortName,
            source: f.source,
            name: f.name,
          },
        },
        ...(f.isClassFeatureVariant && { variant: true as const }),
      }
    : undefined
}

function byRef(loaded: LoadedClass, entry: Json): PoolFeature | undefined {
  if (entry.type === 'refClassFeature' && typeof entry.classFeature === 'string')
    return classFeatureByRef(loaded, entry.classFeature)
  if (entry.type === 'refSubclassFeature' && typeof entry.subclassFeature === 'string')
    return subclassFeatureByRef(loaded, entry.subclassFeature)
  return undefined
}

const refOf = (entry: Json) =>
  typeof entry.classFeature === 'string'
    ? entry.classFeature
    : typeof entry.subclassFeature === 'string'
      ? entry.subclassFeature
      : ''

/** An options block of features, found in a feature's text. */
export interface FeatureOptionsBlock {
  feature: PoolFeature
  count: number
  /** The block's entries, as the data has them. */
  entries: Json[]
}

/**
 * Every options block in the text of a feature, following the features it references
 * (Path of the Totem Warrior references Totem Spirit, whose text has the options).
 */
export function optionsBlocksOf(
  loaded: LoadedClass,
  top: PoolFeature,
): FeatureOptionsBlock[] {
  const out: FeatureOptionsBlock[] = []
  const seen = new Set<string>()
  const visit = (feature: PoolFeature) => {
    const id = holderId(feature.holder)
    if (seen.has(id)) return
    seen.add(id)
    const walk = (entry: unknown) => {
      if (Array.isArray(entry)) return entry.forEach(walk)
      if (!isJson(entry)) return
      if (entry.type === 'options') {
        const entries = Array.isArray(entry.entries) ? entry.entries.filter(isJson) : []
        out.push({
          feature,
          count: typeof entry.count === 'number' ? entry.count : 1,
          entries,
        })
        return
      }
      const nested = byRef(loaded, entry)
      if (nested) return visit(nested)
      walk(entry.entries)
    }
    walk(feature.entries)
  }
  visit(top)
  return out
}

/** The class's and its subclass's features up to its level, as the data's pool holds them. */
export function poolFeaturesOf(c: ClassSource): PoolFeature[] {
  const loaded = c.loaded
  if (!loaded) return []
  const out: PoolFeature[] = []
  for (const item of loaded.entry.classFeatures ?? []) {
    if (typeof item === 'object' && item.gainSubclassFeature) continue
    const ref = typeof item === 'string' ? item : item.classFeature
    const [name, className, classSource, level] = ref.split('|')
    const f = classFeatureByRef(
      loaded,
      [name, className, classSource || loaded.entry.source, level].join('|'),
    )
    if (f && f.level <= c.level) out.push(f)
  }
  const subclass = subclassOfSource(c)
  for (const ref of subclass?.subclassFeatures ?? []) {
    const [name, className, classSource, shortName, subclassSource, level] =
      ref.split('|')
    const f = subclassFeatureByRef(
      loaded,
      [
        name,
        className,
        classSource || subclass?.classSource,
        shortName,
        subclassSource || subclass?.source,
        level,
      ].join('|'),
    )
    if (f && f.level <= c.level) out.push(f)
  }
  return out
}

const isFeatureRef = (e: Json) =>
  e.type === 'refClassFeature' || e.type === 'refSubclassFeature'

/** The features of the character's classes that list features to choose from. */
export function featureChoiceSlots(classes: readonly ClassSource[]): FeatureChoiceSlot[] {
  const out: FeatureChoiceSlot[] = []
  classes.forEach((c, index) => {
    const loaded = c.loaded
    if (!loaded || c.level < 1) return
    const owner = classOwner(c, index, loaded)
    for (const top of poolFeaturesOf(c)) {
      for (const block of optionsBlocksOf(loaded, top)) {
        const id = holderId(block.feature.holder)
        if (id in FEATURE_OPTIONS_NOT_CHOSEN) continue
        if (block.entries.length === 0 || !block.entries.every(isFeatureRef)) continue
        const options = block.entries.flatMap((e): FeatureOption[] => {
          const f = byRef(loaded, e)
          return f ? [{ ...f, ref: refOf(e) }] : []
        })
        if (options.length === 0 || block.feature.level > c.level) continue
        out.push({
          tag: `${owner.tag}|feature:${block.feature.name}|${block.feature.level}`,
          owner,
          id,
          name: block.feature.name,
          level: block.feature.level,
          count: block.count,
          options,
          follows: FEATURE_CHOICE_FOLLOWS[id],
        })
      }
    }
  })
  return out
}

// ---- Optional class features ----------------------------------------------------------

/** The name of the feature an optional class feature replaces, as its first line says. */
export function replacedName(entries: readonly Entry[]): string | undefined {
  const first = entries.find((e): e is string => typeof e === 'string') ?? ''
  // A tag reads as its first part here: "{@classFeature Roving|Ranger|XPHB|6}" is Roving.
  const plain = first.replace(/\{@\w+ ([^|}]*)[^}]*\}/g, '$1')
  return /replaces the (.+?) feature/i.exec(plain)?.[1]
}

/**
 * The features and every feature their text takes in by reference, each once: the
 * optional Channel Divinity of a 2014 Paladin is in the text of its Sacred Oath.
 */
function withReferenced(loaded: LoadedClass, features: readonly PoolFeature[]) {
  const out = new Map<string, PoolFeature>()
  const visit = (f: PoolFeature) => {
    if (out.has(f.ref)) return
    out.set(f.ref, f)
    const walk = (entry: unknown) => {
      if (Array.isArray(entry)) return entry.forEach(walk)
      if (!isJson(entry)) return
      const nested = byRef(loaded, entry)
      if (nested) return visit(nested)
      walk(entry.entries)
    }
    walk(f.entries)
  }
  features.forEach(visit)
  return [...out.values()]
}

/**
 * A class's features up to its level with those their text takes in, the text of the
 * feature that brings the subclass too (a 2014 Sacred Oath names the optional Channel
 * Divinity of Tasha's).
 */
export function featurePool(c: ClassSource): PoolFeature[] {
  const loaded = c.loaded
  if (!loaded) return []
  const subclassGains = (loaded.entry.classFeatures ?? []).flatMap((item) => {
    if (typeof item !== 'object' || !item.gainSubclassFeature) return []
    const [name, className, classSource, level] = item.classFeature.split('|')
    const f = classFeatureByRef(
      loaded,
      [name, className, classSource || loaded.entry.source, level].join('|'),
    )
    return f ? [f] : []
  })
  return withReferenced(loaded, [...poolFeaturesOf(c), ...subclassGains]).filter(
    (f) => f.level <= c.level,
  )
}

/** The data identity of the feature a reference entry names, as `holderId` writes it. */
function refEntryId(entry: Json): string | undefined {
  if (entry.type === 'refClassFeature' && typeof entry.classFeature === 'string') {
    const [name, className, classSource, , source] = entry.classFeature.split('|')
    return holderId({
      classFeature: { className, source: source || classSource || 'PHB', name },
    })
  }
  if (entry.type === 'refSubclassFeature' && typeof entry.subclassFeature === 'string') {
    const [name, className, , shortName, subclassSource, , source] =
      entry.subclassFeature.split('|')
    return holderId({
      subclassFeature: {
        className,
        shortName,
        source: source || subclassSource || 'PHB',
        name,
      },
    })
  }
  return undefined
}

/**
 * The entries without the features they take in by reference that are not had: the
 * Beast Master's text names Ranger's Companion and its optional Primal Companion, and
 * shows only the one taken.
 */
export function heldEntries(
  entries: readonly Entry[],
  withheld: (id: string) => boolean,
): Entry[] {
  return entries.flatMap((entry): Entry[] => {
    if (typeof entry !== 'object') return [entry]
    const id = isJson(entry) ? refEntryId(entry) : undefined
    if (id) return withheld(id) ? [] : [entry]
    const inner: unknown = Reflect.get(entry, 'entries')
    if (!Array.isArray(inner)) return [entry]
    return [{ ...entry, entries: heldEntries(inner, withheld) }]
  })
}

/** Features held, or not, whatever the player picks. */
export interface FixedFeature {
  id: string
  held: boolean
}

/** A feature held while one of the features named is (Deft Explorer Improvement). */
export interface TiedFeature {
  id: string
  with: string[]
}

/** The optional class features of the character's classes, and what goes with them. */
export interface VariantChoices {
  /** A card for each optional feature that replaces another: one or the other is held. */
  slots: FeatureChoiceSlot[]
  fixed: FixedFeature[]
  ties: TiedFeature[]
}

/**
 * The optional class features (Tasha's) of the character's classes. One that replaces a
 * feature is a choice, the replaced feature held until the player takes the optional one;
 * one that replaces nothing is held. Neither is offered or held without its book.
 */
export function variantChoices(
  classes: readonly ClassSource[],
  books: readonly string[],
): VariantChoices {
  const out: VariantChoices = { slots: [], fixed: [], ties: [] }
  const idOf = (f: PoolFeature) => holderId(f.holder)
  const option = (f: PoolFeature): FeatureOption => ({
    ref: f.ref,
    name: f.name,
    holder: f.holder,
    level: f.level,
    source: f.source,
    entries: f.entries,
  })
  classes.forEach((c, index) => {
    const loaded = c.loaded
    if (!loaded || c.level < 1) return
    const pool = featurePool(c)
    for (const f of pool) {
      const id = idOf(f)
      const goes = FEATURE_GOES_WITH[id]
      if (goes) {
        out.ties.push({ id, with: pool.filter((p) => goes.includes(p.name)).map(idOf) })
        continue
      }
      if (!f.variant) continue
      const name = replacedName(f.entries)
      const replaced = pool.filter((p) => !p.variant && p.name === name)
      const build = VARIANT_OF_BUILD[id]
      if (build) {
        const fits =
          loaded.entry.name === build.className &&
          c.row.subclass?.shortName === build.subclass
        out.fixed.push({ id, held: fits })
        if (fits) for (const p of replaced) out.fixed.push({ id: idOf(p), held: false })
        continue
      }
      if (!books.includes(f.source)) {
        out.fixed.push({ id, held: false })
        continue
      }
      if (replaced.length === 0) continue
      out.slots.push({
        tag: `class:${c.row.name}|${c.row.source}|feature:${f.name}|${f.level}`,
        owner: classOwner(c, index, loaded),
        id,
        name: f.name,
        level: f.level,
        count: 1,
        options: [...replaced, f].map(option),
        fallback: replaced[0].ref,
        variant: true,
      })
    }
  })
  return out
}

/** Which features of the lists are offered, and which of them the player took. */
export interface FeatureChoiceState {
  offered: ReadonlySet<string>
  chosen: ReadonlySet<string>
}

/** Whether a feature of a choice is not held: offered, and not the one taken. */
export const featureWithheld = (state: FeatureChoiceState, id: string) =>
  state.offered.has(id) && !state.chosen.has(id)

export function featureChoiceState(
  character: Character,
  slots: readonly FeatureChoiceSlot[],
  variants: Pick<VariantChoices, 'fixed' | 'ties'> = { fixed: [], ties: [] },
): FeatureChoiceState {
  const offered = new Set<string>()
  const chosen = new Set<string>()
  const takenNames = new Map<string, string[]>()
  for (const slot of slots) {
    if (slot.follows) continue
    const picks = character.classOptions[slot.tag] ?? []
    const names = slot.options.filter((o) => picks.includes(o.ref)).map((o) => o.name)
    takenNames.set(`${slot.owner.tag}|${slot.name}`, names)
  }
  for (const slot of slots) {
    const picks = character.classOptions[slot.tag] ?? []
    const followed = slot.follows
      ? takenNames.get(`${slot.owner.tag}|${slot.follows}`)
      : undefined
    const kept = picks.length === 0 ? slot.fallback : undefined
    for (const option of slot.options) {
      const id = holderId(option.holder)
      offered.add(id)
      const taken = followed
        ? followed.includes(option.name)
        : picks.includes(option.ref) || option.ref === kept
      if (taken) chosen.add(id)
    }
  }
  for (const { id, held } of variants.fixed) {
    offered.add(id)
    if (held) chosen.add(id)
  }
  const state = { offered, chosen }
  for (const tie of variants.ties) {
    if (tie.with.some((w) => !featureWithheld(state, w))) chosen.add(tie.id)
  }
  for (const tie of variants.ties) offered.add(tie.id)
  return state
}

// ---- The cards ------------------------------------------------------------------------

/** How a feature type is named in the card, the table and the checklist. */
interface TypeWords {
  one: string
  many: string
}

const TYPE_WORDS: { prefix: string; words: TypeWords }[] = [
  {
    prefix: FIGHTING_STYLE_TYPE,
    words: { one: 'fighting style', many: 'fighting styles' },
  },
  { prefix: 'EI', words: { one: 'invocation', many: 'invocations' } },
  { prefix: 'PB', words: { one: 'pact boon', many: 'pact boons' } },
  { prefix: 'MV', words: { one: 'maneuver', many: 'maneuvers' } },
  { prefix: 'MM', words: { one: 'Metamagic option', many: 'Metamagic options' } },
  { prefix: 'AI', words: { one: 'infusion', many: 'infusions' } },
  { prefix: 'AS', words: { one: 'Arcane Shot option', many: 'Arcane Shot options' } },
  { prefix: 'RN', words: { one: 'rune', many: 'runes' } },
  { prefix: 'ED', words: { one: 'elemental discipline', many: 'elemental disciplines' } },
]

/** The words for a slot's options: "invocation", "invocations". */
export function typeWords(types: readonly string[], title: string): TypeWords {
  const found = TYPE_WORDS.find((t) => types.some((type) => type.startsWith(t.prefix)))
  if (found) return found.words
  const one = title.toLowerCase()
  return { one, many: one.endsWith('s') ? one : `${one}s` }
}

/** What a rules table does with an option it has a row for, in the words of its card. */
const APPLIED_BY: { holders: readonly { holder: Holder }[]; text: string }[] = [
  { holders: SENSE_RULES, text: 'the sense it gives is listed with your senses' },
  { holders: MOVE_RULES, text: 'the speed it gives is listed with your speeds' },
  { holders: SPEED_RULES, text: 'it is added to your walking speed' },
  { holders: AC_RULES, text: 'it is added to your armor class' },
  {
    holders: PASSIVE_EDGE_RULES,
    text: 'its advantage is counted in your passive scores',
  },
  { holders: INITIATIVE_RULES, text: 'it is counted in your initiative' },
  {
    holders: OPTION_EFFECTS,
    text: 'what it adds is shown on the numbers it changes and on its row of the Features & Traits tab',
  },
  {
    holders: RESOURCE_RULES,
    text: 'its uses are counted on the sheet, beside its row of the Features & Traits tab',
  },
]

/**
 * What the app does with an option, each part by the table or the data field that applies
 * it: none when the player applies it in play.
 */
export function optionAppliedParts(option: ClassOption): string[] {
  const id = holderId({ option: option.key })
  const parts = APPLIED_BY.filter((a) =>
    a.holders.some((r) => holderId(r.holder) === id),
  ).map((a) => a.text)
  if (FEATURE_PICKS.some((p) => p.holders.some((h) => holderId(h) === id)))
    parts.push('what it asks you to choose is a card of its own in Class Features')
  if (option.additionalSpells?.length)
    parts.push('the spells it gives are listed in your spell grants, in Spells')
  if (option.skillProficiencies?.length)
    parts.push('the skill proficiencies it gives are on your skill list')
  if (option.optionalfeatureProgression?.length)
    parts.push('what it teaches is offered on a card of its own')
  if (option.featProgression?.length)
    parts.push('the feat it gives is a feat slot of its own, in Feats')
  if (option.types.some((t) => SUPERIORITY_TYPES.includes(t)))
    parts.push(
      'the size of your superiority dice is shown on its row of the Features & Traits tab',
    )
  return parts
}

/** Options the app applies, and how. */
export function optionApplied(option: ClassOption): string {
  const style = styleAppliedFor({ option: option.key })
  if (style) return style
  const parts = optionAppliedParts(option)
  if (parts.length > 0) return `Automatic: ${parts.join('; ')}.`
  return 'You apply it in play: its full text is on the Features & Traits tab of the sheet.'
}

const EDITION_YEAR: Record<Edition, string> = { classic: '2014', one: '2024' }

function usesText(consumes: ClassOption['consumes']): string {
  if (!consumes) return ''
  const { name, amount, amountMin, amountMax } = consumes
  if (amountMin !== undefined && amountMax !== undefined)
    return `${amountMin} to ${amountMax} ${name}s`
  const n = amount ?? 1
  return n === 1 ? `1 ${name}` : `${n} ${name}s`
}

/** The facts of an option for its row: what matters to the choice, from the data. */
function optionFacts(
  option: ClassOption,
  prereq: ReturnType<typeof optionPrereqs>,
  edition: Edition,
): PickChipDetail['facts'] {
  const facts: PickChipDetail['facts'] = [
    { label: 'Prerequisite', value: prereq.text },
    { label: 'Level', value: prereq.level !== undefined ? String(prereq.level) : '' },
    { label: 'Source', value: option.source },
    { label: 'Edition', value: EDITION_YEAR[edition] },
  ]
  const uses = usesText(option.consumes)
  if (uses) facts.push({ label: 'Uses', value: uses })
  const items = (option.prerequisite ?? []).flatMap((p) => p.item ?? [])
  if (items.length > 0) facts.push({ label: 'Item', value: items.join('; ') })
  if (isRepeatable(option)) facts.push({ label: 'Repeatable', value: 'Yes' })
  facts.push({ label: 'In this app', value: optionApplied(option) })
  return facts
}

const DM = ' - allowed with DM approval'

/** Why an option is not a standard pick for this owner, or nothing when it is. */
function editionReason(
  option: ClassOption,
  owner: OptionOwner,
  edition: Edition,
  inBooks: (key: string) => boolean,
): string | undefined {
  if (owner.edition === 'one' && (option.reprintedAs ?? []).some((k) => inBooks(k)))
    return `Replaced by its 2024 version${DM}`
  if (owner.edition === 'classic' && edition === 'one')
    return `A 2024 option, and ${owner.name} uses the 2014 rules${DM}`
  return undefined
}

/** What the cards read besides the character. */
export interface OptionCardContext {
  character: Character
  slots: readonly OptionSlot[]
  featureSlots: readonly FeatureChoiceSlot[]
  held: ReadonlySet<string>
  /** Class and subclass feature names the character has, lower case. */
  features: ReadonlySet<string>
  catalog: readonly ClassOption[]
  editionOf: (source: string) => Edition
}

/**
 * The row name of each offered option. Two printings that share a name ("Thirsting
 * Blade" in PHB and XPHB) are told apart by their edition year; every other option
 * keeps its plain name. The data audit proves no two printings of a name share an
 * edition.
 */
export function sameNameLabels(
  offered: readonly ClassOption[],
  editionOf: (source: string) => Edition,
): (option: ClassOption) => string {
  const counts = new Map<string, number>()
  for (const o of offered) counts.set(o.name, (counts.get(o.name) ?? 0) + 1)
  return (option) =>
    (counts.get(option.name) ?? 0) < 2
      ? option.name
      : `${option.name} (${EDITION_YEAR[editionOf(option.source)]})`
}

/** "Class", "Multiclass" or "Feat": what a label of an owner's option starts with. */
const labelPrefix = (owner: OptionOwner) =>
  owner.kind === 'feat' ? 'Feat' : owner.kind === 'multiclass' ? 'Multiclass' : 'Class'

const cardLabel = (owner: OptionOwner, what: string) =>
  `${labelPrefix(owner)} - ${owner.name} ${what}`

/** The instance of a repeatable option a chip stands for: "Agonizing Blast|XPHB#2". */
export const REPEAT_MARK = '#'
export const optionKeyOf = (value: string) => value.split(REPEAT_MARK)[0]

function optionCard(
  slot: OptionSlot,
  ctx: OptionCardContext,
  takenBy: Map<string, string>,
): PickCard {
  const { character } = ctx
  const picks = character.classOptions[slot.tag] ?? []
  const count = Math.max(0, slot.count - slot.required.length)
  const full = picks.length >= count
  const books = new Set(character.selectedBooks)
  const keys = new Set(ctx.catalog.map((o) => o.key.toLowerCase()))
  const inBooks = (key: string) =>
    keys.has(key.toLowerCase()) && books.has(key.split('|')[1] ?? '')
  const offered = ctx.catalog.filter(
    (o) =>
      picks.includes(o.key) ||
      (o.types.some((t) => slot.types.includes(t)) &&
        books.has(o.source) &&
        !slot.required.includes(o.key)),
  )
  const prereqCtx = { character, held: ctx.held, features: ctx.features }
  const nameOf = sameNameLabels(offered, ctx.editionOf)
  const chips = offered.flatMap((o): PickChip[] => {
    const edition = ctx.editionOf(o.source)
    const prereq = optionPrereqs(o.prerequisite, prereqCtx)
    const detail = { facts: optionFacts(o, prereq, edition), entries: o.entries }
    const unmet =
      prereq.status === 'unmet'
        ? `Needs ${prereq.missing}${DM}`
        : editionReason(o, slot.owner, edition, inBooks)
    const name = nameOf(o)
    const base = {
      kind: 'option' as const,
      label: name,
      detail,
      ...(unmet ? { unmet } : {}),
    }
    const times = picks.filter((p) => p === o.key).length
    if (isRepeatable(o)) {
      const taken = Array.from({ length: times }, (_, i): PickChip => ({
        ...base,
        value: i === 0 ? o.key : `${o.key}${REPEAT_MARK}${i + 1}`,
        label: i === 0 ? name : `${name} (again)`,
        state: 'picked',
      }))
      const again: PickChip = {
        ...base,
        value: times === 0 ? o.key : `${o.key}${REPEAT_MARK}${times + 1}`,
        label: times === 0 ? name : `${name} (again)`,
        state: full ? 'full' : 'available',
      }
      return [...taken, again]
    }
    if (times > 0) return [{ ...base, value: o.key, state: 'picked' }]
    const by = takenBy.get(o.key)
    if (by) return [{ ...base, value: o.key, state: 'taken', takenBy: by }]
    return [{ ...base, value: o.key, state: full ? 'full' : 'available' }]
  })
  const words = typeWords(slot.types, slot.title)
  const known = slot.required.map((k) => k.split('|')[0])
  const style = slot.types.some((t) => t.startsWith(FIGHTING_STYLE_TYPE))
  return {
    tag: slot.tag,
    label: cardLabel(slot.owner, style ? words.one : slot.title.toLowerCase()),
    name: slot.owner.name,
    kind: slot.owner.kind,
    noun: words.many,
    kinds: ['option'],
    count,
    used: picks.length,
    left: Math.max(0, count - picks.length),
    over: picks.length > count,
    picks,
    chips,
    note: [
      known.length > 0 ? `${known.join(', ')}: known outright, besides these.` : '',
      style
        ? 'Each style can be taken once. Its rule is applied to your attacks and armor class.'
        : `Each ${words.one} can be taken once unless its text says it is repeatable. One whose prerequisite is not met is greyed, with the reason.`,
    ]
      .filter(Boolean)
      .join(' '),
  }
}

/** What the card of an optional class feature says: what it replaces, and the default. */
function variantNote(slot: FeatureChoiceSlot): string {
  const kept = slot.options.find((o) => o.ref === slot.fallback)?.name ?? ''
  return `${slot.name} (level ${slot.level}) is an optional class feature that replaces ${kept}: take one or the other, with your DM's approval. Until you choose, you have ${kept}.`
}

function featureCard(slot: FeatureChoiceSlot, ctx: OptionCardContext): PickCard {
  const picks = ctx.character.classOptions[slot.tag] ?? []
  const full = picks.length >= slot.count
  const chips = slot.options.map((o): PickChip => ({
    kind: 'option',
    value: o.ref,
    label: o.name,
    state: picks.includes(o.ref) ? 'picked' : full ? 'full' : 'available',
    detail: {
      facts: [
        { label: 'Level', value: String(o.level) },
        { label: 'Source', value: o.source },
      ],
      entries: o.entries,
    },
  }))
  return {
    tag: slot.tag,
    label: cardLabel(slot.owner, slot.name),
    name: slot.owner.name,
    kind: slot.owner.kind,
    noun: `${slot.name} options`,
    kinds: ['option'],
    count: slot.count,
    used: picks.length,
    left: Math.max(0, slot.count - picks.length),
    over: picks.length > slot.count,
    picks,
    chips,
    note: slot.variant
      ? variantNote(slot)
      : `${slot.name} (level ${slot.level}): choose ${slot.count === 1 ? 'one' : slot.count}. Only the option taken is on your sheet.`,
  }
}

/** A card for every option slot and every feature list to choose from. */
export function classOptionCards(ctx: OptionCardContext): PickCard[] {
  // An option is taken by another card when another slot holds it.
  const takenElsewhere = (slot: OptionSlot) => {
    const others = new Map<string, string>()
    for (const other of ctx.slots) {
      if (other.tag === slot.tag) continue
      for (const key of ctx.character.classOptions[other.tag] ?? [])
        others.set(key, other.owner.name)
    }
    return others
  }
  return [
    ...ctx.slots.map((slot) => optionCard(slot, ctx, takenElsewhere(slot))),
    ...ctx.featureSlots.filter((s) => !s.follows).map((slot) => featureCard(slot, ctx)),
  ]
}

/**
 * Whether a card picks fighting styles: its slot's feature types, the last part of
 * its tag, are fighting styles. The creator offers these in Combat, where their
 * rules apply, and every other option card in Class Features.
 */
export function isFightingStyleCard(card: PickCard): boolean {
  const types = card.tag.slice(card.tag.lastIndexOf('|') + 1).split(',')
  return types.some((t) => t.startsWith(FIGHTING_STYLE_TYPE))
}

/** The words a card's open picks are counted in, for the checklist: "invocation choice". */
export function cardChoiceWord(
  card: PickCard,
  slots: readonly OptionSlot[],
  featureSlots: readonly FeatureChoiceSlot[],
): string {
  const slot = slots.find((s) => s.tag === card.tag)
  if (slot) return `${typeWords(slot.types, slot.title).one} choice`
  const feature = featureSlots.find((s) => s.tag === card.tag)
  if (feature) return `${feature.name} choice`
  if (card.tag.endsWith(MASTERY_MARK)) return 'weapon mastery choice'
  return featurePickWord(card.tag) ?? 'class option choice'
}

/** The class and subclass feature names the character has, lower case. */
export function featureNames(classes: readonly ClassSource[]): Set<string> {
  return new Set(
    classes.flatMap((c) => poolFeaturesOf(c).map((f) => f.name.toLowerCase())),
  )
}

/** The option cards of a character, from its sources. */
export function optionCards(sources: Sources, deps: DeriveDeps): PickCard[] {
  const cards = classOptionCards({
    character: sources.character,
    slots: sources.optionSlots,
    featureSlots: sources.featureSlots,
    held: sources.options,
    features: featureNames(sources.classes),
    catalog: deps.optionCatalog ?? [],
    editionOf: deps.editionOf ?? fallbackEdition,
  })
  return [
    ...cards,
    ...featurePickCards(sources, { items: deps.items, catalog: deps.optionCatalog }),
    ...masteryCards(sources, deps.items),
  ]
}

/** The options held, as the spell grants read them (Pact of the Tome's cantrips). */
export function chosenOptions(sources: Sources, deps: DeriveDeps): ChosenOption[] {
  const editionOf = deps.editionOf ?? fallbackEdition
  const byKey = new Map((deps.optionCatalog ?? []).map((o) => [o.key, o]))
  return [...sources.options].flatMap((key): ChosenOption[] => {
    const option = byKey.get(key)
    return option
      ? [
          {
            key,
            name: option.name,
            edition: editionOf(option.source),
            additionalSpells: option.additionalSpells,
          },
        ]
      : []
  })
}

/** The skill proficiencies of the options held (Beguiling Influence), as skill sources. */
export function optionSkillSources(
  sources: Sources,
  catalog: readonly ClassOption[] = [],
): SkillSource[] {
  const byKey = new Map(catalog.map((o) => [o.key, o]))
  const seen = new Set<string>()
  return sources.optionSlots.flatMap((slot) =>
    [...slot.required, ...(sources.character.classOptions[slot.tag] ?? [])].flatMap(
      (key): SkillSource[] => {
        const option = byKey.get(key)
        if (!option?.skillProficiencies || seen.has(key)) return []
        seen.add(key)
        const { fixed, choices } = parseSkillGrants(option.skillProficiencies)
        if (fixed.length === 0 && choices.length === 0) return []
        return [
          {
            tag: `option:${key}`,
            label: `${labelPrefix(slot.owner)} - ${option.name}`,
            kind: slot.owner.kind,
            fixed,
            choices,
          },
        ]
      },
    ),
  )
}
