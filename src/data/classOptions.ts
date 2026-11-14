// The optional features a class, a subclass or a feat lets the player choose from: the
// fighting styles, Eldritch Invocations and Pact Boons, maneuvers, Metamagic, artificer
// infusions, Arcane Shots, runes and elemental disciplines. The data files each one as an
// optional feature of a feature type ("FS:F" for the Fighter's fighting styles, "EI" for
// the invocations), and a class, subclass or feat names the types it offers, and how many
// at each level, in its `optionalfeatureProgression`.

import { memoizeContent } from '../content/epoch'
import type { Entry } from '../text/Entries'
import { fetchData } from './dataClient'

/** What an option asks of the character before it can be chosen, as the data writes it. */
export interface OptionPrerequisite {
  level?:
    | number
    | {
        level: number
        class?: { name: string; source?: string }
        subclass?: { name: string }
      }
  /** 2014: the Pact Boon it needs ("Tome"). */
  pact?: string
  /** Other options it needs, lower case "name|source". */
  optionalfeature?: string[]
  /** A spell it needs: "eldritch blast#c", or a choice of the spells of a filter. */
  spell?: (string | { choose: string; entry?: string; entrySummary?: string })[]
  /** The item it is put on (an infusion), in words. */
  item?: string[]
  /** A requirement the data only writes in words. */
  otherSummary?: { entry: string; entrySummary?: string }
}

/** How many options of the feature types a source gives, by level. */
export interface OptionalFeatureProgression {
  name: string
  featureType: string[]
  /**
   * Level -> how many are known from that level on ({"3": 3, "7": 5}); a list is the
   * count at each level from 1; "*" is the count at every level (a feat).
   */
  progression: number[] | Record<string, number>
  /** Level -> options known outright at that level, inside the count. */
  required?: Record<string, string[]>
}

export interface ClassOption {
  /** "Defense|PHB": the key a pick is stored by. */
  key: string
  name: string
  source: string
  /** The feature types it is offered under: "FS:F", "EI". */
  types: string[]
  /** The book's rules text for the option. */
  entries: Entry[]
  prerequisite?: OptionPrerequisite[]
  /** The 2024 versions that replace a 2014 option: "Agonizing Blast|XPHB". */
  reprintedAs?: string[]
  /** What using it spends: "Superiority Die", "Sorcery Point" with an amount. */
  consumes?: { name: string; amount?: number; amountMin?: number; amountMax?: number }
  additionalSpells?: unknown[]
  skillProficiencies?: unknown[]
  senses?: unknown[]
  /** Options it teaches in turn (Superior Technique teaches a maneuver). */
  optionalfeatureProgression?: OptionalFeatureProgression[]
  /** Feats it gives (Lessons of the First Ones gives an Origin feat). */
  featProgression?: unknown[]
}

type RawOption = Omit<
  ClassOption,
  'key' | 'types' | 'entries' | 'optionalfeatureProgression'
> & {
  featureType?: string[]
  entries?: Entry[]
  optionalfeatureProgression?: unknown[]
}

interface OptionalFeaturesFile {
  optionalfeature: RawOption[]
}

/** The type prefix of the fighting styles ("FS:F", "FS:P"). */
export const FIGHTING_STYLE_TYPE = 'FS:'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/** The progressions a record names, read safely: a feat's data is not typed. */
export function readProgressions(raw: unknown): OptionalFeatureProgression[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((block): OptionalFeatureProgression[] => {
    if (!isRecord(block)) return []
    const { name, featureType, progression, required } = block
    if (typeof name !== 'string' || !Array.isArray(featureType)) return []
    const types = featureType.filter((t): t is string => typeof t === 'string')
    let counts: OptionalFeatureProgression['progression'] | undefined
    if (Array.isArray(progression)) counts = progression.map((n) => (isCount(n) ? n : 0))
    else if (isRecord(progression))
      counts = Object.fromEntries(
        Object.entries(progression).filter((e): e is [string, number] => isCount(e[1])),
      )
    if (types.length === 0 || !counts) return []
    const out: OptionalFeatureProgression = {
      name,
      featureType: types,
      progression: counts,
    }
    if (isRecord(required))
      out.required = Object.fromEntries(
        Object.entries(required).map(([at, keys]) => [
          at,
          Array.isArray(keys)
            ? keys.filter((k): k is string => typeof k === 'string')
            : [],
        ]),
      )
    return [out]
  })
}

/**
 * How many options a progression gives at a level: the list's entry for the level, the
 * count of the highest level reached, or the "*" count of a feat.
 */
export function progressionCount(
  progression: OptionalFeatureProgression['progression'],
  level: number,
): number {
  if (Array.isArray(progression)) {
    const at = Math.min(Math.max(0, Math.floor(level)), progression.length)
    return at === 0 ? 0 : progression[at - 1]
  }
  if ('*' in progression) return progression['*']
  let count = 0
  let reached = 0
  for (const [at, amount] of Object.entries(progression)) {
    const n = Number(at)
    if (n <= level && n >= reached) {
      reached = n
      count = amount
    }
  }
  return count
}

/** The options a progression knows outright by a level ("Elemental Attunement|PHB"). */
export function requiredAt(
  progression: OptionalFeatureProgression,
  level: number,
): string[] {
  return Object.entries(progression.required ?? {})
    .filter(([at]) => Number(at) <= level)
    .flatMap(([, keys]) => keys)
}

/** Every optional feature of the books, by name. */
export const loadClassOptions = memoizeContent(async (): Promise<ClassOption[]> => {
  const data = await fetchData<OptionalFeaturesFile>('optionalfeatures.json')
  return data.optionalfeature
    .map(({ featureType, entries, optionalfeatureProgression, ...rest }): ClassOption => {
      const option: ClassOption = {
        ...rest,
        key: `${rest.name}|${rest.source}`,
        types: featureType ?? [],
        entries: entries ?? [],
      }
      const nested = readProgressions(optionalfeatureProgression)
      if (nested.length > 0) option.optionalfeatureProgression = nested
      return option
    })
    .filter((o) => o.types.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name))
})

/** Whether an option says it can be gained more than once (a "Repeatable" block). */
export function isRepeatable(option: Pick<ClassOption, 'entries'>): boolean {
  const walk = (entry: unknown): boolean => {
    if (Array.isArray(entry)) return entry.some(walk)
    if (!isRecord(entry)) return false
    if (entry.name === 'Repeatable') return true
    return walk(entry.entries)
  }
  return walk(option.entries)
}
