// The character document model. Grows as creator sections are added.

import {
  ABILITIES,
  DEFAULT_ROLL_CONFIG,
  ROLL_DICE_MAX,
  ROLL_DICE_MIN,
  ROLL_REROLLS_MAX,
  ROLL_REROLLS_MIN,
  clamp,
  type AbilityKey,
  type RollConfig,
} from '../dice/dice'
import type { AbilityIncreases } from '../data/abilityOptions'
import type { ItemKind } from '../data/itemTypes'
import type { GrantPicks, PickKind, PickMap } from './picks'

/** Default sources selected for a fresh character (2014 core), matching the legacy app. */
export const DEFAULT_BOOKS = ['PHB', 'MM', 'DMG']

/**
 * A logical group of rolls that browse/undo together. Ability-score rolls (dice
 * pool and matrix) share one stream; hit-die rolls another; rolls on a
 * background's story tables a third, the gold rolled for starting equipment a fourth. New roll types add a new stream string
 * without reshaping the history.
 */
export type RollStream = 'ability' | 'hitDie' | 'story' | 'startingGold'

/** The picked line of a saved matrix roll (mirrors MatrixState.line). */
export type MatrixLineRef = { kind: 'row' | 'col' | 'diag'; index: number }

/** Fields common to every recorded roll. */
interface RollRecordBase {
  /** Unique id (crypto.randomUUID) used as the browse cursor. */
  id: string
  /** Which stream this roll belongs to (ability, hitDie, …). */
  stream: RollStream
  /** When the roll was made (ms epoch). */
  at: number
}

/** A recorded dice-pool ability roll (rNd6 k3 rK). */
export interface StatPoolRollRecord extends RollRecordBase {
  kind: 'stat-pool'
  /** The roll config used, so re-applying restores it. */
  config: RollConfig
  /** The rolled scores, in roll order. */
  scores: number[]
}

/** A recorded matrix ability roll (the whole grid plus the picked line). */
export interface MatrixRollRecord extends RollRecordBase {
  kind: 'matrix'
  /** Rows of rolled ability scores, in grid order. */
  scores: number[][]
  /** The picked line, or null when none is chosen yet. */
  line: MatrixLineRef | null
}

/** A recorded hit-die roll (one value per character level). */
export interface HitDieRollRecord extends RollRecordBase {
  kind: 'hit-die'
  /** Rolled die value per level (index 0 = first level, stored as its max). */
  rolls: number[]
}

/** A recorded Gauntlet ability roll (six 3d6 slots, each with its own rerolls). */
export interface GauntletRollRecord extends RollRecordBase {
  kind: 'gauntlet'
  /** Per-slot total (3d6 minus that slot's reroll penalty, clamped 3..18), in slot order. */
  scores: number[]
  /** Per-slot reroll count that produced the total, in slot order (for faithful restore). */
  rerolls: number[]
}

/** A recorded Pool ability roll (18d6 grouped into six triples). */
export interface PoolRollRecord extends RollRecordBase {
  kind: 'pool'
  /** The 18 rolled d6 values, in roll order. */
  dice: number[]
  /** Group index (0..5) each die is assigned to, or null while ungrouped, in dice order. */
  groups: (number | null)[]
  /** The six group sums once every group is complete; [] while still grouping. */
  scores: number[]
}

/**
 * A recorded roll on a background's story table (a personality trait, an ideal).
 * A reroll is a new record, so the rolls on a table can be counted.
 */
export interface TableRollRecord extends RollRecordBase {
  kind: 'table'
  /** The background's key, "Acolyte|PHB". */
  background: string
  /** The table's key within the background (`StoryTable.key`). */
  table: string
  /** The die rolled: N of "dN". */
  die: number
  /** Every die rolled, in order, rerolls for a taken row included. */
  values: number[]
  /** The rows taken (indexes into the table's rows). */
  rows: number[]
}

/**
 * A recorded roll of the gold a 2014 class gives in place of its starting equipment
 * (5d4 x 10 gp). A reroll is a new record; the gold taken may be another number.
 */
export interface StartingGoldRollRecord extends RollRecordBase {
  kind: 'starting-gold'
  /** The class that gives it: "Fighter|PHB". */
  source: string
  /** The dice rolled, in order. */
  values: number[]
  /** Gold pieces per point rolled (the "x 10"). */
  multiplier: number
  /** What the roll comes to, in gold pieces. */
  gold: number
}

/** Any recorded roll. Discriminated by `kind`. */
export type RollRecord =
  | StatPoolRollRecord
  | MatrixRollRecord
  | HitDieRollRecord
  | GauntletRollRecord
  | PoolRollRecord
  | TableRollRecord
  | StartingGoldRollRecord

/** The roll currently applied in each stream, by record id (the browse cursor). */
export type RollCursors = Partial<Record<RollStream, string | null>>

// --- History ---
//
// Every character carries a log of what was done to it: each roll, each edit,
// where it came from. The log is only ever added to, and it travels with the
// character through export and import. See history.ts for how it is written.

/**
 * Who recorded an entry. `device` is the app on the user's own device, which the
 * user can alter (the export file is plain JSON), so it is the user's own account
 * of events. `server` is an entry the server recorded itself.
 */
export type RecordedBy = 'device' | 'server'

/** One value of the character that an edit changed. */
export interface Change {
  /**
   * Where in the character, key by key. An entry of a list of named things is
   * addressed by its name and source (`['equipment', 'items', 'Rope|PHB']`).
   */
  path: string[]
  /** The value before; absent when it was added. */
  before?: unknown
  /** The value after; absent when it was removed. */
  after?: unknown
}

/** What happened, when it was more than an edit. */
export type HistoryAction =
  | { type: 'created' }
  /** The character is older than its history: edits before this were not recorded. */
  | { type: 'tracking-started' }
  /** Read from a file. `from` is the id the character had in that file. */
  | { type: 'imported'; from?: string }
  | { type: 'duplicated'; from: string }
  /**
   * A roll. An entry repeating the id of an earlier roll is that same roll in a
   * newer state (a matrix line picked, a gauntlet slot rerolled).
   */
  | { type: 'roll'; roll: RollRecord }

export interface HistoryEntry {
  id: string
  /** When it happened (ms epoch). */
  at: number
  by: RecordedBy
  action?: HistoryAction
  /** What it changed in the character. */
  changes: Change[]
}

/** A history entry recorded on this device. */
export function historyEntry(
  at: number,
  action?: HistoryAction,
  changes: Change[] = [],
): HistoryEntry {
  return {
    id: crypto.randomUUID(),
    at,
    by: 'device',
    ...(action && { action }),
    changes,
  }
}

// --- Play ---

/**
 * The state of a character in play: what an adventuring day does to it and a
 * rest undoes. Everything else in the document is the build, what the character
 * is. Play never alters the build, so a sheet can be reset without losing it.
 */
export interface PlayState {
  /**
   * Hit points lost. The maximum comes from the build, and the current hit
   * points are the maximum less this, so a change to the maximum carries over.
   */
  damage: number
  /** Temporary hit points. */
  tempHp: number
  deathSaves: { successes: number; failures: number }
  /** Conditions the character is under, as the rules name them. */
  conditions: string[]
  /** Exhaustion level, 0 when rested. */
  exhaustion: number
  inspiration: boolean
}

export function defaultPlayState(): PlayState {
  return {
    damage: 0,
    tempHp: 0,
    deathSaves: { successes: 0, failures: 0 },
    conditions: [],
    exhaustion: 0,
    inspiration: false,
  }
}

/** How ability scores are generated. */
export type StatMethod = 'roll' | 'matrix' | 'array' | 'pointbuy' | 'gauntlet' | 'pool'

/**
 * Saved state of a matrix roll, so the matrix method survives a reload/reopen
 * (and round-trips through export/import) like the other methods' pools do. Only
 * the raw rolled scores and the picked line are stored; each cell's modifier and
 * best-line marks are recomputed from `scores` on load.
 */
export interface MatrixState {
  /** Rows of rolled ability scores (each a 3d6 sum), in grid order. */
  scores: number[][]
  /** The picked line's identity, or null when none is chosen yet. */
  line: { kind: 'row' | 'col' | 'diag'; index: number } | null
}

/**
 * Saved state of a Gauntlet roll (homebrew): six independent slots, each a 3d6
 * total the player can reroll (each reroll costs a growing penalty). Survives
 * reload and export/import like the other methods' pools. All six totals feed
 * the ability table as soon as the Gauntlet is rolled.
 */
export interface GauntletSlot {
  /** Current total for the slot (3d6 sum minus `rerolls`, clamped 3..18). */
  total: number
  /** How many times this slot has been rerolled (0 = the initial roll, no penalty). */
  rerolls: number
}

export interface GauntletState {
  /** The six slots, in ability-table order. */
  slots: GauntletSlot[]
}

/**
 * Saved state of a Pool roll (homebrew): 18 rolled d6 the player sorts into six
 * groups of three, each group summing to one ability score. `groups[i]` is the
 * group index (0..5) die `i` belongs to, or null while it is still in the pool.
 * The six group sums feed the ability table once all 18 dice are grouped.
 */
export interface PoolState {
  /** The 18 rolled d6 values, in roll order. */
  dice: number[]
  /** Group index (0..5) each die is assigned to, or null when unassigned. */
  groups: (number | null)[]
}

export const DEFAULT_STAT_METHOD: StatMethod = 'roll'

/**
 * Legacy `statMethod` values (schema ≤15) mapped to the configurable roll they
 * now correspond to. Used to migrate both a character's `statMethod` and any
 * persisted stat-pool roll records that stored one of these strings.
 */
const LEGACY_ROLL_CONFIGS: Record<string, RollConfig> = {
  '4d6k3': { dice: 4, rerolls: 0 },
  '4d6k3r1': { dice: 4, rerolls: 1 },
  '3d6': { dice: 3, rerolls: 0 },
  '3d6r1': { dice: 3, rerolls: 1 },
}

/** Clamp a (possibly untrusted/legacy) roll config into the supported ranges. */
function normalizeRollConfig(raw: Partial<RollConfig> | undefined): RollConfig {
  return {
    dice: clamp(
      Math.trunc(raw?.dice ?? DEFAULT_ROLL_CONFIG.dice),
      ROLL_DICE_MIN,
      ROLL_DICE_MAX,
    ),
    rerolls: clamp(
      Math.trunc(raw?.rerolls ?? DEFAULT_ROLL_CONFIG.rerolls),
      ROLL_REROLLS_MIN,
      ROLL_REROLLS_MAX,
    ),
  }
}

/** The roll config a legacy method string maps to (default config if unknown). */
function legacyRollConfig(method: string | undefined): RollConfig {
  return method && method in LEGACY_ROLL_CONFIGS
    ? { ...LEGACY_ROLL_CONFIGS[method] }
    : { ...DEFAULT_ROLL_CONFIG }
}

/**
 * Migrate a persisted roll record: stat-pool records that stored a legacy
 * `method` string (schema ≤15) are rewritten to carry a `config`; a record that
 * already has a `config` is normalized; all other kinds pass through untouched.
 */
function migrateStatRecord(rec: RollRecord): RollRecord {
  if (rec.kind !== 'stat-pool') return rec
  const loose = rec as { config?: Partial<RollConfig>; method?: string }
  const config = loose.config
    ? normalizeRollConfig(loose.config)
    : legacyRollConfig(loose.method)
  return {
    id: rec.id,
    stream: rec.stream,
    at: rec.at,
    kind: 'stat-pool',
    config,
    scores: rec.scores,
  }
}

/** Per-ability values the player controls. Racial bonuses are derived from the race. */
export interface AbilityEntry {
  /** Assigned base score (from a rolled/array/matrix pool, or a bought point-buy score). */
  base: number | null
  /** Manual "other" bonus (feats, magic items, homebrew). */
  other: number
}

export type Abilities = Record<AbilityKey, AbilityEntry>

/** A chosen class (or multiclass), referencing data by name + source. */
export interface ClassRef {
  name: string
  source: string
  level: number
  subclass?: { name: string; shortName: string; source: string }
}

/** A chosen background with the player's choices from it. */
export interface BackgroundRef {
  name: string
  source: string
  /**
   * Which of the background's ways to take its ability score increases is in
   * use (an index into its options; the first when absent). 2024 only.
   */
  abilityOption?: number
  /** 2024: assigned ability-score increases (ability -> amount). */
  abilityChoices: Partial<Record<AbilityKey, number>>
}

/**
 * Skill proficiencies the player has taken, keyed by skill. The value is a
 * source tag ("bg", "class:Name|SRC", "race", or "manual") so each grant's
 * budget can be tracked and the source shown. Skills granted outright by a
 * background/race are derived from data and are not stored here. Stored in
 * `grantPicks.skill`, with every other kind of pick.
 */
export type SkillProficiencies = PickMap

/** Hit-point options and any rolled hit-die results. */
export interface HpState {
  /** Which total the sheet highlights. */
  method: 'average' | 'rolled'
  /** Extra HP per level from other sources (e.g. Draconic Sorcerer). */
  perLevelBonus: number
  /** One-time flat HP bonus (homebrew / magic items). */
  flatBonus: number
  /** Rolled die value per character level (index 0 = first level, uses max). */
  rolls: number[]
}

export function defaultHpState(): HpState {
  return { method: 'average', perLevelBonus: 0, flatBonus: 0, rolls: [] }
}

/** A feat referenced by name + source (a version reads "Magic Initiate; Cleric"). */
export interface FeatRef {
  name: string
  source: string
}

/**
 * The player's pick for one feat slot: an Ability Score Improvement or a feat,
 * plus the ability increase chosen from the pick's options (by index), and the
 * abilities the option's "choose" part is assigned to.
 */
export interface FeatChoice {
  kind: 'asi' | 'feat'
  feat?: FeatRef
  abilityOption?: number
  /** The increases the player placed, by ability. */
  abilityChoices?: AbilityIncreases
}

/** A feat pick as an older document stored it: the placed abilities as a list. */
type StoredFeatChoice = Omit<FeatChoice, 'abilityChoices'> & {
  abilityChoices?: AbilityIncreases | AbilityKey[]
}

/**
 * Feat and Ability Score Improvement picks, keyed by slot id. Slots themselves
 * are derived from race, background, and class data; `bonusSlots` holds the ids
 * of extra slots the player added (DM rewards, homebrew).
 */
export interface FeatsState {
  choices: Record<string, FeatChoice>
  bonusSlots: string[]
}

export function defaultFeatsState(): FeatsState {
  return { choices: {}, bonusSlots: [] }
}

/** Id prefix of a player-added bonus feat slot. */
export const BONUS_SLOT_PREFIX = 'bonus:'

/** A spell the player has added to a character (by name + source). */
export interface SpellRef {
  name: string
  source: string
  /** What the SRD calls the spell, when that is another name (see `names.ts`). */
  srdName?: string
  /** 0 = cantrip. */
  level: number
}

/** A class's selected cantrips and leveled spells (known or prepared). */
export interface ClassSpellSelection {
  cantrips: SpellRef[]
  spells: SpellRef[]
  /**
   * A spellbook caster (Wizard) records the leveled spells written in its book
   * here; `spells` then holds the subset prepared from it. Omitted for casters
   * that prepare or know from their whole class list.
   */
  spellbook?: SpellRef[]
}

/** Spell selections keyed by class ("Name|SOURCE"), so multiclasses stay separate. */
export type SpellsByClass = Record<string, ClassSpellSelection>

/** What the player decided for one spell grant (a feat, species, or class option). */
export interface GrantedSpellChoice {
  /** The spells chosen for a grant that lets the player choose. */
  picks: SpellRef[]
  /** The spellcasting ability, where the data offers a choice. */
  ability?: AbilityKey
  /** Which named set of spells was taken (a Tiefling legacy, a Magic Initiate list). */
  variant?: string
}

/** Choices for spell grants, keyed by the grant's id (see `resolveSpellGrants`). */
export type SpellGrantChoices = Record<string, GrantedSpellChoice>

/** An item that is in no book (a DM's or a homebrew one): the whole item is kept. */
export interface CustomItem {
  kind: ItemKind
  rarity?: string
  /** Pounds. */
  weight?: number
  /** Copper pieces. */
  value?: number
  attunement?: boolean
  description: string
}

/**
 * A stack of one item in the character's inventory. There is one stack for each
 * name and source (the history addresses it that way), so equipped, attuned and
 * the note belong to the whole stack.
 */
export interface InventoryItem {
  name: string
  source: string
  /** What the SRD calls the item, when that is another name (see `names.ts`). */
  srdName?: string
  quantity: number
  /** Worn, wielded or in hand. Absent means carried. */
  equipped?: boolean
  /** Attuned to. Only meaningful for an item that needs attunement. */
  attuned?: boolean
  /** Free text: "found in the crypt", "gift from the DM". */
  note?: string
  /** Given by starting equipment, so a change of choice replaces it. */
  from?: 'class' | 'background'
  /** The generic variant this item was made from ("+1 Weapon|XDMG"). */
  variantOf?: string
  /** The base item the variant was applied to ("Longsword|XPHB"). */
  base?: string
  /** The whole item when it is in no book. Its source is "Custom". */
  custom?: CustomItem
}

/** The starting equipment a class or a background gave, as the player chose it. */
export interface StartingPick {
  /** What gave it: "Fighter|XPHB", "Soldier|XPHB". */
  source: string
  /** The option taken ("A", "B", "a", or the gold option). */
  option: string
  /** The item chosen for each "any simple weapon" style slot: slot id to item key. */
  picks: Record<string, string>
  /** The coin it added to the purse, in copper, so a change of option can take it back. */
  gold?: number
}

/** The starting equipment taken from each source: the first class and the background. */
export interface StartingPicks {
  class?: StartingPick
  background?: StartingPick
}

/** Coin purse (platinum, gold, electrum, silver, copper). */
export interface Currency {
  pp: number
  gp: number
  ep: number
  sp: number
  cp: number
}

export interface EquipmentState {
  items: InventoryItem[]
  currency: Currency
  starting: StartingPicks
}

export function defaultEquipment(): EquipmentState {
  return { items: [], currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 }, starting: {} }
}

/** A beast form saved for Druid Wild Shape. */
export interface BeastRef {
  name: string
  source: string
}

/** Freeform roleplay / narrative fields for the character. */
export interface StoryState {
  alignment: string
  personalityTraits: string
  ideals: string
  bonds: string
  flaws: string
  appearance: string
  backstory: string
  allies: string
  notes: string
}

export function defaultStory(): StoryState {
  return {
    alignment: '',
    personalityTraits: '',
    ideals: '',
    bonds: '',
    flaws: '',
    appearance: '',
    backstory: '',
    allies: '',
    notes: '',
  }
}

/** A chosen race/species with its ability bonuses denormalized for the table. */
export interface RaceRef {
  name: string
  baseName: string
  source: string
  subraceName?: string
  /**
   * Which of the race's ways to take its ability score increases is in use (an
   * index into its options; the first when absent).
   */
  abilityOption?: number
  /** Fixed ability bonuses from the race, as the option in use gives them. */
  abilityFixed: Partial<Record<AbilityKey, number>>
  /** Player-chosen bonuses from a race's "choose" option. */
  abilityChoices: Partial<Record<AbilityKey, number>>
}

export interface Character {
  /** The version of this model the document was last written by. */
  schemaVersion: number
  id: string
  name: string
  /** Source codes of the books the player has enabled. */
  selectedBooks: string[]

  // --- Ability scores ---
  statMethod: StatMethod
  /** Dice/reroll config for the configurable 'roll' method (rNd6 k3 rK). */
  rollConfig: RollConfig
  /** Generated pool of scores available to assign (roll / array / matrix methods). */
  statPool: number[]
  /** Saved matrix roll (grid + picked line) when `statMethod` is 'matrix'; else null. */
  matrix?: MatrixState | null
  /** Saved Gauntlet roll (six 3d6 slots) when `statMethod` is 'gauntlet'; else null. */
  gauntlet?: GauntletState | null
  /** Saved Pool roll (18d6 grouped into six) when `statMethod` is 'pool'; else null. */
  pool?: PoolState | null
  abilities: Abilities

  // --- Classes ---
  classes: ClassRef[]

  // --- Race ---
  race?: RaceRef

  // --- Background ---
  background?: BackgroundRef

  // --- Feats & Ability Score Improvements ---
  feats: FeatsState

  // --- Skills, tools, languages and the other picks a source lets the player make ---
  /**
   * What the player chose from the grants that let them choose: kind -> value -> the
   * source tag that paid for it. Skills are `grantPicks.skill`.
   */
  grantPicks: GrantPicks
  /**
   * The alternative of a grant the player took, by `<source tag>|<field>` (a Monk takes
   * artisan's tools or an instrument), and `<source tag>|<field>|optional<n>` -> 1 for an
   * optional block switched on.
   */
  grantAlt: Record<string, number>
  /**
   * The class options picked, by `<class tag>|<option type>` -> the options' keys
   * ("Defense|PHB" under `class:Fighter|PHB|FS:F`).
   */
  classOptions: Record<string, string[]>

  // --- Hit points ---
  hp: HpState

  /**
   * What the player adds to a derived number the rules tables cannot know of (a
   * ruling of the DM). Absent means none; no stored document needs migrating.
   */
  manualBonuses?: Partial<Record<'ac' | 'initiative', number>>

  // --- Spells ---
  spells: SpellsByClass
  /** The player's choices for spells granted by a species, feat or class option. */
  spellGrants: SpellGrantChoices

  // --- Equipment ---
  equipment: EquipmentState

  // --- Druid Wild Shape ---
  wildShapes: BeastRef[]

  // --- Background story ---
  story: StoryState

  // --- Rolls ---
  /** Which recorded roll is applied in each stream. The rolls are in `history`. */
  rollCursors: RollCursors

  // --- Play ---
  play: PlayState

  // --- History ---
  /** Everything done to the character, oldest first. Only ever added to. */
  history: HistoryEntry[]

  createdAt: number
  updatedAt: number
}

/**
 * Current version of the character model. Bump it when a stored document needs
 * changing to fit (a field moved or changed meaning); a new field with a default
 * needs no bump. Version 18 moved the rolls into `history` and added `play`;
 * version 19 renamed the background's `spreadIndex` to `abilityOption`;
 * version 20 stores a feat's placed increases as a map, not a list of abilities;
 * version 21 adds `spellGrants`, the choices for spells a source grants;
 * version 22 adds what the inventory knows of an item (equipped, attuned, a note, where it
 * came from, a custom item) and `equipment.starting`, the starting equipment taken;
 * version 23 moves `skillProficiencies` into `grantPicks.skill` and adds `grantAlt` and
 * `classOptions`.
 */
export const CHARACTER_SCHEMA_VERSION = 23

function emptyAbilities(): Abilities {
  return Object.fromEntries(
    ABILITIES.map((k) => [k, { base: null, other: 0 } satisfies AbilityEntry]),
  ) as Abilities
}

export function createCharacter(name = 'New Character'): Character {
  const now = Date.now()
  return {
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    id: crypto.randomUUID(),
    name,
    selectedBooks: [...DEFAULT_BOOKS],
    statMethod: DEFAULT_STAT_METHOD,
    rollConfig: { ...DEFAULT_ROLL_CONFIG },
    statPool: [],
    matrix: null,
    gauntlet: null,
    pool: null,
    abilities: emptyAbilities(),
    classes: [],
    feats: defaultFeatsState(),
    grantPicks: {},
    grantAlt: {},
    classOptions: {},
    hp: defaultHpState(),
    spells: {},
    spellGrants: {},
    equipment: defaultEquipment(),
    wildShapes: [],
    story: defaultStory(),
    rollCursors: {},
    play: defaultPlayState(),
    history: [historyEntry(now, { type: 'created' })],
    createdAt: now,
    updatedAt: now,
  }
}

/** A background as stored before version 19, its ability option named `spreadIndex`. */
type StoredBackground = BackgroundRef & { spreadIndex?: number }

/**
 * A character as it may come out of storage or a file: any version of the model,
 * possibly incomplete. Before version 18 the rolls were kept apart from the rest
 * of the history, in `rollHistory`.
 */
export type StoredCharacter = Partial<Character> & {
  rollHistory?: { records?: RollRecord[]; cursors?: RollCursors }
  /** Before version 23 the skill picks were kept apart from the other picks. */
  skillProficiencies?: PickMap
  background?: StoredBackground
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** The picks of a stored document, the version 22 skill picks among them. */
function storedPicks(raw: unknown, legacySkills: unknown): GrantPicks {
  const picks: GrantPicks = {}
  if (isRecord(raw)) {
    for (const [kind, map] of Object.entries(raw)) {
      if (!isRecord(map)) continue
      picks[kind as PickKind] = Object.fromEntries(
        Object.entries(map).filter(([, tag]) => typeof tag === 'string'),
      ) as PickMap
    }
  }
  if (isRecord(legacySkills) && picks.skill === undefined) {
    picks.skill = Object.fromEntries(
      Object.entries(legacySkills).filter(([, tag]) => typeof tag === 'string'),
    ) as PickMap
  }
  return picks
}

function numberMap(raw: unknown): Record<string, number> {
  if (!isRecord(raw)) return {}
  return Object.fromEntries(
    Object.entries(raw).filter(([, n]) => typeof n === 'number'),
  ) as Record<string, number>
}

function optionMap(raw: unknown): Record<string, string[]> {
  if (!isRecord(raw)) return {}
  return Object.fromEntries(
    Object.entries(raw).filter(
      (entry): entry is [string, string[]] =>
        Array.isArray(entry[1]) && entry[1].every((o) => typeof o === 'string'),
    ),
  )
}

/** A stored background with its ability option under the current name. */
function storedBackground(raw: StoredBackground | undefined): BackgroundRef | undefined {
  if (!raw) return undefined
  const { spreadIndex, ...background } = raw
  if (background.abilityOption === undefined && typeof spreadIndex === 'number')
    background.abilityOption = spreadIndex
  return background
}

function normalizePlay(raw: Partial<PlayState> | undefined): PlayState {
  const base = defaultPlayState()
  return {
    ...base,
    ...raw,
    deathSaves: { ...base.deathSaves, ...raw?.deathSaves },
    conditions: Array.isArray(raw?.conditions) ? raw.conditions : base.conditions,
  }
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'at' in value &&
    typeof value.at === 'number' &&
    'changes' in value &&
    Array.isArray(value.changes)
  )
}

/**
 * The history and roll cursors of a stored character. A document from before
 * version 18 has its recorded rolls turned into history entries, followed by a
 * mark that edits were not recorded until now.
 */
function storedHistory(raw: StoredCharacter): Pick<Character, 'history' | 'rollCursors'> {
  if (Array.isArray(raw.history)) {
    return {
      history: raw.history.filter(isHistoryEntry),
      rollCursors:
        raw.rollCursors && typeof raw.rollCursors === 'object' ? raw.rollCursors : {},
    }
  }
  const earlier = raw.rollHistory
  const rolls = Array.isArray(earlier?.records) ? earlier.records : []
  return {
    history: [
      ...rolls.map((record): HistoryEntry => ({
        id: record.id,
        at: record.at,
        by: 'device',
        action: { type: 'roll', roll: migrateStatRecord(record) },
        changes: [],
      })),
      historyEntry(Date.now(), { type: 'tracking-started' }),
    ],
    rollCursors:
      earlier?.cursors && typeof earlier.cursors === 'object' ? earlier.cursors : {},
  }
}

/**
 * Schema 19 and earlier listed the abilities a feat's increase went on. Each gets
 * the amount the option gave it: +2 for the Ability Score Improvement's "+2 to one"
 * (the only option with a +2 in the data), +1 otherwise.
 */
function featIncreases(choice: StoredFeatChoice): AbilityIncreases | undefined {
  const { abilityChoices: listed } = choice
  if (!Array.isArray(listed)) return listed
  const amount = choice.kind === 'asi' && (choice.abilityOption ?? 0) === 0 ? 2 : 1
  const map: AbilityIncreases = {}
  for (const k of listed) if (ABILITIES.includes(k)) map[k] = amount
  return map
}

function normalizeFeatChoices(raw: unknown): Record<string, FeatChoice> {
  if (!raw || typeof raw !== 'object') return {}
  const choices: Record<string, FeatChoice> = {}
  for (const [id, stored] of Object.entries(raw) as [string, StoredFeatChoice][]) {
    choices[id] = { ...stored, abilityChoices: featIncreases(stored) }
  }
  return choices
}

function normalizeFeats(raw: Partial<FeatsState> | undefined): FeatsState {
  return {
    choices: normalizeFeatChoices(raw?.choices),
    bonusSlots: Array.isArray(raw?.bonusSlots)
      ? raw.bonusSlots.filter((id) => typeof id === 'string')
      : [],
  }
}

const plainObject = (raw: SpellGrantChoices | undefined): SpellGrantChoices =>
  raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}

/** The starting equipment taken, keeping a source's pick only when it is one. */
function storedStarting(raw: StartingPicks | undefined): StartingPicks {
  const picks = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const isPick = (pick: StartingPick | undefined): pick is StartingPick =>
    pick !== undefined &&
    typeof pick === 'object' &&
    typeof pick.source === 'string' &&
    typeof pick.option === 'string'
  return {
    ...(isPick(picks.class) && { class: picks.class }),
    ...(isPick(picks.background) && { background: picks.background }),
  }
}

/**
 * Fill in any missing fields on a (possibly older or imported) character so the
 * app never reads undefined. Preserves existing values.
 */
export function ensureCharacterDefaults(raw: StoredCharacter | undefined): Character {
  const base = createCharacter(raw?.name ?? 'New Character')
  if (!raw) return base
  // The rolls kept apart before version 18 are read by `storedHistory` below and
  // have no place in the document any more.
  const current: StoredCharacter = { ...raw }
  delete current.rollHistory
  const merged: Character = { ...base, ...current } as Character
  // A document a newer version of the app wrote keeps its own, higher number.
  merged.schemaVersion = Math.max(raw.schemaVersion ?? 0, CHARACTER_SCHEMA_VERSION)
  merged.id = raw?.id ?? base.id
  merged.selectedBooks = Array.isArray(raw?.selectedBooks)
    ? raw!.selectedBooks
    : base.selectedBooks
  // Migrate legacy roll methods (schema ≤15) to the configurable 'roll' method.
  const rawMethod = raw?.statMethod as string | undefined
  if (rawMethod && rawMethod in LEGACY_ROLL_CONFIGS) {
    merged.statMethod = 'roll'
    merged.rollConfig = { ...LEGACY_ROLL_CONFIGS[rawMethod] }
  } else {
    merged.statMethod = raw?.statMethod ?? base.statMethod
    merged.rollConfig = normalizeRollConfig(raw?.rollConfig)
  }
  merged.statPool = Array.isArray(raw?.statPool) ? raw!.statPool : base.statPool
  merged.matrix = raw?.matrix && Array.isArray(raw.matrix.scores) ? raw.matrix : null
  merged.gauntlet =
    raw?.gauntlet && Array.isArray(raw.gauntlet.slots) ? raw.gauntlet : null
  merged.pool =
    raw?.pool && Array.isArray(raw.pool.dice) && Array.isArray(raw.pool.groups)
      ? raw.pool
      : null
  merged.abilities = { ...emptyAbilities(), ...(raw?.abilities ?? {}) }
  merged.classes = Array.isArray(raw?.classes) ? raw!.classes : base.classes
  merged.race = raw?.race
  merged.background = storedBackground(raw?.background)
  // Schema 23: the skill picks moved into `grantPicks.skill`.
  delete (merged as Character & { skillProficiencies?: PickMap }).skillProficiencies
  merged.grantPicks = storedPicks(raw?.grantPicks, raw?.skillProficiencies)
  merged.grantAlt = numberMap(raw?.grantAlt)
  merged.classOptions = optionMap(raw?.classOptions)
  // Schema ≤16 stored the Tough feat as an HP checkbox; it is now a feat pick.
  const legacyHp: Partial<HpState> & { tough?: unknown } = raw?.hp ?? {}
  const { tough, ...hp } = legacyHp
  merged.hp = { ...defaultHpState(), ...hp }
  merged.feats = normalizeFeats(raw?.feats)
  if (tough === true) {
    const id = `${BONUS_SLOT_PREFIX}${crypto.randomUUID()}`
    const source = merged.selectedBooks.includes('PHB') ? 'PHB' : 'XPHB'
    merged.feats = {
      choices: {
        ...merged.feats.choices,
        [id]: { kind: 'feat', feat: { name: 'Tough', source } },
      },
      bonusSlots: [...merged.feats.bonusSlots, id],
    }
  }
  merged.spells = raw?.spells && typeof raw.spells === 'object' ? raw.spells : {}
  // Schema 21: choices for granted spells; older saves have none.
  merged.spellGrants = plainObject(raw?.spellGrants)
  // Schema 22: starting equipment taken; an older save has taken none. Every other
  // new inventory field is optional and absent means off, so no stack is rewritten.
  merged.equipment = {
    ...defaultEquipment(),
    ...(raw?.equipment ?? {}),
    items: Array.isArray(raw?.equipment?.items) ? raw.equipment.items : [],
    currency: {
      ...defaultEquipment().currency,
      ...(raw?.equipment?.currency ?? {}),
    },
    starting: storedStarting(raw?.equipment?.starting),
  }
  merged.wildShapes = Array.isArray(raw?.wildShapes) ? raw!.wildShapes : []
  merged.story = { ...defaultStory(), ...(raw?.story ?? {}) }
  merged.play = normalizePlay(raw.play)
  Object.assign(merged, storedHistory(raw))
  merged.createdAt = raw?.createdAt ?? base.createdAt
  merged.updatedAt = raw?.updatedAt ?? base.updatedAt
  return merged
}
