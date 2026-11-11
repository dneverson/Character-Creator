// Spell facts as text: the casting time, range, duration, components, damage,
// healing and upcast of a spell, read once from the shapes the spell data uses.
// Pure functions; `spells.ts` calls them when it loads. Nothing here invents a
// number: damage and scaling come from the data's tags, and anything the data
// does not state precisely is "Yes" (look at the description).

import { stripTags } from '../text/tags'
import { titleCase } from '../text/titleCase'
import { AREA_TAG_LABELS, ROYALTY_LABEL, SPELL_TAG_LABELS } from './labels'

export interface RawTime {
  number: number
  unit: string
  condition?: string
  note?: string
}

export interface RawRange {
  type: string
  distance?: { type: string; amount?: number }
}

export interface RawComponents {
  v?: boolean
  s?: boolean
  m?: string | { text: string; cost?: number; consume?: boolean | string }
  r?: boolean
}

export interface RawDuration {
  type: string
  duration?: { type: string; amount: number; upTo?: boolean }
  concentration?: boolean
  ends?: string[]
}

export interface RawScalingLevelDice {
  label: string
  scaling: Record<string, string>
}

export interface SpellComponents {
  v: boolean
  s: boolean
  m: boolean
  royalty: boolean
}

export interface SpellMaterial {
  text: string
  costGp?: number
  consumed: boolean
}

/** "1st", "2nd", "3rd", "4th", "11th". */
export function ordinal(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]}`
}

const plural = (n: number, word: string) => (n === 1 ? word : `${word}s`)

// ---- Casting time -----------------------------------------------------------

const TIME_UNIT: Record<string, string> = { action: 'action', bonus: 'bonus action' }

function oneTime(time: RawTime): string {
  const unit = TIME_UNIT[time.unit] ?? plural(time.number, time.unit)
  const base = `${time.number} ${unit}`
  const note = time.note ? ` (${time.note})` : ''
  return time.condition ? `${base}${note}, ${stripTags(time.condition)}` : base + note
}

/** "1 action", "1 reaction, which you take when ...", "1 action or 8 hours". */
export function timeText(time: RawTime[] | undefined): string {
  return (time ?? []).map(oneTime).join(' or ')
}

/** The kind of casting time to filter by. */
export function castingUnitOf(time: RawTime[] | undefined): string {
  switch (time?.[0]?.unit) {
    case 'action':
      return 'Action'
    case 'bonus':
      return 'Bonus action'
    case 'reaction':
      return 'Reaction'
    case 'minute':
      return 'Minute'
    case 'hour':
      return 'Hour'
    default:
      return 'Other'
  }
}

/** Casting time as a number to sort by: actions first, then minutes. */
export function castingMinutesOf(time: RawTime[] | undefined): number {
  const first = time?.[0]
  if (!first) return 0
  switch (first.unit) {
    case 'bonus':
      return 0.01
    case 'reaction':
      return 0.02
    case 'minute':
      return first.number
    case 'hour':
      return first.number * 60
    default:
      return 0
  }
}

// ---- Range and area ---------------------------------------------------------

const FEET_PER_MILE = 5280

function distanceText(distance: { type: string; amount?: number }): string {
  const n = distance.amount ?? 0
  return distance.type === 'miles' ? `${n}-mile` : `${n}-ft.`
}

/** The shape a self-range covers: "30-ft. cone", "10-ft. radius"; "" for a point. */
function shapeOf(range: RawRange): string {
  if (range.type === 'point' || range.type === 'special' || !range.distance) return ''
  return `${distanceText(range.distance)} ${range.type}`
}

/** "150 ft.", "Self (30-ft. cone)", "Touch", "Sight", "Unlimited", "Special". */
export function rangeText(range: RawRange | undefined): string {
  if (!range || range.type === 'special') return 'Special'
  const shape = shapeOf(range)
  if (shape) return `Self (${shape})`
  const distance = range.distance
  switch (distance?.type) {
    case 'self':
      return 'Self'
    case 'touch':
      return 'Touch'
    case 'sight':
      return 'Sight'
    case 'unlimited':
      return 'Unlimited'
    case 'miles': {
      const n = distance.amount ?? 0
      return `${n} ${plural(n, 'mile')}`
    }
    case 'feet':
      return `${distance.amount ?? 0} ft.`
    default:
      return 'Special'
  }
}

/** Range as a number of feet to sort by: self 0, touch 5, sight and unlimited last. */
export function rangeFeetOf(range: RawRange | undefined): number {
  if (!range || range.type === 'special') return 4e9
  if (shapeOf(range)) return 0
  const distance = range.distance
  switch (distance?.type) {
    case 'self':
      return 0
    case 'touch':
      return 5
    case 'feet':
      return distance.amount ?? 0
    case 'miles':
      return (distance.amount ?? 0) * FEET_PER_MILE
    case 'sight':
      return 2e9
    case 'unlimited':
      return 3e9
    default:
      return 4e9
  }
}

/** The area: the self-range's shape, else the decoded area tags; "" when neither. */
export function areaOf(
  range: RawRange | undefined,
  areaTags: string[] | undefined,
): string {
  const shape = range ? shapeOf(range) : ''
  if (shape) return shape.replace(/^./, (c) => c.toUpperCase())
  return (areaTags ?? []).flatMap((code) => AREA_TAG_LABELS[code] ?? []).join(', ')
}

// ---- Components -------------------------------------------------------------

export function componentsOf(c: RawComponents | undefined): SpellComponents {
  return { v: !!c?.v, s: !!c?.s, m: !!c?.m, royalty: !!c?.r }
}

/** The material component with its cost (in gp) and whether the spell uses it up. */
export function materialOf(c: RawComponents | undefined): SpellMaterial | undefined {
  const m = c?.m
  if (!m) return undefined
  if (typeof m === 'string') return { text: m, consumed: false }
  return {
    text: m.text,
    costGp: m.cost === undefined ? undefined : m.cost / 100,
    consumed: m.consume === true,
  }
}

/** "V, S, M" (and "Royalty" for the three spells that cost a royalty); "-" for none. */
export function componentsText(c: SpellComponents): string {
  const parts: string[] = []
  if (c.v) parts.push('V')
  if (c.s) parts.push('S')
  if (c.m) parts.push('M')
  if (c.royalty) parts.push(ROYALTY_LABEL)
  return parts.join(', ') || '-'
}

/** The material with its cost: "a gem (worth 50 gp)", "a rod (worth 5,000 gp, consumed)". */
export function materialText(material: SpellMaterial | undefined): string {
  if (!material) return ''
  const notes: string[] = []
  if (material.costGp !== undefined)
    notes.push(`worth ${material.costGp.toLocaleString('en-US')} gp`)
  if (material.consumed) notes.push('consumed')
  return notes.length > 0 ? `${material.text} (${notes.join(', ')})` : material.text
}

// ---- Duration ---------------------------------------------------------------

function oneDuration(d: RawDuration | null): string {
  if (!d) return 'Special'
  switch (d.type) {
    case 'instant':
      return 'Instantaneous'
    case 'timed': {
      const t = d.duration
      const span = t ? `${t.amount} ${plural(t.amount, t.type)}` : 'Special'
      if (d.concentration) return `Concentration, up to ${span}`
      return t?.upTo ? `Up to ${span}` : span
    }
    case 'permanent':
      if (d.ends?.includes('dispel') && d.ends.includes('trigger'))
        return 'Until dispelled or triggered'
      return d.ends?.includes('trigger') ? 'Until triggered' : 'Until dispelled'
    default:
      return 'Special'
  }
}

/** "Instantaneous", "Concentration, up to 1 minute", "1 hour", "Until dispelled". */
export function durationText(duration: RawDuration[] | undefined): string {
  return (duration ?? []).map(oneDuration).join(' or ')
}

/** The kind of duration to filter by. */
export function durationKindOf(duration: RawDuration[] | undefined): string {
  const list = duration ?? []
  if (list.some((d) => d?.concentration)) return 'Concentration'
  switch (list[0]?.type) {
    case 'instant':
      return 'Instantaneous'
    case 'timed':
      return 'Timed'
    case 'permanent':
      return 'Permanent'
    default:
      return 'Special'
  }
}

// ---- Damage, healing, upcast --------------------------------------------------

const DAMAGE_TYPES = new Set([
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
])

/** Every string inside an entry tree, in reading order. */
function textOf(entries: unknown): string {
  const out: string[] = []
  const walk = (node: unknown) => {
    if (typeof node === 'string') out.push(node)
    else if (Array.isArray(node)) node.forEach(walk)
    else if (node && typeof node === 'object') Object.values(node).forEach(walk)
  }
  walk(entries)
  return out.join('\n')
}

const damageTag = /\{@damage ([^}|]+)[^}]*\}(?:\s+([A-Za-z]+)\s+damage)?/g

export interface SpellDamage {
  /** "8d6 Fire", "1d6 Fire; 2d8"; "" when the spell does none. */
  text: string
  types: string[]
}

/**
 * What a spell deals, read from the `{@damage}` tags of its own text (never the
 * higher-level text, whose dice are the upcast increment). Each is paired with
 * the damage type written after it, else with the spell's only `damageInflict`
 * type. A spell with damage types and no tag shows the types alone. A cantrip
 * that scales (`scales`) shows its first dice only; its growth is its own fact.
 */
export function damageOf(
  entries: unknown,
  damageInflict: string[] | undefined,
  scales = false,
): SpellDamage {
  const inflict = (damageInflict ?? []).map(titleCase)
  const only = inflict.length === 1 ? inflict[0] : undefined
  const parts = new Map<string, string>()
  for (const m of textOf(entries).matchAll(damageTag)) {
    const word = m[2]?.toLowerCase()
    const written = word && DAMAGE_TYPES.has(word) ? titleCase(word) : undefined
    const type = written ?? only
    const dice = m[1].trim()
    const text = type ? `${dice} ${type}` : dice
    if (!parts.has(text)) parts.set(text, written ?? '')
    if (scales) break
  }
  const types = [...new Set([...inflict, ...[...parts.values()].filter(Boolean)])]
  if (parts.size === 0) return { text: inflict.join(', '), types }
  return { text: [...parts.keys()].join('; '), types }
}

/** The healing a spell gives: dice when its text states them, else "Yes", else "". */
export function healingOf(entries: unknown, miscTags: string[] | undefined): string {
  if (!miscTags?.includes('HL')) return ''
  for (const sentence of textOf(entries).split(/(?<=\.)\s+/)) {
    if (!/hit points|regain|restore/i.test(sentence)) continue
    const dice = /\{@(?:dice|damage) ([^}|]+)[^}]*\}/.exec(sentence)
    if (!dice) continue
    const modifier = /spellcasting ability modifier/i.test(sentence)
    return modifier ? `${dice[1].trim()} + spellcasting modifier` : dice[1].trim()
  }
  return 'Yes'
}

const scaleTag = /\{@(?:scaledamage|scaledice) ([^}]+)\}/
const olderUpcast =
  /by \{@(?:damage|dice) ([^}|]+)[^}]*\} for each (?:slot )?level above (\d+)/

export const isCantripUpgrade = (block: unknown) =>
  !!block && typeof block === 'object' && Reflect.get(block, 'name') === 'Cantrip Upgrade'

/**
 * How a spell grows with a higher slot: "+1d6 per slot level above 3rd", "Yes"
 * when its higher-level text has no dice to state, "" when it has none (or is
 * only a cantrip's upgrade).
 */
export function upcastOf(higher: unknown[] | undefined): string {
  const blocks = (higher ?? []).filter((block) => !isCantripUpgrade(block))
  if (blocks.length === 0) return ''
  const text = textOf(blocks)
  const tag = scaleTag.exec(text)
  if (tag) {
    const [, range = '', increment = ''] = tag[1].split('|')
    const step = increment.replace(/;/g, ' and ')
    if (range.includes(',')) return `+${step} at levels ${range.split(',').join(', ')}`
    const from = Number.parseInt(range, 10)
    if (step && Number.isFinite(from))
      return `+${step} per slot level above ${ordinal(from)}`
  }
  const older = olderUpcast.exec(text)
  if (older)
    return `+${older[1].trim()} per slot level above ${ordinal(Number(older[2]))}`
  return 'Yes'
}

/** "1d6, 2d6 at 5, 3d6 at 11, 4d6 at 17" from a cantrip's scaling; "" when none. */
export function cantripScalingOf(
  scaling: RawScalingLevelDice | RawScalingLevelDice[] | undefined,
): string {
  if (!scaling) return ''
  const list = Array.isArray(scaling) ? scaling : [scaling]
  const one = (s: RawScalingLevelDice) =>
    Object.entries(s.scaling)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([level, dice], i) => (i === 0 ? dice : `${dice} at ${level}`))
      .join(', ')
  return list.length === 1
    ? one(list[0])
    : list.map((s) => `${s.label}: ${one(s)}`).join('; ')
}

// ---- Small decodes ----------------------------------------------------------

/** The decoded miscellaneous tags; a code with no decode is left out. */
export function tagsOf(miscTags: string[] | undefined): string[] {
  return (miscTags ?? []).flatMap((code) => SPELL_TAG_LABELS[code] ?? [])
}

export function attackOf(spellAttack: string[] | undefined): '' | 'Melee' | 'Ranged' {
  if (spellAttack?.includes('M')) return 'Melee'
  return spellAttack?.includes('R') ? 'Ranged' : ''
}
