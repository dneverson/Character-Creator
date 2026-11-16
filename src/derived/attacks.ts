// Attacks: one row for each equipped weapon and one for the unarmed strike, each with
// the attack bonus and the damage as lines (the ability used and why, proficiency, the
// magic bonus, a fighting style). A bonus that holds only in some way of fighting is shown
// beside the number, not added to it. A weapon the character is not proficient with loses
// the proficiency bonus and says so; nothing is ever refused.

import { ABILITY_NAMES, abilityMod, formatMod, type AbilityKey } from '../dice/dice'
import type { ItemMastery, ItemProperty } from '../data/items'
import { FIGHTING_STYLES, type FightingStyle } from '../rules/fightingStyles'
import { MONK_WEAPON_RULES, type MonkWeaponRule } from '../rules/martialArts'
import type { AbilityTotals } from './armorClass'
import { classTableDie } from './classTable'
import { heldFeaturePicks } from './featurePicks'
import { itemBonus } from './itemBonus'
import { heldOptionEffects, weaponEffects, type HeldEffect } from './optionEffects'
import { weaponProficiency, type Proficiencies } from './proficiencies'
import { heldBy, type HeldItem, type Sources } from './sources'
import { masteredKinds } from './weaponMastery'
import { BASE_SOURCE, quantity, type Line, type Quantity, type SourceRef } from './types'

export interface AttackRow {
  id: string
  name: string
  /** How many are in the equipped stack. */
  count: number
  toHit: Quantity
  /**
   * `dice` is empty when the damage has no die (an unarmed strike without Martial
   * Arts): the flat base is then the first line of `bonus`, whose value is the damage.
   */
  damage: { dice: string; types: string; bonus: Quantity }
  /** The two-handed die of a versatile weapon, with its own damage lines. */
  twoHanded?: { dice: string; bonus: Quantity }
  range?: string
  properties: ItemProperty[]
  mastery?: ItemMastery
  /** Rules that go with the attack and are not a number. */
  notes: string[]
}

const MARTIAL_ARTS = 'Martial Arts'

const lineOf = (
  id: string,
  label: string,
  source: SourceRef,
  amount: number,
  extra: Partial<Line> = {},
): Line => ({ id, label, source, amount, op: 'add', status: 'applied', ...extra })

/** The ability a weapon is used with, and the reason in words. */
function weaponAbility(
  held: HeldItem,
  totals: AbilityTotals,
): { key: AbilityKey; why: string } {
  const weapon = held.item.weapon
  const codes = weapon?.properties.map((p) => p.code) ?? []
  const str = abilityMod(totals.str)
  const dex = abilityMod(totals.dex)
  if (codes.includes('F')) {
    return dex >= str
      ? {
          key: 'dex',
          why: `Finesse: Dexterity ${formatMod(dex)} is at least Strength ${formatMod(str)}`,
        }
      : {
          key: 'str',
          why: `Finesse: Strength ${formatMod(str)} beats Dexterity ${formatMod(dex)}`,
        }
  }
  if (weapon && !weapon.melee) return { key: 'dex', why: 'Ranged weapon: Dexterity' }
  return { key: 'str', why: 'Melee weapon: Strength' }
}

interface Context {
  sources: Sources
  totals: AbilityTotals
  prof: number
  proficiencies: Proficiencies
  /** The lines of the armor class that flag armor the character is not proficient with. */
  armorFlags: Line[]
  styles: { style: FightingStyle; source: SourceRef }[]
  /** Weapons in the equipped stacks, counting each of a stack. */
  weaponCount: number
  shield: boolean
  /** The kinds of weapons picked for a weapon mastery, with what they were picked for. */
  mastered: Map<string, SourceRef>
  /** The effects of the class options held (an infusion, a pact weapon's invocations). */
  effects: HeldEffect[]
  /** A monk's Martial Arts, for the attacks with monk weapons. */
  martialArts?: MartialArts
}

interface MartialArts {
  faces: number
  source: SourceRef
  rule?: MonkWeaponRule
  /** The weapons picked as monk weapons (kensei weapons, a dedicated weapon), by key. */
  picked: Map<string, { source: SourceRef; needsProficiency: boolean }>
  /** The armor or shield worn, which turns Martial Arts off. */
  armor?: string
}

/** A monk's Martial Arts: its die at the Monk level, and what makes a weapon a monk weapon. */
function martialArtsOf(sources: Sources): MartialArts | undefined {
  const monk = sources.classes.find((c) => c.row.name === 'Monk' && c.loaded)
  const faces =
    monk?.loaded && monk.level > 0
      ? classTableDie(monk.loaded.entry, MARTIAL_ARTS, monk.level)
      : undefined
  if (!monk || !faces) return undefined
  const picked: MartialArts['picked'] = new Map()
  for (const held of heldFeaturePicks(sources)) {
    if (!held.pick.monkWeapons) continue
    const source = { ...held.source, label: held.pick.title }
    // A dedicated weapon must be one the monk is proficient with; kensei weapons give it.
    const needsProficiency = held.pick.from?.kind === 'inventory'
    for (const key of sources.character.classOptions[held.tag] ?? [])
      picked.set(key, { source, needsProficiency })
  }
  return {
    faces,
    source: { kind: 'class', tag: `class:Monk|${monk.row.source}`, label: MARTIAL_ARTS },
    rule: MONK_WEAPON_RULES.find((r) => r.classSource === monk.row.source),
    picked,
    armor: sources.items.find((i) => i.item.armor?.class)?.item.name,
  }
}

/** What makes a weapon a monk weapon for the character: the Monk's rule or a pick. */
function monkWeaponBy(
  held: HeldItem,
  ma: MartialArts,
  proficient: boolean,
): { source: SourceRef; text: string } | { unmet: string } | undefined {
  const pick =
    ma.picked.get(held.baseName.toLowerCase()) ??
    ma.picked.get(held.item.key.toLowerCase())
  if (pick && pick.needsProficiency && !proficient)
    return {
      unmet: `${pick.source.label}: you are not proficient with it, so it is not a monk weapon.`,
    }
  if (pick)
    return { source: pick.source, text: `${pick.source.label}: a monk weapon for you` }
  if (ma.rule?.is(held.item, held.baseName))
    return { source: ma.source, text: ma.rule.text }
  return undefined
}

const dieFaces = (text: string | undefined) => {
  const match = /^1d(\d+)$/.exec(text ?? '')
  return match ? Number(match[1]) : undefined
}

function stylesHeld(sources: Sources) {
  return FIGHTING_STYLES.flatMap((style) => {
    const held = heldBy(sources, style.holder)
    return held ? [{ style, source: held.source }] : []
  })
}

const flagLine = (id: string, label: string, why: string): Line => ({
  id,
  label,
  source: BASE_SOURCE,
  op: 'note',
  status: 'flag',
  why,
})

function weaponRow(held: HeldItem, ctx: Context): AttackRow | undefined {
  const weapon = held.item.weapon
  if (!weapon) return undefined
  const options = weaponEffects(ctx.sources, held, ctx.totals, ctx.effects)
  const proficient = weaponProficiency(ctx.proficiencies, held) ?? options.proficient
  const ma = ctx.martialArts
  const monkBy = ma ? monkWeaponBy(held, ma, proficient !== undefined) : undefined
  const monk = ma && monkBy && 'source' in monkBy && !ma.armor ? monkBy : undefined
  const usual = weaponAbility(held, ctx.totals)
  // An option may let the attacks use another ability (Charisma with a 2024 pact weapon),
  // and Martial Arts Dexterity with a monk weapon.
  const alt =
    options.ability ??
    (monk ? { key: 'dex' as const, source: monk.source, label: MARTIAL_ARTS } : undefined)
  const altMod = alt ? abilityMod(ctx.totals[alt.key]) : 0
  const { key, why } =
    alt && altMod > abilityMod(ctx.totals[usual.key])
      ? {
          key: alt.key,
          why: `${alt.label}: ${ABILITY_NAMES[alt.key]} ${formatMod(altMod)} beats ${ABILITY_NAMES[usual.key]}`,
        }
      : usual
  const mod = abilityMod(ctx.totals[key])
  const codes = weapon.properties.map((p) => p.code)
  const id = `attack|${held.item.key}`
  const abilitySource = alt && key === alt.key ? alt.source : BASE_SOURCE
  const ability = (suffix: string) =>
    lineOf(`${id}|${suffix}|ability`, ABILITY_NAMES[key], abilitySource, mod, {
      how: why,
    })
  const inactive = held.active
    ? {}
    : { status: 'inactive' as const, why: 'Needs attunement, and you are not attuned.' }
  const magic = (
    suffix: string,
    fields: ('bonusWeapon' | 'bonusWeaponAttack' | 'bonusWeaponDamage')[],
  ) => {
    const amount = fields.reduce((n, f) => n + itemBonus(held.item, f), 0)
    return amount === 0
      ? []
      : [lineOf(`${id}|${suffix}|magic`, 'Magic bonus', held.source, amount, inactive)]
  }

  const meleeOneHanded = weapon.melee && !codes.includes('2H')
  const alone = ctx.weaponCount === 1
  const toHit: Line[] = [ability('hit')]
  if (proficient) {
    toHit.push(
      lineOf(`${id}|hit|prof`, 'Proficiency bonus', proficient, ctx.prof, {
        how: 'You are proficient with this weapon',
      }),
    )
  } else {
    toHit.push(
      flagLine(
        `${id}|hit|not-proficient`,
        `Not proficient with the ${held.item.name}`,
        'The proficiency bonus is not added to the attack roll.',
      ),
    )
  }
  toHit.push(...magic('hit', ['bonusWeapon', 'bonusWeaponAttack']), ...options.hit)

  const damage: Line[] = [
    ability('damage'),
    ...magic('damage', ['bonusWeapon', 'bonusWeaponDamage']),
    ...options.damage,
  ]
  const notes: string[] = [...options.notes]
  const twoHandedExtra: Line[] = []
  // Martial Arts: the monk's die in place of the weapon's when it is higher.
  const dieOf = (dice: string | undefined) => {
    const faces = dieFaces(dice)
    return ma && monk && faces !== undefined && ma.faces > faces ? `1d${ma.faces}` : dice
  }
  if (ma && monkBy) {
    if ('unmet' in monkBy) notes.push(monkBy.unmet)
    else if (ma.armor)
      notes.push(
        `${MARTIAL_ARTS}: not while you wear armor or wield a shield (${ma.armor}).`,
      )
    else if (dieOf(weapon.damage?.text) !== weapon.damage?.text)
      notes.push(
        `${MARTIAL_ARTS}: ${monkBy.text}, so the damage die is d${ma.faces} in place of ${weapon.damage?.text ?? ''}.`,
      )
    else notes.push(`${MARTIAL_ARTS}: ${monkBy.text}.`)
  }

  for (const { style, source } of ctx.styles) {
    const e = style.effect
    const at = (suffix: string, amount: number, extra: Partial<Line>) =>
      lineOf(`${id}|${suffix}|${style.label}`, style.label, source, amount, {
        text: style.text,
        ...extra,
      })
    if (e.kind === 'attack' && !weapon.melee) {
      toHit.push(at('hit', e.amount, {}))
    } else if (e.kind === 'damage' && e.requires === 'oneHandedMelee' && meleeOneHanded) {
      damage.push(
        at(
          'damage',
          e.amount,
          alone
            ? {}
            : {
                status: 'conditional',
                when: 'only while this is the one weapon you hold',
              },
        ),
      )
    } else if (
      e.kind === 'damage' &&
      e.requires === 'thrownRanged' &&
      codes.includes('T')
    ) {
      damage.push(
        at('damage', e.amount, {
          status: 'conditional',
          when: 'on a hit with a ranged attack with it thrown',
        }),
      )
    } else if (
      e.kind === 'offhandDamage' &&
      ctx.weaponCount >= 2 &&
      weapon.melee &&
      (e.requires === 'light' ? codes.includes('L') : meleeOneHanded)
    ) {
      damage.push(
        at('damage', mod, {
          status: 'conditional',
          when: 'on the second weapon of two-weapon fighting, if not already added',
        }),
      )
    } else if (
      e.kind === 'note' &&
      weapon.melee &&
      (codes.includes('2H') || codes.includes('V'))
    ) {
      notes.push(`${style.label}: ${e.text}`)
    }
  }
  if (codes.includes('H')) {
    notes.push(
      'Heavy: a Small or Tiny creature has disadvantage on attack rolls with it.',
    )
  }

  const versatile = weapon.versatile
  if (versatile) {
    // Two hands: the style bonus of one-handed fighting no longer holds.
    twoHandedExtra.push(...damage.filter((l) => !l.id.includes('|damage|Dueling')))
  }
  const rangeText = weapon.range
    ? `${weapon.range.normal}${weapon.range.long ? `/${weapon.range.long}` : ''} ft`
    : undefined
  const flags = ctx.armorFlags.map((l) => ({ ...l, id: `${id}|${l.id}` }))
  // A mastery property is usable only for a kind of weapon picked for a weapon mastery.
  const masterySource = ctx.mastered.get(held.baseName.toLowerCase())
  const mastery = masterySource ? weapon.mastery[0] : undefined
  const masteryLines: Line[] =
    mastery && masterySource
      ? [
          {
            id: `${id}|mastery|${mastery.name}`,
            label: `Mastery: ${mastery.name}`,
            source: masterySource,
            op: 'note',
            status: 'applied',
            how: mastery.rule,
          },
        ]
      : []

  return {
    id,
    name: held.item.name,
    count: Math.max(1, held.stack.quantity),
    toHit: quantity([...toHit, ...masteryLines, ...flags]),
    damage: {
      dice: dieOf(weapon.damage?.text) ?? '-',
      types: weapon.damageTypes.map((t) => t.toLowerCase()).join(' or '),
      bonus: quantity(damage),
    },
    twoHanded: versatile
      ? { dice: dieOf(versatile.text) ?? versatile.text, bonus: quantity(twoHandedExtra) }
      : undefined,
    range: rangeText,
    properties: weapon.properties,
    mastery,
    notes,
  }
}

/** The unarmed strike: always proficient; a Monk's die and an Unarmed Fighting style raise it. */
function unarmedRow(ctx: Context): AttackRow {
  const id = 'attack|unarmed'
  const str = abilityMod(ctx.totals.str)
  const dex = abilityMod(ctx.totals.dex)
  // Martial Arts is off while the monk wears armor or wields a shield.
  const monk = ctx.martialArts && !ctx.martialArts.armor ? ctx.martialArts : undefined
  const monkFaces = monk?.faces
  const empty = ctx.weaponCount === 0 && !ctx.shield
  const style = ctx.styles.find((s) => s.style.effect.kind === 'unarmed')
  const styleFaces =
    style?.style.effect.kind === 'unarmed'
      ? empty
        ? style.style.effect.emptyHandsFaces
        : style.style.effect.faces
      : undefined
  const faces = Math.max(monkFaces ?? 0, styleFaces ?? 0)
  const key: AbilityKey = monk && dex > str ? 'dex' : 'str'
  const why = monk
    ? `Martial Arts: the higher of Strength ${formatMod(str)} and Dexterity ${formatMod(dex)}`
    : 'Unarmed strike: Strength'
  const mod = key === 'dex' ? dex : str
  const ability = (suffix: string) =>
    lineOf(`${id}|${suffix}|ability`, ABILITY_NAMES[key], BASE_SOURCE, mod, { how: why })
  const flags = ctx.armorFlags.map((l) => ({ ...l, id: `${id}|${l.id}` }))
  const source = monkFaces
    ? ({ kind: 'class', tag: 'class:Monk', label: 'Monk' } satisfies SourceRef)
    : style?.source
  return {
    id,
    name: 'Unarmed strike',
    count: 1,
    toHit: quantity([
      ability('hit'),
      lineOf(`${id}|hit|prof`, 'Proficiency bonus', BASE_SOURCE, ctx.prof, {
        how: 'You are always proficient with an unarmed strike',
      }),
      ...flags,
    ]),
    damage: {
      dice: faces > 0 ? `1d${faces}` : '',
      types: 'bludgeoning',
      bonus: quantity([
        ...(faces > 0
          ? []
          : [
              lineOf(`${id}|damage|base`, 'Unarmed strike', BASE_SOURCE, 1, {
                op: 'base',
                how: 'An unarmed strike deals 1 bludgeoning damage',
              }),
            ]),
        ability('damage'),
      ]),
    },
    properties: [],
    notes: [
      ...(source && faces > 0 ? [`${source.label}: the damage die is d${faces}.`] : []),
      ...(ctx.martialArts?.armor
        ? [
            `${MARTIAL_ARTS}: not while you wear armor or wield a shield (${ctx.martialArts.armor}).`,
          ]
        : []),
    ],
  }
}

export function attackRows(
  sources: Sources,
  totals: AbilityTotals,
  prof: number,
  proficiencies: Proficiencies,
  acLines: readonly Line[],
): AttackRow[] {
  const weapons = sources.items.filter((i) => i.item.kind === 'weapon' && i.item.weapon)
  const ctx: Context = {
    sources,
    totals,
    prof,
    proficiencies,
    armorFlags: acLines.filter(
      (l) => l.id.endsWith('-proficiency') && l.status === 'flag',
    ),
    styles: stylesHeld(sources),
    weaponCount: weapons.reduce((n, w) => n + Math.max(1, w.stack.quantity), 0),
    shield: sources.items.some((i) => i.item.armor?.class === 'shield'),
    mastered: masteredKinds(sources),
    effects: heldOptionEffects(sources),
    martialArts: martialArtsOf(sources),
  }
  return [...weapons.flatMap((w) => weaponRow(w, ctx) ?? []), unarmedRow(ctx)]
}
