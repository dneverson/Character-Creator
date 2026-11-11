// Background data: resolve `_copy`, and give each background what it grants as
// the data lists it (read in words by grants.ts and abilityOptions.ts, as for a
// race), and the tables a player rolls on or chooses from for its story.

import { memoizeContent } from '../content/epoch'
import { fetchData } from './dataClient'
import { resolveCopy, type Copyable } from './copy'
import { parseAbilityOptions, type AbilityOption } from './abilityOptions'
import { dieTables, type DieTable } from './dieTables'
import { parseFeatGrants, type FeatGrant } from './feats'
import { PROFICIENCY_FIELDS, type ProficiencyField } from './grants'
import type { Entry } from '../text/Entries'
import type { BackgroundRef } from '../character/model'

export interface BackgroundEntry
  extends Copyable, Partial<Record<ProficiencyField, unknown[]>> {
  edition?: 'classic' | 'one'
  ability?: unknown[]
  feats?: unknown[]
  additionalSpells?: unknown[]
  startingEquipment?: unknown[]
  prerequisite?: unknown[]
  entries?: Entry[]
}

interface BackgroundsFile {
  background: BackgroundEntry[]
}

/** The story fields a background's tables fill (fields of `StoryState`). */
export type StoryField =
  'personalityTraits' | 'ideals' | 'bonds' | 'flaws' | 'allies' | 'backstory'

/** A die table of a background, and the story field the rows taken from it go in. */
export interface StoryTable extends DieTable {
  /** The title in lower case, made unique within the background. */
  key: string
  field: StoryField
  /** How many rows the player takes: two personality traits, one of anything else. */
  count: number
  /** The background the table is lent from, when its text says to use another's. */
  from?: string
}

/** A selectable background, with what it grants as the data lists it. */
export interface PlayableBackground extends Partial<Record<ProficiencyField, unknown[]>> {
  /** `${name}|${source}`. */
  key: string
  name: string
  source: string
  edition?: 'classic' | 'one'
  /** The ways to take its ability score increases; none for a 2014 background. */
  abilityOptions: AbilityOption[]
  /** Feats the background grants, for the Feats section. */
  featGrants: FeatGrant[]
  /** The spells it grants or adds to a class's list, as the data lists them. */
  additionalSpells?: unknown[]
  startingEquipment?: unknown[]
  prerequisite?: unknown[]
  /** Its rollable tables, its own or the ones its text points to. */
  storyTables: StoryTable[]
  entries: Entry[]
}

// The field a table fills, by its label (lower case, no plural "s"). Every other
// table (a specialty, an origin, a trinket) is part of the backstory.
const STORY_FIELDS: Record<string, StoryField | undefined> = {
  'personality trait': 'personalityTraits',
  trait: 'personalityTraits',
  ideal: 'ideals',
  bond: 'bonds',
  flaw: 'flaws',
  contact: 'allies',
}

/** The fields of a background's suggested characteristics. */
const CHARACTERISTICS: ReadonlySet<StoryField> = new Set<StoryField>([
  'personalityTraits',
  'ideals',
  'bonds',
  'flaws',
])
const isCharacteristic = (table: StoryTable) => CHARACTERISTICS.has(table.field)

function storyField(label: string): StoryField {
  return STORY_FIELDS[label.trim().toLowerCase().replace(/s$/, '')] ?? 'backstory'
}

/** Die tables as a background's story tables, each with a key of its own. */
function storyTables(tables: { table: DieTable; from?: string }[]): StoryTable[] {
  const keys = new Set<string>()
  return tables.map(({ table, from }) => {
    const field = storyField(table.label)
    const title = table.title.toLowerCase()
    let key = title
    for (let n = 2; keys.has(key); n++) key = `${title} ${n}`
    keys.add(key)
    return {
      ...table,
      key,
      field,
      count: field === 'personalityTraits' ? 2 : 1,
      ...(from !== undefined && { from }),
    }
  })
}

export function backgroundToPlayable(bg: BackgroundEntry): PlayableBackground {
  const entries = bg.entries ?? []
  const playable: PlayableBackground = {
    key: `${bg.name}|${bg.source}`,
    name: bg.name,
    source: bg.source,
    edition: bg.edition,
    abilityOptions: parseAbilityOptions(bg.ability),
    featGrants: parseFeatGrants(bg.feats),
    additionalSpells: bg.additionalSpells,
    startingEquipment: bg.startingEquipment,
    prerequisite: bg.prerequisite,
    storyTables: storyTables(dieTables(entries).map((table) => ({ table }))),
    entries,
  }
  for (const field of PROFICIENCY_FIELDS) playable[field] = bg[field] ?? []
  return playable
}

const SUGGESTED_CHARACTERISTICS = 'suggested characteristics'
// "Use the tables for the {@background soldier} background in the Player's Handbook".
const BACKGROUND_TAG = /\{@background ([^|}]+)(?:\|([^|}]*))?/i

/** The background a background's suggested characteristics say to take the tables of. */
function lenderOf(entries: Entry[]): { name: string; source: string } | undefined {
  const section = entries.find(
    (entry) =>
      typeof entry === 'object' &&
      'name' in entry &&
      typeof entry.name === 'string' &&
      entry.name.trim().toLowerCase() === SUGGESTED_CHARACTERISTICS,
  )
  const tag = section && BACKGROUND_TAG.exec(JSON.stringify(section))
  if (!tag) return undefined
  return { name: tag[1].trim(), source: tag[2]?.trim() || 'PHB' }
}

/**
 * A background whose text says to use another's tables for its characteristics
 * (and has none of its own) gets that background's characteristic tables, marked
 * as lent. Its own other tables stay. A lender that is not loaded lends nothing.
 */
function withLentTables(
  bg: PlayableBackground,
  all: PlayableBackground[],
): PlayableBackground {
  if (bg.storyTables.some(isCharacteristic)) return bg
  const ref = lenderOf(bg.entries)
  if (!ref) return bg
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
  const lender = all.find((b) => same(b.name, ref.name) && same(b.source, ref.source))
  const lent = lender?.storyTables.filter(isCharacteristic) ?? []
  if (!lender || lent.length === 0) return bg
  return {
    ...bg,
    storyTables: storyTables([
      ...bg.storyTables.map((table) => ({ table })),
      ...lent.map((table) => ({ table, from: lender.name })),
    ]),
  }
}

/** Load all selectable backgrounds, copies resolved and lent tables in place. */
export const loadBackgrounds = memoizeContent(async (): Promise<PlayableBackground[]> => {
  const data = await fetchData<BackgroundsFile>('backgrounds.json')
  const all = data.background
  const find = (name: string, source: string) =>
    all.find((e) => e.name === name && e.source === source)

  const playable = all.map((b) => backgroundToPlayable(resolveCopy(b, find)))
  const backgrounds = playable.map((b) => withLentTables(b, playable))
  backgrounds.sort((a, b) => a.name.localeCompare(b.name))
  return backgrounds
})

/** The background a character's background reference points to, if loaded. */
export function findBackground(
  backgrounds: PlayableBackground[] | null | undefined,
  ref: BackgroundRef | undefined,
): PlayableBackground | undefined {
  if (!ref) return undefined
  return backgrounds?.find((b) => b.key === `${ref.name}|${ref.source}`)
}

// ---- Starting gold ----------------------------------------------------------

type Fields = Record<string, unknown>
const isFields = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The coin in a list of equipment, in copper: coins, and what a pouch holds. */
function coinIn(items: unknown): number {
  if (!Array.isArray(items)) return 0
  let copper = 0
  for (const item of items) {
    if (!isFields(item)) continue
    // `worthValue` (a piece of jewelry) is what an item is worth, not coin.
    for (const value of [item.value, item.containsValue])
      if (typeof value === 'number') copper += value
  }
  return copper
}

/**
 * The coin a background's equipment comes with, in copper, once per way of
 * taking it (different amounts only): `[1500]` for "a pouch containing 15 gp",
 * `[800, 5000]` for "(A) the kit and 8 gp, or (B) 50 gp". Each block of the data
 * gives some items (`_`) and offers others as alternatives (`a`, `b`, `A`, `B`).
 */
export function startingGold(blocks: unknown[] | undefined): number[] {
  let totals: number[] = []
  for (const block of blocks ?? []) {
    if (!isFields(block)) continue
    const given = coinIn(block._)
    const alternatives = Object.entries(block)
      .filter(([key]) => key !== '_')
      .map(([, items]) => coinIn(items))
    const ways = alternatives.length > 0 ? alternatives : [0]
    const before = totals.length > 0 ? totals : [0]
    totals = before.flatMap((total) => ways.map((way) => total + given + way))
  }
  return [...new Set(totals)]
}
