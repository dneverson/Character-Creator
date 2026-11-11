// Beast data for Druid Wild Shape: load the bestiary files for the given
// sources and extract the beasts, normalized to the stats the picker needs.

import type { AbilityKey } from '../dice/dice'
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
  /** Type tags such as "dinosaur" or "cattle". */
  tags: string[]
  ac: number
  /** What the armor class comes from, "natural armor". */
  acFrom?: string
  /** Average hit points (0 when the data gives a special value). */
  hp: number
  hpFormula?: string
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
  traits: BeastEntry[]
  actions: BeastEntry[]
}

interface RawMonster {
  name: string
  source: string
  type?:
    string | { type?: string; swarmSize?: string; tags?: (string | { tag?: string })[] }
  size?: string[]
  cr?: string | { cr?: string }
  ac?: (number | { ac?: number; from?: string[] })[]
  hp?: { average?: number; formula?: string }
  speed?: Record<string, SpeedValue> | number
  str?: number
  dex?: number
  con?: number
  int?: number
  wis?: number
  cha?: number
  passive?: number | string
  senses?: string[]
  skill?: Record<string, string>
  trait?: BeastEntry[]
  action?: BeastEntry[]
}

interface BestiaryFile {
  monster?: RawMonster[]
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
  if (typeof type === 'string') return type
  return type?.type ?? ''
}

function firstAc(ac: RawMonster['ac']): { ac: number; from?: string } {
  const first = ac?.[0]
  if (typeof first === 'number') return { ac: first }
  return { ac: first?.ac ?? 0, from: first?.from?.join(', ') }
}

function crString(cr: RawMonster['cr']): string | undefined {
  return typeof cr === 'string' ? cr : cr?.cr
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

function normalize(m: RawMonster, edition: Edition): Beast {
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
    tags: typeTags(m.type),
    ac: ac.ac,
    acFrom: ac.from,
    hp: m.hp?.average ?? 0,
    hpFormula: m.hp?.formula,
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
    skills: m.skill ?? {},
    traits: m.trait ?? [],
    actions: m.action ?? [],
  }
}

/** Load all beasts from the bestiary files for the given book sources. */
export async function loadBeasts(sources: string[]): Promise<Beast[]> {
  const index = await fetchData<Record<string, string>>('bestiary/index.json')
  const files = sources.map((s) => index[s]).filter((f): f is string => !!f)

  // A book whose edition cannot be read is taken as 2014, like one with no date.
  const editionOf = await loadBookEditions().catch(() => (): Edition => 'classic')
  const loaded = await Promise.all(
    files.map((file) =>
      fetchData<BestiaryFile>(`bestiary/${file}`).catch(() => ({ monster: [] })),
    ),
  )

  const beasts: Beast[] = []
  for (const file of loaded) {
    for (const m of file.monster ?? []) {
      if (typeName(m.type) === 'beast') beasts.push(normalize(m, editionOf(m.source)))
    }
  }
  beasts.sort(
    (a, b) =>
      Number(b.hasCr) - Number(a.hasCr) ||
      a.crValue - b.crValue ||
      a.name.localeCompare(b.name),
  )
  return beasts
}
