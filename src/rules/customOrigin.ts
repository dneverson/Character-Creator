// Tasha's Cauldron of Everything, Customizing Your Origin (an optional rule, so a switch
// of the character's): each ability score increase the race gives can go to an ability of
// the player's choice. The increases keep their amounts and stay on different abilities,
// as the race had them; what the race gave outright the player places too. A 2024
// species gives no increases (they come from the background), so the rule has nothing
// to move there. Its other parts let each language of the race be replaced with one of a
// list, and each proficiency it gives with another, by the Proficiency Swaps table.

import type { RaceRef } from '../character/model'
import type { AbilityOption } from '../data/abilityOptions'
import { readGrant, valueText, type PickSpec } from '../data/grants'
import type { PlayableRace } from '../data/race'
import { parseSkillGrants, skillLabel } from '../data/skills'
import { ABILITIES } from '../dice/dice'

export const CUSTOM_ORIGIN_NOTE =
  "Tasha's Customizing Your Origin: each increase goes to an ability of your choice, a different one each."

/** A way to take a race's increases with every one of them placed by the player. */
export function customizedOption(option: AbilityOption): AbilityOption {
  const amounts = [...Object.values(option.fixed), ...option.amounts]
    .filter((n) => n > 0)
    .sort((a, b) => b - a)
  return {
    fixed: {},
    amounts,
    from: [...ABILITIES],
    ...(option.max ? { max: option.max } : {}),
    note: CUSTOM_ORIGIN_NOTE,
  }
}

/** Whether the rule can apply to the race: it gives increases to move. */
export const canCustomizeOrigin = (race: PlayableRace) =>
  race.edition !== 'one' && race.abilityOptions.length > 0

/** The ways to take the race's increases, under the rule when the character uses it. */
export function raceAbilityOptions(race: PlayableRace, ref?: RaceRef): AbilityOption[] {
  return ref?.customOrigin && canCustomizeOrigin(race)
    ? race.abilityOptions.map(customizedOption)
    : race.abilityOptions
}

// ---- Languages and proficiencies -----------------------------------------------------

/** A proficiency or language the race gives outright, which the rule lets the player swap. */
export interface OriginValue {
  kind: 'skill' | 'language' | 'tool' | 'weapon' | 'armor'
  /** The data's own key, lower case and without a source: "longsword", "elvish". */
  key: string
}

/** The id a swap is stored under in the character's race: "weapon:longsword". */
export const swapId = (value: OriginValue) => `${value.kind}:${value.key}`

/** The tag the replacement of a swap is picked under, one per swap. */
export const swapTag = (value: OriginValue) => `race:swap:${swapId(value)}`

/** A row of the Proficiency Swaps table: what a proficiency of its kind can become. */
export interface SwapRow {
  /** The table's words for the proficiency. */
  proficiency: string
  /** The table's words for what replaces it. */
  replacement: string
  /** The replacement as a pick of a grant. */
  pick: Omit<PickSpec, 'id' | 'count' | 'text'>
}

/** The languages the rule lets a language of the race be replaced with (TCE p.8). */
export const ORIGIN_LANGUAGES = [
  'Abyssal',
  'Celestial',
  'Common',
  'Deep Speech',
  'Draconic',
  'Dwarvish',
  'Elvish',
  'Giant',
  'Gnomish',
  'Goblin',
  'Halfling',
  'Infernal',
  'Orc',
  'Primordial',
  'Sylvan',
  'Undercommon',
]

const SIMPLE_WEAPON = 'type=simple weapon'

/** A simple or martial weapon, or a tool; `filter` holds the weapon to simple ones. */
const weaponOrTool = (filter?: string): SwapRow['pick'] => ({
  kinds: ['weapon', 'tool'],
  from: [],
  any: ['anyWeapon', 'anyTool'],
  ...(filter ? { filter } : {}),
})

export type SwapRowKey =
  'skill' | 'armor' | 'simpleWeapon' | 'martialWeapon' | 'tool' | 'language'

/** The Proficiency Swaps table (TCE p.8), with the rule's Languages part as one more row. */
export const PROFICIENCY_SWAPS: Record<SwapRowKey, SwapRow> = {
  skill: {
    proficiency: 'Skill',
    replacement: 'Skill',
    pick: { kinds: ['skill'], from: [], any: ['anySkill'] },
  },
  armor: {
    proficiency: 'Armor',
    replacement: 'Simple/martial weapon or tool',
    pick: weaponOrTool(),
  },
  simpleWeapon: {
    proficiency: 'Simple weapon',
    replacement: 'Simple weapon or tool',
    pick: weaponOrTool(SIMPLE_WEAPON),
  },
  martialWeapon: {
    proficiency: 'Martial weapon',
    replacement: 'Simple/martial weapon or tool',
    pick: weaponOrTool(),
  },
  tool: {
    proficiency: 'Tool',
    replacement: 'Tool or simple weapon',
    pick: weaponOrTool(SIMPLE_WEAPON),
  },
  language: {
    proficiency: 'Language',
    replacement: 'Language of the list',
    pick: {
      kinds: ['language'],
      from: ORIGIN_LANGUAGES.map((name) => ({
        kind: 'language',
        key: name.toLowerCase(),
      })),
      any: [],
    },
  },
}

/** The proficiency fields of a race other than skills, with the kind each gives. */
const VALUE_FIELDS = [
  ['languageProficiencies', 'language'],
  ['toolProficiencies', 'tool'],
  ['weaponProficiencies', 'weapon'],
  ['armorProficiencies', 'armor'],
] as const

/**
 * The row of the table a value of the race takes; a weapon by its category, read from the
 * item catalog (`categoryOf`). A weapon the catalog does not know (or firearms) is read as
 * martial.
 */
export function swapRowOf(
  value: OriginValue,
  categoryOf: (weapon: string) => 'simple' | 'martial' | undefined,
): SwapRowKey {
  if (value.kind !== 'weapon') return value.kind
  const simple = value.key === 'simple' || categoryOf(value.key) === 'simple'
  return simple ? 'simpleWeapon' : 'martialWeapon'
}

/** A value of the race in words: "Longsword", "Perception". */
export const originValueText = (value: OriginValue): string =>
  value.kind === 'skill' ? skillLabel(value.key) : valueText(value)

/**
 * What the race gives outright that the rule lets the player swap: its skills, languages,
 * tools, weapons and armor. A choice it offers is the player's already, and "one other
 * language" names none.
 */
export function originValues(race: PlayableRace): OriginValue[] {
  const out: OriginValue[] = parseSkillGrants(race.skillProficiencies).fixed.map(
    (key) => ({ kind: 'skill', key }),
  )
  for (const [field, kind] of VALUE_FIELDS) {
    const read = readGrant(race[field] ?? [], kind)
    for (const value of read.alternatives.flatMap((a) => a.fixed)) {
      if (value.filter !== undefined || value.key === 'other') continue
      if (!out.some((v) => v.kind === kind && v.key === value.key))
        out.push({ kind, key: value.key })
    }
  }
  return out
}

/** The values of the race the character swapped under the rule. */
export function swappedValues(race: PlayableRace, ref?: RaceRef): OriginValue[] {
  if (!ref?.customOrigin || !ref.swaps?.length || !canCustomizeOrigin(race)) return []
  const ids = new Set(ref.swaps)
  return originValues(race).filter((v) => ids.has(swapId(v)))
}

type Block = Record<string, unknown>

const dataKey = (raw: string) => raw.split('|')[0].trim().toLowerCase()

/** The blocks of a field without the value given outright. */
const without = (blocks: unknown[] | undefined, key: string): unknown[] =>
  (blocks ?? []).map((block) =>
    block && typeof block === 'object'
      ? Object.fromEntries(
          Object.entries(block as Block).filter(
            ([k, v]) => !(v === true && dataKey(k) === key),
          ),
        )
      : block,
  )

/**
 * The race with the swaps the character made: each swapped value no longer given, a
 * swapped skill one more free skill pick of the race, and the other swaps listed in
 * `originSwaps` for picks of their own (derived/grantBlocks.ts).
 */
export function withSwaps(race: PlayableRace, ref?: RaceRef): PlayableRace {
  const swapped = swappedValues(race, ref)
  if (swapped.length === 0) return race
  const out: PlayableRace = { ...race, originSwaps: swapped }
  for (const value of swapped) {
    if (value.kind === 'skill') {
      const [first, ...rest] = without(out.skillProficiencies, value.key)
      const block: Block = first && typeof first === 'object' ? (first as Block) : {}
      const any = typeof block.any === 'number' ? block.any : 0
      out.skillProficiencies = [{ ...block, any: any + 1 }, ...rest]
      continue
    }
    const field = VALUE_FIELDS.find(([, kind]) => kind === value.kind)?.[0]
    if (field) out[field] = without(out[field], value.key)
  }
  return out
}

/** The pick that replaces a swapped value, as its row of the table allows. */
export function swapPick(row: SwapRowKey, value: OriginValue): Omit<PickSpec, 'id'> {
  const { pick, replacement } = PROFICIENCY_SWAPS[row]
  return { ...pick, count: 1, text: `${replacement}, for ${originValueText(value)}` }
}
