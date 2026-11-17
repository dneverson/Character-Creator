// Creature data: load the bestiary files for the given sources and normalize each
// monster to the stats of its stat block. Druid Wild Shape reads the beasts of it, and
// Quick lookup reads every creature, both through the one description in
// src/components/editor/beastFacts.tsx.

import { abilityMod, type AbilityKey } from '../dice/dice'
import { proficiencyForCr } from '../rules/challenge'
import type { Entry } from '../text/Entries'
import { fetchData } from './dataClient'
import { loadBookEditions, type Edition } from './edition'
import { speedDistance, type SpeedValue } from './labels'

export interface BeastEntry {
  name: string
  entries: Entry[]
}

export interface Beast {
  name: string
  source: string
  edition: Edition
  /** Size codes as the data writes them (T, S, M, L, H, G). */
  size: string[]
  cr: string
  crValue: number
  /** False for a creature the data gives no challenge rating (a spell's summon). */
  hasCr: boolean
  /** A swarm of tiny creatures, which is never a Wild Shape form. */
  swarm: boolean
  /** The size of the creatures a swarm is made of ("T"). */
  swarmSize?: string
  /** The creature type as the data names it: "beast", "dragon". */
  type: string
  /** Type tags such as "dinosaur" or "cattle". */
  tags: string[]
  /** "lawful good", "unaligned"; empty when the data gives none. */
  alignment: string
  ac: number
  /** What the armor class comes from, "natural armor". */
  acFrom?: string
  /** Average hit points (0 when the data gives a special value). */
  hp: number
  hpFormula?: string
  /** What the hit points are when the data gives words, not an average ("equal to ..."). */
  hpSpecial?: string
  speed: Record<string, SpeedValue>
  /** Movement types present (walk/fly/swim/climb/burrow). */
  hasFly: boolean
  hasSwim: boolean
  abilities: Record<AbilityKey, number>
  passive: number
  /** Senses as written, "darkvision 60 ft.". */
  senses: string[]
  /** Skill bonuses as written, perception: "+3". */
  skills: Record<string, string>
  /** Saving throw bonuses as written, dex: "+4". */
  saves: Record<string, string>
  vulnerable: string
  resist: string
  immune: string
  conditionImmune: string
  languages: string[]
  traits: BeastEntry[]
  spellcasting: BeastEntry[]
  actions: BeastEntry[]
  bonusActions: BeastEntry[]
  reactions: BeastEntry[]
  legendary: BeastEntry[]
  mythic: BeastEntry[]
  /** Experience points the data states itself (a creature outside the standard table). */
  xp?: number
  /** Experience points in the lair, when they differ. */
  xpLair?: number
  /** The 2024 initiative modifier (Dexterity, and proficiency when the stat block has it). */
  initiative?: number
  /** Lair actions and regional effects, from the creature's legendary group. */
  lair: BeastEntry[]
}

/** A damage list of the data: words, or words with a note and a condition. */
export type RawDamage =
  | string
  | ({ special?: string; note?: string; preNote?: string } & {
      [kind: string]: unknown
    })

interface RawSpellcasting {
  name: string
  headerEntries?: Entry[]
  footerEntries?: Entry[]
  will?: unknown[]
  daily?: Record<string, unknown[]>
  rest?: Record<string, unknown[]>
  spells?: Record<string, { slots?: number; lower?: number; spells?: unknown[] }>
}

interface RawMonster {
  name: string
  source: string
  type?: string | RawType
  alignment?: unknown[]
  size?: string[]
  cr?: string | { cr?: string; xp?: number; xpLair?: number }
  initiative?: { initiative?: number; proficiency?: number }
  ac?: (number | { ac?: number; from?: string[] })[]
  hp?: { average?: number; formula?: string; special?: string }
  speed?: Record<string, SpeedValue> | number
  str?: number
  dex?: number
  con?: number
  int?: number
  wis?: number
  cha?: number
  passive?: number | string
  senses?: string[]
  skill?: Record<string, unknown>
  save?: Record<string, string>
  vulnerable?: RawDamage[]
  resist?: RawDamage[]
  immune?: RawDamage[]
  conditionImmune?: RawDamage[]
  languages?: string[]
  trait?: BeastEntry[]
  spellcasting?: RawSpellcasting[]
  action?: BeastEntry[]
  bonus?: BeastEntry[]
  reaction?: BeastEntry[]
  legendary?: BeastEntry[]
  legendaryHeader?: Entry[]
  mythic?: BeastEntry[]
  mythicHeader?: Entry[]
  legendaryGroup?: { name: string; source: string }
}

interface RawType {
  type?: string | { choose?: string[] }
  swarmSize?: string
  tags?: (string | { tag?: string })[]
}

interface BestiaryFile {
  monster?: RawMonster[]
}

interface LegendaryGroupsFile {
  legendaryGroup?: {
    name: string
    source: string
    lairActions?: Entry[]
    regionalEffects?: Entry[]
    mythicEncounter?: Entry[]
  }[]
}

const CR_VALUES: Record<string, number> = {
  '0': 0,
  '1/8': 0.125,
  '1/4': 0.25,
  '1/2': 0.5,
}

/** Numeric value of a challenge-rating string ("1/4" -> 0.25). */
export function crToNumber(cr: string): number {
  if (cr in CR_VALUES) return CR_VALUES[cr]
  const n = Number(cr)
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY
}

function typeName(type: RawMonster['type']): string {
  const name = typeof type === 'string' ? type : type?.type
  if (typeof name === 'string') return name
  return name?.choose?.join(' or ') ?? ''
}

function firstAc(ac: RawMonster['ac']): { ac: number; from?: string } {
  const first = ac?.[0]
  if (typeof first === 'number') return { ac: first }
  return { ac: first?.ac ?? 0, from: first?.from?.join(', ') }
}

function crString(cr: RawMonster['cr']): string | undefined {
  return typeof cr === 'string' ? cr : cr?.cr
}

/** The 2024 initiative modifier: the stated one, or Dexterity plus proficiency as many times. */
function initiativeOf(m: RawMonster, dex: number): number | undefined {
  if (!m.initiative) return undefined
  if (m.initiative.initiative !== undefined) return m.initiative.initiative
  const cr = crString(m.cr)
  const pb = cr === undefined ? 2 : proficiencyForCr(crToNumber(cr))
  return abilityMod(dex) + (m.initiative.proficiency ?? 0) * pb
}

const typeTags = (type: RawMonster['type']): string[] =>
  typeof type === 'object'
    ? (type.tags ?? []).flatMap((t) => {
        const tag = typeof t === 'string' ? t : t.tag
        return tag ? [tag] : []
      })
    : []

/** Whether a way of moving has a distance (or can be chosen to). */
function moves(speed: Record<string, SpeedValue>, mode: string): boolean {
  if ((speedDistance(speed[mode]) ?? 0) > 0) return true
  const choice = speed.choose
  return typeof choice === 'object' && 'from' in choice && choice.from.includes(mode)
}

const ability = (score: number | undefined) => score ?? 10

const ALIGNMENT_WORDS: Record<string, string> = {
  L: 'lawful',
  N: 'neutral',
  C: 'chaotic',
  G: 'good',
  E: 'evil',
  U: 'unaligned',
  A: 'any alignment',
  NX: 'neutral',
  NY: 'neutral',
}

/** One alignment of the data: codes ("L", "G"), or an object with a chance or a note. */
function alignmentText(parts: unknown[]): string {
  const words = parts.flatMap((part): string[] => {
    if (typeof part === 'string') return [ALIGNMENT_WORDS[part] ?? part]
    if (part !== null && typeof part === 'object') {
      const { alignment, special } = part as { alignment?: unknown[]; special?: string }
      if (special) return [special]
      if (alignment) return [alignmentText(alignment)]
    }
    return []
  })
  // Lawful and good are one alignment, "lawful good"; neutral twice is just "neutral".
  const joined = words.filter((w, i) => !(w === 'neutral' && words[i - 1] === 'neutral'))
  const pair = parts.every((p) => typeof p === 'string') && joined.length === 2
  return joined.join(pair ? ' ' : ' or ')
}

/** A damage or condition list: "fire, poison; bludgeoning from nonmagical attacks". */
export function damageText(list: RawDamage[] | undefined): string {
  const one = (item: RawDamage): string => {
    if (typeof item === 'string') return item
    if (item.special) return item.special
    const inner = Object.values(item).find(Array.isArray) as RawDamage[] | undefined
    const body = damageText(inner)
    return [item.preNote, body, item.note].filter(Boolean).join(' ')
  }
  const parts = (list ?? []).map(one).filter(Boolean)
  const grouped = (list ?? []).some((item) => typeof item !== 'string')
  return parts.join(grouped ? '; ' : ', ')
}

/** The spells of a creature's spellcasting as the lines a stat block prints. */
function spellcastingEntry(raw: RawSpellcasting): BeastEntry {
  const lines: Entry[] = []
  const spells = (list: unknown[]) => list.filter((x) => typeof x === 'string').join(', ')
  const rated = (rates: Record<string, unknown[]> | undefined, per: string) => {
    for (const [rate, list] of Object.entries(rates ?? {})) {
      const each = rate.endsWith('e') ? ' each' : ''
      lines.push(`${rate.replace('e', '')}/${per}${each}: ${spells(list)}`)
    }
  }
  if (raw.will?.length) lines.push(`At will: ${spells(raw.will)}`)
  rated(raw.daily, 'day')
  rated(raw.rest, 'rest')
  for (const [level, group] of Object.entries(raw.spells ?? {})) {
    const slots = group.slots === undefined ? '' : ` (${group.slots} slots)`
    const label = level === '0' ? 'Cantrips (at will)' : `Level ${level}${slots}`
    lines.push(`${label}: ${spells(group.spells ?? [])}`)
  }
  return {
    name: raw.name,
    entries: [
      ...(raw.headerEntries ?? []),
      { type: 'list', items: lines },
      ...(raw.footerEntries ?? []),
    ],
  }
}

const skillBonuses = (skill: RawMonster['skill']): Record<string, string> =>
  Object.fromEntries(
    Object.entries(skill ?? {}).flatMap(([name, bonus]) =>
      typeof bonus === 'string' ? [[name, bonus]] : [],
    ),
  )

function normalize(
  m: RawMonster,
  edition: Edition,
  groups: ReadonlyMap<string, BeastEntry[]> = new Map(),
): Beast {
  const speed = typeof m.speed === 'object' ? m.speed : { walk: m.speed ?? 0 }
  const cr = crString(m.cr)
  const ac = firstAc(m.ac)
  return {
    name: m.name,
    source: m.source,
    edition,
    size: m.size ?? [],
    cr: cr ?? '0',
    crValue: crToNumber(cr ?? '0'),
    hasCr: cr !== undefined,
    swarm: typeof m.type === 'object' && !!m.type.swarmSize,
    swarmSize: typeof m.type === 'object' ? m.type.swarmSize : undefined,
    type: typeName(m.type),
    tags: typeTags(m.type),
    alignment: alignmentText(m.alignment ?? []),
    ac: ac.ac,
    acFrom: ac.from,
    hp: m.hp?.average ?? 0,
    hpFormula: m.hp?.formula,
    hpSpecial: m.hp?.special,
    speed,
    hasFly: moves(speed, 'fly'),
    hasSwim: moves(speed, 'swim'),
    abilities: {
      str: ability(m.str),
      dex: ability(m.dex),
      con: ability(m.con),
      int: ability(m.int),
      wis: ability(m.wis),
      cha: ability(m.cha),
    },
    passive: Number(m.passive) || 0,
    senses: m.senses ?? [],
    skills: skillBonuses(m.skill),
    saves: m.save ?? {},
    vulnerable: damageText(m.vulnerable),
    resist: damageText(m.resist),
    immune: damageText(m.immune),
    conditionImmune: damageText(m.conditionImmune),
    languages: m.languages ?? [],
    traits: m.trait ?? [],
    spellcasting: (m.spellcasting ?? []).map(spellcastingEntry),
    actions: m.action ?? [],
    bonusActions: m.bonus ?? [],
    reactions: m.reaction ?? [],
    legendary: withHeader('Legendary Actions', m.legendaryHeader, m.legendary),
    mythic: withHeader('Mythic Actions', m.mythicHeader, m.mythic),
    xp: typeof m.cr === 'object' ? m.cr.xp : undefined,
    xpLair: typeof m.cr === 'object' ? m.cr.xpLair : undefined,
    initiative: initiativeOf(m, ability(m.dex)),
    lair: m.legendaryGroup
      ? (groups.get(`${m.legendaryGroup.name}|${m.legendaryGroup.source}`) ?? [])
      : [],
  }
}

/** A list of actions, led by the creature's own sentence about them when it has one. */
function withHeader(
  name: string,
  header: Entry[] | undefined,
  actions: BeastEntry[] | undefined,
): BeastEntry[] {
  if (!actions?.length) return []
  return header?.length ? [{ name, entries: header }, ...actions] : actions
}

/** Every monster of the bestiary files of these sources, as the data has them. */
async function readMonsters(sources: string[]): Promise<[RawMonster[], EditionOf]> {
  const index = await fetchData<Record<string, string>>('bestiary/index.json')
  const files = sources.map((s) => index[s]).filter((f): f is string => !!f)

  // A book whose edition cannot be read is taken as 2014, like one with no date.
  const editionOf = await loadBookEditions().catch(() => (): Edition => 'classic')
  const loaded = await Promise.all(
    files.map((file) =>
      fetchData<BestiaryFile>(`bestiary/${file}`).catch(() => ({ monster: [] })),
    ),
  )
  return [loaded.flatMap((file) => file.monster ?? []), editionOf]
}

type EditionOf = (source: string) => Edition

const byChallenge = (a: Beast, b: Beast) =>
  Number(b.hasCr) - Number(a.hasCr) ||
  a.crValue - b.crValue ||
  a.name.localeCompare(b.name)

/** Load all beasts from the bestiary files for the given book sources. */
export async function loadBeasts(sources: string[]): Promise<Beast[]> {
  const [monsters, editionOf] = await readMonsters(sources)
  return monsters
    .filter((m) => typeName(m.type) === 'beast')
    .map((m) => normalize(m, editionOf(m.source)))
    .sort(byChallenge)
}

/** The lair actions and regional effects of each legendary group, by name and book. */
async function loadLairs(): Promise<Map<string, BeastEntry[]>> {
  const file = await fetchData<LegendaryGroupsFile>('legendarygroups.json').catch(
    (): LegendaryGroupsFile => ({}),
  )
  return new Map(
    (file.legendaryGroup ?? []).map((g) => [
      `${g.name}|${g.source}`,
      [
        { name: 'Lair Actions', entries: g.lairActions ?? [] },
        { name: 'Regional Effects', entries: g.regionalEffects ?? [] },
        { name: 'Mythic Encounter', entries: g.mythicEncounter ?? [] },
      ].filter((e) => e.entries.length > 0),
    ]),
  )
}

/** Every creature of the bestiary files of these sources, whatever its type. */
export async function loadCreatures(sources: string[]): Promise<Beast[]> {
  const [[monsters, editionOf], lairs] = await Promise.all([
    readMonsters(sources),
    loadLairs(),
  ])
  return monsters.map((m) => normalize(m, editionOf(m.source), lairs))
}
