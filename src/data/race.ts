// Race/species data: resolve `_copy`, merge each subrace onto its base race by
// the rules the data is written to, and give the races that follow the lineage
// rules their increases and languages.

import { fetchData } from './dataClient'
import { resolveCopy, type Copyable, type CopyRef } from './copy'
import { parseAbilityOptions, type AbilityOption } from './abilityOptions'
import { parseFeatGrants, type FeatGrant } from './feats'
import { withSwaps, type OriginValue } from '../rules/customOrigin'
import { PROFICIENCY_FIELDS, type ProficiencyField } from './grants'
import type { Speed } from './labels'
import { ABILITIES } from '../dice/dice'
import type { Entry } from '../text/Entries'
import type { RaceRef } from '../character/model'

/** The grants a race lists plainly, every item given. */
const LIST_FIELDS = ['resist', 'immune', 'vulnerable', 'conditionImmune'] as const

type ListField = (typeof LIST_FIELDS)[number]
type Grants = Partial<Record<ProficiencyField | ListField, unknown[]>>

/** In the data, `null` takes away what the entry would otherwise inherit. */
type Clearable<T> = T | null

export interface RaceEntry
  extends Copyable, Partial<Record<ProficiencyField | ListField, Clearable<unknown[]>>> {
  edition?: 'classic' | 'one'
  size?: Clearable<string[]>
  speed?: Clearable<Speed>
  ability?: Clearable<unknown[]>
  darkvision?: Clearable<number>
  blindsight?: Clearable<number>
  creatureTypes?: Clearable<string[]>
  /** Set when the race takes its increases and languages from the lineage rules. */
  lineage?: Clearable<string | boolean>
  additionalSpells?: Clearable<unknown[]>
  feats?: unknown[]
  entries?: Entry[]
  raceName?: string
  raceSource?: string
  /** On a subrace: the fields that replace the base race's instead of adding to them. */
  overwrite?: Record<string, boolean>
  /** The versions the data offers of it: one per option of a trait to choose. */
  _versions?: RaceVersionEntry[]
}

/** A version of a race: its own fields over the race's (`null` takes one away). */
interface RaceVersionEntry {
  name?: string
  source?: string
  _mod?: CopyRef['_mod']
  _abstract?: unknown
  [k: string]: unknown
}

interface RacesFile {
  race: RaceEntry[]
  subrace?: RaceEntry[]
}

/** A selectable race/species (a base race, or a base merged with one subrace). */
export interface PlayableRace extends Grants {
  key: string
  name: string
  baseName: string
  /** The book of the base race; a subrace may come from another (the EGW Pallid Elf). */
  baseSource: string
  /** The book of the subrace when there is one, else of the race. */
  source: string
  subraceName?: string
  edition?: 'classic' | 'one'
  size?: string[]
  speed?: Speed
  darkvision?: number
  blindsight?: number
  creatureTypes?: string[]
  /**
   * The ways to take the race's ability score increases. Empty when the race
   * gives none (a 2024 species takes them from its background).
   */
  abilityOptions: AbilityOption[]
  /** The spells the race grants, as the data lists them. */
  additionalSpells?: unknown[]
  /** Feats the race grants (base race and subrace grants, in that order). */
  featGrants: FeatGrant[]
  entries?: Entry[]
  /**
   * A trait of the race with options, of which the player takes one (Custom Lineage's
   * Variable Trait: darkvision or a skill). Until one is taken, the race gives none of
   * what only some options give.
   */
  traitChoice?: RaceTraitChoice
  /** The option of `traitChoice` this race is with, once taken. */
  trait?: string
  /**
   * The set of the race's spells the option taken gives, by its name in the data
   * ("Drow"): the race's spells are its sets, of which this one is taken.
   */
  spellSet?: string
  /** The sizes to choose from, once one is taken and `size` holds it alone. */
  sizeOptions?: string[]
  /**
   * The proficiencies and languages the player swapped under Customizing Your Origin: no
   * longer given, each replaced by a pick of its own.
   */
  originSwaps?: OriginValue[]
}

/** One option of a race's trait: what it says, and the race with it. */
export interface RaceTraitOption {
  name: string
  text: Entry[]
  race: PlayableRace
}

export interface RaceTraitChoice {
  /** The trait's name: "Variable Trait", "Kobold Legacy". */
  title: string
  options: RaceTraitOption[]
}

type Block = Record<string, unknown>
const isBlock = (value: unknown): value is Block => !!value && typeof value === 'object'

/**
 * A subrace's blocks on top of its race's. A subrace adds to what the race
 * grants, block by block, and where both name the same thing the subrace's stands
 * (its data restates the total). A subrace marked as overwriting replaces instead.
 */
function mergeBlocks(
  base: Clearable<unknown[]> | undefined,
  sub: Clearable<unknown[]> | undefined,
  overwrite: boolean | undefined,
): Clearable<unknown[]> | undefined {
  if (sub === undefined) return base
  if (sub === null || overwrite || !base?.length) return sub
  return Array.from({ length: Math.max(base.length, sub.length) }, (_, i) => ({
    ...(isBlock(base[i]) ? base[i] : {}),
    ...(isBlock(sub[i]) ? sub[i] : {}),
  }))
}

const sameName = (entry: Entry, name: string) =>
  isBlock(entry) &&
  typeof entry.name === 'string' &&
  entry.name.trim().toLowerCase() === name.trim().toLowerCase()

/** A subrace's traits after its race's; a trait can name the one it replaces. */
function mergeEntries(base: Entry[] = [], sub: Entry[] = []): Entry[] {
  const merged = [...base]
  for (const entry of sub) {
    const replaces = isBlock(entry) && isBlock(entry.data) ? entry.data.overwrite : null
    const at =
      typeof replaces === 'string' ? merged.findIndex((e) => sameName(e, replaces)) : -1
    if (at >= 0) merged[at] = entry
    else merged.push(entry)
  }
  return merged
}

/** The subrace's own value where it states one (even "none"), else its race's. */
const inherit = <T>(sub: T | undefined, base: T | undefined) =>
  sub === undefined ? base : sub

/** A base race with one of its subraces applied. */
function mergeSubrace(base: RaceEntry, sub: RaceEntry): RaceEntry {
  const merged: RaceEntry = {
    ...base,
    edition: sub.edition ?? base.edition,
    size: inherit(sub.size, base.size),
    speed: inherit(sub.speed, base.speed),
    darkvision: inherit(sub.darkvision, base.darkvision),
    blindsight: inherit(sub.blindsight, base.blindsight),
    creatureTypes: inherit(sub.creatureTypes, base.creatureTypes),
    additionalSpells: inherit(sub.additionalSpells, base.additionalSpells),
    ability: mergeBlocks(base.ability, sub.ability, sub.overwrite?.ability),
    entries: mergeEntries(base.entries, sub.entries),
  }
  // The proficiencies a race lists as blocks, where several blocks are alternatives.
  for (const field of PROFICIENCY_FIELDS)
    merged[field] = mergeBlocks(base[field], sub[field], sub.overwrite?.[field])
  for (const field of LIST_FIELDS) {
    const all = sub[field] === null ? [] : [...(base[field] ?? []), ...(sub[field] ?? [])]
    merged[field] = all.filter((item, i) => all.indexOf(item) === i)
  }
  return merged
}

// The lineage rules (2020 on): a race no longer names its increases or languages,
// every such race takes them the same way.
const LINEAGE_ABILITY: Record<string, number[][] | undefined> = {
  VRGR: [
    [2, 1],
    [1, 1, 1],
  ],
  UA1: [[2, 1]],
}
const LINEAGE_LANGUAGES = [{ common: true, anyStandard: 1 }]

/** A race with what the lineage rules give it, where its data leaves that out. */
function withLineage(entry: RaceEntry): RaceEntry {
  if (!entry.lineage) return entry
  const spreads =
    typeof entry.lineage === 'string' ? LINEAGE_ABILITY[entry.lineage] : undefined
  return {
    ...entry,
    ability:
      entry.ability ??
      spreads?.map((weights) => ({
        choose: { weighted: { from: [...ABILITIES], weights } },
      })),
    languageProficiencies: entry.languageProficiencies ?? LINEAGE_LANGUAGES,
  }
}

function toPlayable(base: RaceEntry, subrace?: RaceEntry): PlayableRace {
  const merged = withLineage(subrace ? mergeSubrace(base, subrace) : base)
  const owner = subrace ?? base
  const versions = traitVersions(owner)
  if (!versions) return playableOf(base, subrace, merged)
  const options = versions.map((v): RaceTraitOption => {
    const name = versionName(owner, v)
    const spellSet = spellSetOf(merged, name)
    // The race's own sets of spells stay, the option's taken, so a choice made of the
    // set's spells keeps its place.
    const race = spellSet
      ? { ...versionOf(merged, v), additionalSpells: merged.additionalSpells }
      : versionOf(merged, v)
    return {
      name,
      text: versionText(v),
      race: { ...playableOf(base, subrace, race), trait: name, spellSet },
    }
  })
  // Before an option is taken, none of what only some options give, nor what each
  // gives its own of.
  const cleared = new Set(
    versions.flatMap((v) => Object.keys(v).filter((k) => v[k] === null)),
  )
  for (const field of Object.keys(versions[0]))
    if (!field.startsWith('_') && versions.every((v) => v[field] != null))
      cleared.add(field)
  cleared.delete('name')
  cleared.delete('source')
  const common: RaceEntry = { ...merged }
  for (const field of cleared) common[field] = null
  return {
    ...playableOf(base, subrace, common),
    traitChoice: { title: traitTitle(versions), options },
  }
}

/**
 * The versions of a race that are the options of one of its traits: each only takes
 * away what the others give, or sets a number of its own. A version that sets spells is
 * an option when the race names a set of its spells for it (the 2024 Elf's lineages);
 * versions written as templates (a dragonborn's colors) are not options.
 */
function traitVersions(entry: RaceEntry): RaceVersionEntry[] | undefined {
  const versions = entry._versions
  if (!versions || versions.length < 2) return undefined
  const ok = versions.every(
    (v) =>
      !v._abstract &&
      (v.additionalSpells === undefined ||
        v.additionalSpells === null ||
        spellSetOf(entry, versionName(entry, v)) !== undefined),
  )
  return ok ? versions : undefined
}

/** The names of the race's sets of spells, of which the player takes one. */
function spellSets(entry: RaceEntry): string[] {
  const blocks = (entry.additionalSpells ?? []).filter(isBlock)
  const names = blocks.flatMap((b) => (typeof b.name === 'string' ? [b.name] : []))
  return blocks.length > 1 && names.length === blocks.length ? names : []
}

/** The set of the race's spells an option names: "Drow" of "Drow Lineage". */
function spellSetOf(entry: RaceEntry, option: string): string | undefined {
  return spellSets(entry)
    .filter((set) => option === set || option.startsWith(`${set} `))
    .sort((a, b) => b.length - a.length)[0]
}

/** The option's own name: "Darkvision" of "Custom Lineage; Darkvision". */
function versionName(owner: RaceEntry, v: RaceVersionEntry): string {
  const name = v.name ?? ''
  const prefix = `${owner.name}; `
  return name.startsWith(prefix) ? name.slice(prefix.length) : name
}

/** The replacements of a version's text: what its option says. */
const replacements = (v: RaceVersionEntry) => {
  const mods = v._mod?.entries
  return (Array.isArray(mods) ? mods : mods ? [mods] : []).filter(
    (m) => m.mode === 'replaceArr',
  )
}

function versionText(v: RaceVersionEntry): Entry[] {
  return replacements(v).flatMap((m) => {
    const items = Array.isArray(m.items) ? m.items : [m.items]
    return items.flatMap((item): Entry[] =>
      isBlock(item) && Array.isArray(item.entries) ? (item.entries as Entry[]) : [],
    )
  })
}

/** The trait the versions are options of, by the text they replace. */
function traitTitle(versions: RaceVersionEntry[]): string {
  const replaced = replacements(versions[0])[0]?.replace
  return typeof replaced === 'string'
    ? replaced.replace(/\s*\(Choose 1\)$/i, '')
    : 'Trait'
}

/** A race entry with a version's fields and text over it. */
function versionOf(entry: RaceEntry, v: RaceVersionEntry): RaceEntry {
  const { _mod, _abstract, name, source, ...own } = v
  void _abstract
  void name
  void source
  const copy: RaceEntry = {
    ...entry,
    ...own,
    _copy: { name: entry.name, source: entry.source, _mod },
  }
  return resolveCopy(copy, () => entry)
}

function playableOf(
  base: RaceEntry,
  subrace: RaceEntry | undefined,
  race: RaceEntry,
): PlayableRace {
  const source = subrace?.source ?? base.source
  const subraceName = subrace?.name
  const playable: PlayableRace = {
    key: `${base.name}|${base.source}|${subraceName ?? ''}|${source}`,
    name: subraceName ? `${base.name} (${subraceName})` : base.name,
    baseName: base.name,
    baseSource: base.source,
    source,
    subraceName,
    edition: race.edition,
    size: race.size ?? undefined,
    speed: race.speed ?? undefined,
    darkvision: race.darkvision ?? undefined,
    blindsight: race.blindsight ?? undefined,
    creatureTypes: race.creatureTypes ?? undefined,
    abilityOptions: parseAbilityOptions(race.ability ?? undefined),
    additionalSpells: race.additionalSpells ?? undefined,
    // Base and subrace grants are separate feats, not alternatives of one.
    featGrants: [...parseFeatGrants(base.feats), ...parseFeatGrants(subrace?.feats)],
    entries: race.entries ?? [],
  }
  for (const field of [...PROFICIENCY_FIELDS, ...LIST_FIELDS])
    playable[field] = race[field] ?? []
  return playable
}

/** What names a subrace beyond its name and source, as a `_copy` gives it. */
const COPY_IDENTITY = ['raceName', 'raceSource'] as const

/**
 * Finds the original a `_copy` names among records of its own kind (a race among races, a
 * subrace among subraces), by name and source and by the race a subrace's reference also
 * names: two races may each have an "Ixalan" subrace from the same book.
 */
function copyFinder(records: readonly RaceEntry[]) {
  return (name: string, source: string, ref: CopyRef) =>
    records.find(
      (r) =>
        r.name === name &&
        r.source === source &&
        COPY_IDENTITY.every((key) => !(key in ref) || r[key] === ref[key]),
    )
}

/** Load all selectable races (base races and base+subrace combinations). */
export async function loadRaces(): Promise<PlayableRace[]> {
  const data = await fetchData<RacesFile>('races.json')
  const races = data.race.map((r) => resolveCopy(r, copyFinder(data.race)))
  const findSubrace = copyFinder(data.subrace ?? [])
  const subraces = (data.subrace ?? []).map((s) => resolveCopy(s, findSubrace))

  const playable: PlayableRace[] = []
  for (const race of races) {
    const subs = subraces.filter(
      (s) => s.raceName === race.name && s.raceSource === race.source,
    )
    if (subs.length === 0) {
      playable.push(toPlayable(race))
    } else {
      for (const sub of subs) playable.push(toPlayable(race, sub))
    }
  }
  playable.sort((a, b) => a.name.localeCompare(b.name))
  return playable
}

/** What a race rule names: a base race by its book, or one subrace by the subrace's book. */
export interface RaceHolder {
  baseName: string
  source: string
  subraceName?: string
  /** The option of the race's trait taken ("Taunka Lineage"), for a rule of one option. */
  trait?: string
}

/**
 * Whether a character's race is one a race rule names. A rule of the base race holds for
 * each of its subraces, from whatever book (the PHB Elf's for the EGW Pallid Elf); a rule
 * of a subrace holds for that subrace. A record that lacks the base race's book (one saved
 * before it was kept) is read as from the subrace's book.
 */
export function holdsRace(
  race:
    | Pick<RaceRef, 'baseName' | 'baseSource' | 'source' | 'subraceName' | 'trait'>
    | undefined,
  want: RaceHolder,
): boolean {
  if (!race || race.baseName !== want.baseName) return false
  if (want.trait !== undefined && race.trait !== want.trait) return false
  if (want.subraceName === undefined)
    return (race.baseSource ?? race.source) === want.source
  return race.subraceName === want.subraceName && race.source === want.source
}

/**
 * Whether a trait of this name is still among the race's entries, at any depth: a subrace
 * that replaces a trait of its race (`data.overwrite`) takes it out of the merged race.
 */
export function hasTrait(race: Pick<PlayableRace, 'entries'>, name: string): boolean {
  const wanted = name.trim().toLowerCase()
  const walk = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(walk)
    if (!isBlock(value)) return false
    if (typeof value.name === 'string' && value.name.trim().toLowerCase() === wanted)
      return true
    return walk(value.entries) || walk(value.items)
  }
  return walk(race.entries)
}

/**
 * The playable race a character's race reference points to, if loaded: with the option
 * of its trait and the size the character took, when it has those to take.
 */
export function findPlayableRace(
  races: PlayableRace[] | null | undefined,
  ref: RaceRef | undefined,
): PlayableRace | undefined {
  if (!ref) return undefined
  const race = races?.find(
    (r) =>
      r.baseName === ref.baseName &&
      r.source === ref.source &&
      (r.subraceName ?? '') === (ref.subraceName ?? ''),
  )
  // A save from before the 2024 lineages were options names the set of spells taken.
  const taken = race?.traitChoice?.options.find(
    (o) => o.name === ref.trait || (!!ref.trait && o.race.spellSet === ref.trait),
  )
  const withTrait = taken ? { ...taken.race, traitChoice: race?.traitChoice } : race
  const sized = withTrait && ref.size ? withSize(withTrait, ref.size) : withTrait
  return sized && withSwaps(sized, ref)
}

/** The spells the race gives: of its sets, the one its option takes. */
export const raceSpells = (race: Pick<PlayableRace, 'additionalSpells' | 'spellSet'>) =>
  race.spellSet === undefined
    ? race.additionalSpells
    : race.additionalSpells?.filter((b) => isBlock(b) && b.name === race.spellSet)

/** The size of the race, once there is one: a race of several waits for the player's. */
export const raceSize = (race: Pick<PlayableRace, 'size'> | undefined) =>
  race?.size?.length === 1 ? race.size[0] : undefined

/** A race of several sizes as the size the player took, when it is one of them. */
function withSize(race: PlayableRace, size: string): PlayableRace {
  const sizes = race.size ?? []
  return sizes.length > 1 && sizes.includes(size)
    ? { ...race, size: [size], sizeOptions: sizes }
    : race
}
