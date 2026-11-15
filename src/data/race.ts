// Race/species data: resolve `_copy`, merge each subrace onto its base race by
// the rules the data is written to, and give the races that follow the lineage
// rules their increases and languages.

import { fetchData } from './dataClient'
import { resolveCopy, type Copyable, type CopyRef } from './copy'
import { parseAbilityOptions, type AbilityOption } from './abilityOptions'
import { parseFeatGrants, type FeatGrant } from './feats'
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
  const race = withLineage(subrace ? mergeSubrace(base, subrace) : base)
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
}

/**
 * Whether a character's race is one a race rule names. A rule of the base race holds for
 * each of its subraces, from whatever book (the PHB Elf's for the EGW Pallid Elf); a rule
 * of a subrace holds for that subrace. A record that lacks the base race's book (one saved
 * before it was kept) is read as from the subrace's book.
 */
export function holdsRace(
  race: Pick<RaceRef, 'baseName' | 'baseSource' | 'source' | 'subraceName'> | undefined,
  want: RaceHolder,
): boolean {
  if (!race || race.baseName !== want.baseName) return false
  if (want.subraceName === undefined)
    return (race.baseSource ?? race.source) === want.source
  return race.subraceName === want.subraceName && race.source === want.source
}

/** The playable race a character's race reference points to, if loaded. */
export function findPlayableRace(
  races: PlayableRace[] | null | undefined,
  ref: RaceRef | undefined,
): PlayableRace | undefined {
  if (!ref) return undefined
  return races?.find(
    (r) =>
      r.baseName === ref.baseName &&
      r.source === ref.source &&
      (r.subraceName ?? '') === (ref.subraceName ?? ''),
  )
}
