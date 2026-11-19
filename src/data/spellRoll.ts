// What a spell rolls when it is cast: its damage or healing as typed pieces of dice, how
// they grow with the character's level (a cantrip) or with a higher slot, and how many
// beams, rays or darts it makes. Everything is read from the spell's own data (the damage
// tags, the scaling of a cantrip, the higher-level text), so each spell of every book is
// covered the same way. The sheet turns this into a roll window (see spellRoll.ts there).

import { textOf, type DamagePart } from './spellText'
import type { Spell } from './spells'

/** A number of dice of one size. */
export interface DiceTerm {
  count: number
  sides: number
}

/** One thing a cast rolls: dice and a flat number of one type ("healing" for healing). */
export interface Piece {
  dice: DiceTerm[]
  flat: number
  /** The damage type in lower case; "" when the data names none. */
  type: string
  /** The spellcasting ability modifier is added ("2d8 plus your modifier"). */
  addsModifier: boolean
}

/** How a cast resolves: at once ("auto"), against an attack roll, or against a save. */
export type SpellAction = 'attack' | 'save' | 'auto' | 'healing'

/** A way the spell can be rolled, for a spell with two ("Toll the Dead"). */
interface Variant {
  label: string
  /** What it rolls at the lowest level. */
  pieces: Piece[]
  /** A cantrip: the dice it rolls from each character level on. */
  tiers: { level: number; dice: DiceTerm[] }[]
}

/** The dice a higher slot adds, for each step above the spell's level. */
interface Upcast {
  add: DiceTerm
  /** The damage type it adds to, when the text names one. */
  type: string
  /** The dice of the spell it is stated against (to find its piece). */
  base: string
  /** The spell levels it applies from; each one after the first adds a step. */
  levels: number[]
}

/** Beams, rays or darts: how many there are at the lowest level, and how that grows. */
interface Projectile {
  noun: string
  base: number
  /** More of them for each slot level above the spell's level. */
  perLevel: number
  /** A cantrip: how many from each character level on. */
  tiers: { level: number; count: number }[]
}

export interface SpellRollPlan {
  action: SpellAction
  level: number
  /** The saving throw abilities, in full ("Dexterity"). */
  save: string[]
  variants: Variant[]
  upcasts: Upcast[]
  projectile?: Projectile
}

/** What the plan comes to for one cast. */
export interface SpellCast {
  /** The variant rolled; its label says which when the spell has several. */
  variant: string
  pieces: Piece[]
  /** How the dice came about, one plain line each ("Cast at level 4: +1d6"). */
  lines: string[]
  /** Beams, rays or darts at this cast, when the spell makes them. */
  projectiles?: { noun: string; count: number }
}

const DAMAGE_WORD =
  /\b(acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder)\b/i
const ROLL = /^(\d*d\d+|\d+)(\s*[+-]\s*(\d*d\d+|\d+))*$/
const NUMBER_WORDS = [
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
]
const numberOf = (word: string) => {
  const at = NUMBER_WORDS.indexOf(word.toLowerCase())
  return at >= 0 ? at + 1 : Number(word)
}

/** The dice and the flat number of a roll such as "2d8", "1d4 + 1" or "10d6 + 40". */
function parseRoll(roll: string): { dice: DiceTerm[]; flat: number } | undefined {
  const text = roll.trim().toLowerCase()
  if (!ROLL.test(text) || /-\s*\d*d/.test(text)) return undefined
  const dice: DiceTerm[] = []
  let flat = 0
  for (const [, sign, count, sides, number] of text.matchAll(
    /([+-]?)\s*(?:(\d*)d(\d+)|(\d+))/g,
  )) {
    if (sides) dice.push({ count: Number(count || 1), sides: Number(sides) })
    else flat += sign === '-' ? -Number(number) : Number(number)
  }
  return { dice, flat }
}

const termsOf = (roll: string): DiceTerm[] | undefined => {
  const parsed = parseRoll(roll)
  return parsed && parsed.flat === 0 && parsed.dice.length > 0 ? parsed.dice : undefined
}

/** The levels a range of the scaling tags names: "3-9" or "2,4,6,8". */
function levelsOf(range: string): number[] {
  const [from, to] = range.split('-').map(Number)
  if (range.includes('-') && Number.isFinite(from) && Number.isFinite(to)) {
    return Array.from({ length: to - from + 1 }, (_, at) => from + at)
  }
  return range.split(',').map(Number).filter(Number.isFinite)
}

const SCALE_TAG = /\{@(?:scaledamage|scaledice) ([^|}]+)\|([^|}]+)\|([^|}]+)\}/g
const OLDER_UPCAST =
  /by \{@(?:damage|dice) ([^}|]+)[^}]*\} for each (?:slot )?level above (\d+)/g

/** What a higher slot adds, from the tags and the older wording of the higher-level text. */
function upcastsOf(higher: Spell['entriesHigherLevel']): Upcast[] {
  const text = textOf((higher ?? []).filter((block) => !isUpgrade(block)))
  const found: Upcast[] = []
  for (const m of text.matchAll(SCALE_TAG)) {
    const add = termsOf(m[3])?.[0]
    if (!add) continue
    const before = text.slice(Math.max(0, (m.index ?? 0) - 120), m.index)
    const named = [...before.matchAll(new RegExp(DAMAGE_WORD, 'gi'))].at(-1)?.[1] ?? ''
    found.push({
      add,
      type: named.toLowerCase(),
      base: m[1].trim(),
      levels: levelsOf(m[2]),
    })
  }
  for (const m of text.matchAll(OLDER_UPCAST)) {
    const add = termsOf(m[1])?.[0]
    if (add) {
      const from = Number(m[2])
      found.push({ add, type: '', base: '', levels: levelsOf(`${from}-9`) })
    }
  }
  return found
}

const isUpgrade = (block: unknown) =>
  !!block && typeof block === 'object' && Reflect.get(block, 'name') === 'Cantrip Upgrade'

const COUNT_WORD = '(one|two|three|four|five|six|seven|eight|nine|\\d+)'
const NOUN = '(dart|ray|beam|missile)s?'

/** Beams, rays or darts of a spell, from the text that counts them. */
function projectileOf(spell: Spell): Projectile | undefined {
  const higher = textOf((spell.entriesHigherLevel ?? []).filter((b) => !isUpgrade(b)))
  const all = `${textOf(spell.entries)}\n${textOf(spell.entriesHigherLevel)}`
  const more = new RegExp(
    `${COUNT_WORD} (?:more|additional|extra) ${NOUN} for (?:each|every) (?:spell )?slot level above`,
    'i',
  ).exec(higher)
  const tiers = [
    ...all.matchAll(
      new RegExp(
        `${COUNT_WORD} ${NOUN} (?:at|when you reach) (?:level )?(\\d+)(?:st|nd|rd|th)?`,
        'gi',
      ),
    ),
  ].map((m) => ({ level: Number(m[3]), count: numberOf(m[1]) }))
  if (!more && tiers.length === 0) return undefined
  const first = new RegExp(`${COUNT_WORD} (?:[a-z]+ ){0,2}${NOUN}`, 'i').exec(
    textOf(spell.entries),
  )
  const noun = (more ?? [])[2] ?? first?.[2] ?? 'beam'
  return {
    noun: noun.toLowerCase(),
    base: tiers.length > 0 ? 1 : first ? numberOf(first[1]) : 1,
    perLevel: more ? numberOf(more[1]) : 0,
    tiers: tiers.sort((a, b) => a.level - b.level),
  }
}

/** Whether the text adds the spellcasting modifier to this roll ("1d8 + your ... modifier"). */
const addsModifier = (text: string, roll: string) => {
  const at = text.indexOf(`{@damage ${roll}`)
  const after = at < 0 ? '' : text.slice(text.indexOf('}', at) + 1)
  return /^\s*(?:\+|plus) your spellcasting ability modifier/.test(after)
}

const piece = (part: DamagePart, text: string): Piece | undefined => {
  const parsed = parseRoll(part.roll)
  return parsed && parsed.dice.length > 0
    ? { ...parsed, type: part.type, addsModifier: addsModifier(text, part.roll) }
    : undefined
}

/** The type a label names ("necrotic damage to wounded creature"), else the spell's own. */
const typeOfLabel = (label: string, parts: DamagePart[], spell: Spell) =>
  DAMAGE_WORD.exec(label)?.[1].toLowerCase() ??
  parts[0]?.type ??
  spell.damageTypes[0]?.toLowerCase() ??
  ''

/** The ways a cantrip rolls, from its scaling; each one is a roll of its own. */
function cantripVariants(spell: Spell): Variant[] {
  return spell.cantripDice.flatMap((entry) => {
    const tiers = entry.tiers.flatMap((tier) => {
      const dice = termsOf(tier.dice)
      return dice ? [{ level: tier.level, dice }] : []
    })
    if (tiers.length === 0) return []
    return [
      {
        label: entry.label,
        pieces: [
          {
            dice: [],
            flat: 0,
            type: typeOfLabel(entry.label, spell.damageParts, spell),
            addsModifier: false,
          },
        ],
        tiers,
      },
    ]
  })
}

/** The dice of a variant at a character level; none while its first tier is not reached. */
const tierAt = (variant: Variant, level: number) =>
  variant.tiers.findLast((tier) => tier.level <= level)

const MODIFIER = / \+ spellcasting modifier$/

/** The pieces a leveled spell rolls: its damage, else its healing. */
function leveledPieces(spell: Spell): Piece[] {
  const text = textOf(spell.entries)
  const damage = spell.damageParts.flatMap((part) => piece(part, text) ?? [])
  if (damage.length > 0) return damage
  const roll = spell.healing.replace(MODIFIER, '')
  const parsed = parseRoll(roll)
  return parsed && parsed.dice.length > 0
    ? [{ ...parsed, type: 'healing', addsModifier: MODIFIER.test(spell.healing) }]
    : []
}

/**
 * What a spell rolls, or undefined when its data gives nothing to roll (no dice in its
 * damage or its healing), so the sheet offers no roll for it.
 */
export function spellRollPlan(spell: Spell): SpellRollPlan | undefined {
  if (!plans.has(spell)) plans.set(spell, planOf(spell))
  return plans.get(spell)
}

/** The plan of each spell, read once: a spell's data does not change. */
const plans = new WeakMap<Spell, SpellRollPlan | undefined>()

function planOf(spell: Spell): SpellRollPlan | undefined {
  const variants: Variant[] =
    spell.level === 0 && spell.cantripDice.length > 0
      ? cantripVariants(spell)
      : [
          {
            label: '',
            pieces: leveledPieces(spell),
            tiers: [],
          },
        ].filter((v) => v.pieces.length > 0)
  if (variants.length === 0) return undefined
  const healing = variants[0].pieces[0].type === 'healing'
  const action: SpellAction = healing
    ? 'healing'
    : spell.attack !== ''
      ? 'attack'
      : spell.save.length > 0
        ? 'save'
        : 'auto'
  return {
    action,
    level: spell.level,
    save: spell.save,
    variants,
    upcasts: spell.level > 0 ? upcastsOf(spell.entriesHigherLevel) : [],
    projectile: projectileOf(spell),
  }
}

/** The variants a character of this level can roll (a cantrip's tiers may not be reached). */
export function variantsAt(plan: SpellRollPlan, characterLevel: number): string[] {
  return plan.variants
    .filter((v) => v.tiers.length === 0 || tierAt(v, characterLevel) !== undefined)
    .map((v) => v.label)
}

const textOfTerms = (terms: DiceTerm[]) =>
  terms.map((t) => `${t.count}d${t.sides}`).join(' + ')

/** The piece an upcast adds to: the one of its type, else of its dice, else the first. */
function targetOf(pieces: Piece[], upcast: Upcast): Piece {
  const text = (p: Piece) => p.dice.map((d) => `${d.count}d${d.sides}`).join('+')
  return (
    pieces.find((p) => upcast.type !== '' && p.type === upcast.type) ??
    pieces.find(
      (p) => upcast.base !== '' && text(p) === upcast.base.replace(/\s/g, ''),
    ) ??
    pieces[0]
  )
}

function addDice(target: Piece, add: DiceTerm, steps: number): Piece {
  const same = target.dice.some((d) => d.sides === add.sides)
  const extra = add.count * steps
  return {
    ...target,
    dice: same
      ? target.dice.map((d) =>
          d.sides === add.sides ? { ...d, count: d.count + extra } : d,
        )
      : [...target.dice, { count: extra, sides: add.sides }],
  }
}

/**
 * What one cast rolls: a cantrip at a character level, a leveled spell cast with a slot
 * of `slotLevel`. `variant` picks one of a cantrip's ways to roll (the first by default).
 */
export function resolveCast(
  plan: SpellRollPlan,
  cast: { characterLevel: number; slotLevel: number; variant?: string },
): SpellCast {
  const available = plan.variants.filter(
    (v) => v.tiers.length === 0 || tierAt(v, cast.characterLevel),
  )
  const variant = available.find((v) => v.label === cast.variant) ?? available[0]
  const lines: string[] = []
  let pieces = variant.pieces
  const tier = tierAt(variant, cast.characterLevel)
  if (tier) {
    pieces = [{ ...variant.pieces[0], dice: tier.dice }]
    lines.push(`Character level ${cast.characterLevel}: ${textOfTerms(tier.dice)}`)
  }
  for (const upcast of plan.upcasts) {
    const steps = Math.max(0, upcast.levels.filter((l) => l <= cast.slotLevel).length - 1)
    if (steps === 0) continue
    const target = targetOf(pieces, upcast)
    pieces = pieces.map((p) => (p === target ? addDice(p, upcast.add, steps) : p))
    lines.push(
      `Cast at level ${cast.slotLevel}: +${textOfTerms([{ ...upcast.add, count: upcast.add.count * steps }])}`,
    )
  }
  const { projectile } = plan
  const count = projectile
    ? (projectile.tiers.findLast((t) => t.level <= cast.characterLevel)?.count ??
        projectile.base) +
      projectile.perLevel * Math.max(0, cast.slotLevel - plan.level)
    : undefined
  return {
    variant: variant.label,
    pieces,
    lines,
    ...(projectile &&
      count !== undefined && { projectiles: { noun: projectile.noun, count } }),
  }
}
