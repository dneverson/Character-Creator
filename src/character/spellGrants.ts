// The spells a character is given by something other than a class pick: a species,
// a background, a feat, a class or subclass, a chosen optional feature (an
// invocation). Every one is read from the `additionalSpells` of its source by this
// one resolver, so a spell is granted the same way whatever gives it.
//
// A block holds the places a spell is kept - always known (`known`), always
// prepared (`prepared`), cast without a slot (`innate`), or only added to a class's
// list (`expanded`) - each keyed by the level it comes at (`"3"`, or `_` for none),
// and the spells there are named, chosen from a filter (`choose`) or a whole list
// (`all`). Where several named blocks stand side by side (a Tiefling legacy, a
// Magic Initiate list) the player takes one, and the name is the `variant`.

import type { AbilityKey } from '../dice/dice'
import {
  parseSpellFilter,
  SPELL_PATHS,
  type SpellFilter,
  type SpellPath,
} from '../data/grants'
import { subclassesFor, type LoadedClass } from '../data/class'
import type { PlayableBackground } from '../data/background'
import type { PlayableRace } from '../data/race'
import type { Spell } from '../data/spells'
import type { Character, SpellGrantChoices } from './model'
import type { ResolvedFeatSlot } from './feats'

export type SpellGrantOrigin =
  'race' | 'background' | 'feat' | 'class' | 'subclass' | 'option'

/** The spellcasting ability of a grant: fixed, one of a few, or the class's own. */
export type GrantAbility =
  | { kind: 'fixed'; key: AbilityKey }
  | { kind: 'choose'; keys: AbilityKey[] }
  | { kind: 'inherit' }

export interface SpellGrant {
  /** Stable, unique: the key of the player's choice for it. */
  id: string
  /** The source it comes from; every grant of one source shares it. */
  sourceId: string
  /** What gives it: "Life Domain", "Tiefling (Infernal)", "Fey Touched (Fey Touched)". */
  from: string
  origin: SpellGrantOrigin
  /** For a class or subclass: the class it belongs to ("Cleric|PHB"). */
  classKey?: string
  mode: SpellPath
  /** The level it comes at (class level for a class or subclass); 0 for none. */
  gate: number
  /** Not yet unlocked at the character's level. */
  locked: boolean
  /** A named spell ("name|source#c"): the source is empty when the data gives none. */
  spell?: { name: string; source: string; cantrip: boolean }
  /** A spell the player chooses, `count` of them, from what the filter allows. */
  pick?: { count: number; filter: SpellFilter }
  /** A whole list added (`expanded`), by a filter. */
  all?: SpellFilter
  /** For `expanded` named spells: the spell level group ("s1"). */
  spellLevel?: number
  /** How it is cast: "At will", "1 per long rest"; empty for always known or prepared. */
  uses: string
  ability?: GrantAbility
  /** Where the player's pick among `ability` choices is kept: one per block of spells. */
  abilityId?: string
  /** The named set it belongs to, when the source offers several. */
  variant?: string
  /** The rules edition of the giving source, which picks which book a bare name means. */
  edition?: Spell['edition']
}

/** A source that offers named sets of spells: the player takes one. */
export interface SpellVariantSet {
  id: string
  from: string
  names: string[]
  selected?: string
  /** What each named set gives, taken or not, so the sets can be compared before one is taken. */
  options: { name: string; grants: SpellGrant[] }[]
}

export interface ResolvedSpellGrants {
  grants: SpellGrant[]
  variants: SpellVariantSet[]
  /** Every id the sources can give, taken or not: a stored choice outside this is orphaned. */
  knownIds: Set<string>
}

/** An optional feature (an invocation) the character has taken. */
export interface ChosenOption {
  key: string
  name: string
  edition?: Spell['edition']
  additionalSpells?: unknown[]
}

export interface SpellGrantContext {
  race?: PlayableRace
  background?: PlayableBackground
  featSlots: Pick<ResolvedFeatSlot, 'slot' | 'feat'>[]
  classByKey: Map<string, LoadedClass>
  /** The optional features taken; none until the character can choose them. */
  options?: ChosenOption[]
}

type Json = Record<string, unknown>
const isJson = (value: unknown): value is Json =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const ABILITY_KEYS: readonly string[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const isAbility = (value: unknown): value is AbilityKey =>
  typeof value === 'string' && ABILITY_KEYS.includes(value)

function abilityOf(raw: unknown): GrantAbility | undefined {
  if (raw === 'inherit') return { kind: 'inherit' }
  if (isAbility(raw)) return { kind: 'fixed', key: raw }
  if (isJson(raw) && Array.isArray(raw.choose)) {
    const keys = raw.choose.filter(isAbility)
    if (keys.length > 0) return { kind: 'choose', keys }
  }
  return undefined
}

const gateOf = (key: string) => (/^\d+$/.test(key) ? Number(key) : 0)

const times = (n: number, per: string) => `${n} per ${per}`

/** How a leaf of an `innate` (or other) place is cast, with the spells it holds. */
interface Leaf {
  spells: unknown[]
  uses: string
}

/** The ways a place's value holds spells: a list, or lists by how they are cast. */
function leavesOf(value: unknown, resource: string | undefined): Leaf[] {
  if (Array.isArray(value)) return [{ spells: value, uses: '' }]
  if (!isJson(value)) return []
  const out: Leaf[] = []
  const byCount = (field: unknown, label: (n: string) => string) => {
    if (!isJson(field)) return
    for (const [count, spells] of Object.entries(field))
      if (Array.isArray(spells)) out.push({ spells, uses: label(count) })
  }
  if (Array.isArray(value._)) out.push({ spells: value._, uses: '' })
  if (Array.isArray(value.will)) out.push({ spells: value.will, uses: 'At will' })
  if (Array.isArray(value.ritual)) out.push({ spells: value.ritual, uses: 'Ritual only' })
  byCount(value.daily, (n) =>
    n === 'pb'
      ? 'Proficiency bonus times per long rest'
      : isAbility(n)
        ? `${n.toUpperCase()} modifier times per long rest`
        : n.endsWith('e')
          ? `${times(Number(n.slice(0, -1)), 'long rest')} each`
          : times(Number(n), 'long rest'),
  )
  byCount(value.rest, (n) => times(Number(n), 'short or long rest'))
  byCount(value.resource, (n) => `Costs ${n} ${resource ?? 'points'}`)
  return out
}

/** Where a source's grants live, so the id and the label are made once. */
interface Source {
  id: string
  from: string
  origin: SpellGrantOrigin
  classKey?: string
  /** Level reached in the source's own terms (class level, else character level). */
  level: number
  edition?: Spell['edition']
  blocks: unknown[] | undefined
}

/** One source's grants, in the order the data lists them. */
function grantsOf(
  source: Source,
  chosen: SpellGrantChoices,
  variants: SpellVariantSet[],
  knownIds: Set<string>,
): SpellGrant[] {
  const blocks = (source.blocks ?? []).filter(isJson)
  // Several named blocks are alternatives; the player takes one.
  const named = blocks.length > 1 && blocks.every((b) => typeof b.name === 'string')
  const variantId = `${source.id}:variant`
  let taken: string | undefined
  if (named) {
    const names = blocks.map((b) => String(b.name))
    taken = chosen[variantId]?.variant
    if (taken !== undefined && !names.includes(taken)) taken = undefined
    variants.push({
      id: variantId,
      from: source.from,
      names,
      selected: taken,
      options: names.map((name) => ({ name, grants: [] })),
    })
  }
  const offered = named ? variants[variants.length - 1].options : []

  const out: SpellGrant[] = []
  blocks.forEach((block, b) => {
    const variant = named ? String(block.name) : undefined
    const resource =
      typeof block.resourceName === 'string' ? block.resourceName : undefined
    const ability = abilityOf(block.ability)
    const abilityId = ability?.kind === 'choose' ? `${source.id}:${b}:ability` : undefined
    if (abilityId) knownIds.add(abilityId)
    for (const mode of SPELL_PATHS) {
      const place = block[mode]
      if (!isJson(place)) continue
      for (const [key, value] of Object.entries(place)) {
        const spellLevel = /^s\d$/.test(key) ? Number(key.slice(1)) : undefined
        const gate = gateOf(key)
        for (const [l, leaf] of leavesOf(value, resource).entries()) {
          leaf.spells.forEach((item, i) => {
            const base = {
              id: `${source.id}:${b}:${mode}:${key}:${l}:${i}`,
              sourceId: source.id,
              from: source.from,
              origin: source.origin,
              classKey: source.classKey,
              mode,
              gate,
              locked: gate > source.level,
              spellLevel,
              // A bare list under `innate` is cast whenever, without a slot.
              uses: leaf.uses || (mode === 'innate' ? 'At will' : ''),
              ability,
              abilityId,
              variant,
              edition: source.edition,
            }
            const grant = spellItem(item)
            if (!grant) return
            knownIds.add(base.id)
            const given = { ...base, ...grant }
            offered.find((o) => o.name === variant)?.grants.push(given)
            if (named && variant !== taken) return
            out.push(given)
          })
        }
      }
    }
  })
  return out
}

/** One entry of a place: a name, a choice from a filter, or a whole list. */
function spellItem(
  item: unknown,
): Pick<SpellGrant, 'spell' | 'pick' | 'all'> | undefined {
  if (typeof item === 'string') {
    // "dancing lights|xphb#c": a name, its book, and a marker for a cantrip.
    const cantrip = item.endsWith('#c')
    const [name, source = ''] = item.replace('#c', '').split('|')
    return name.trim() ? { spell: { name: name.trim(), source, cantrip } } : undefined
  }
  if (!isJson(item)) return undefined
  if (typeof item.choose === 'string')
    return {
      pick: {
        count: typeof item.count === 'number' ? item.count : 1,
        filter: parseSpellFilter(item.choose),
      },
    }
  if (typeof item.all === 'string') return { all: parseSpellFilter(item.all) }
  return undefined
}

/**
 * Every spell grant the character has, from its species, background, feats, classes
 * and subclasses, and the optional features it has taken.
 */
export function resolveSpellGrants(
  character: Character,
  ctx: SpellGrantContext,
): ResolvedSpellGrants {
  // A character with no class yet is still level 1 for what a species gives.
  const level = Math.max(
    1,
    character.classes.reduce((sum, c) => sum + c.level, 0),
  )
  const sources: Source[] = []
  const { race, background } = ctx
  if (race)
    sources.push({
      id: 'race',
      from: race.name,
      origin: 'race',
      level,
      edition: race.edition,
      blocks: race.additionalSpells,
    })
  if (background)
    sources.push({
      id: 'background',
      from: background.name,
      origin: 'background',
      level,
      edition: background.edition,
      blocks: background.additionalSpells,
    })
  for (const { slot, feat } of ctx.featSlots)
    if (feat)
      sources.push({
        id: `feat:${slot.id}`,
        from: feat.label,
        origin: 'feat',
        level,
        edition: feat.edition,
        blocks: feat.additionalSpells,
      })
  for (const c of character.classes) {
    const classKey = `${c.name}|${c.source}`
    const loaded = ctx.classByKey.get(classKey)
    if (!loaded) continue
    const { entry } = loaded
    sources.push({
      id: `class:${classKey}`,
      from: entry.name,
      origin: 'class',
      classKey,
      level: c.level,
      edition: entry.edition,
      blocks: entry.additionalSpells,
    })
    const subclass = c.subclass
      ? subclassesFor(loaded).find(
          (s) => s.shortName === c.subclass?.shortName && s.source === c.subclass?.source,
        )
      : undefined
    if (subclass)
      sources.push({
        id: `subclass:${classKey}`,
        from: subclass.name,
        origin: 'subclass',
        classKey,
        level: c.level,
        edition: subclass.edition ?? entry.edition,
        blocks: subclass.additionalSpells,
      })
  }
  for (const option of ctx.options ?? [])
    sources.push({
      id: `option:${option.key}`,
      from: option.name,
      origin: 'option',
      level,
      edition: option.edition,
      blocks: option.additionalSpells,
    })

  const variants: SpellVariantSet[] = []
  const knownIds = new Set<string>()
  const grants = sources.flatMap((source) =>
    grantsOf(source, character.spellGrants, variants, knownIds),
  )
  for (const v of variants) knownIds.add(v.id)
  return { grants, variants, knownIds }
}

/** The spells of the data by lower case name, for turning a grant's named spell into one. */
export function spellsByName(spells: Spell[]): Map<string, Spell[]> {
  const byName = new Map<string, Spell[]>()
  for (const spell of spells) {
    const name = spell.name.toLowerCase()
    byName.set(name, [...(byName.get(name) ?? []), spell])
  }
  return byName
}

/**
 * The spell a grant names. The data gives a book when it means one; otherwise the
 * spell of the giving source's edition (a 2014 feat's "light" is the Player's
 * Handbook one), else the first there is.
 */
export function grantedSpell(
  grant: SpellGrant,
  byName: Map<string, Spell[]>,
): Spell | undefined {
  if (!grant.spell) return undefined
  const named = byName.get(grant.spell.name.toLowerCase()) ?? []
  const book = grant.spell.source.toLowerCase()
  return (
    named.find((spell) => book !== '' && spell.source.toLowerCase() === book) ??
    named.find((spell) => spell.edition === grant.edition) ??
    named[0]
  )
}
