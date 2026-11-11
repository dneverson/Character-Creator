// Attacks: one row for each equipped weapon and one for the unarmed strike, each with
// the attack bonus and the damage as lines (the ability used and why, proficiency, the
// magic bonus, a fighting style). A bonus that holds only in some way of fighting is shown
// beside the number, not added to it. A weapon the character is not proficient with loses
// the proficiency bonus and says so; nothing is ever refused.

import { ABILITY_NAMES, abilityMod, formatMod, type AbilityKey } from '../dice/dice'
import type { ItemMastery, ItemProperty } from '../data/items'
import { FIGHTING_STYLES, type FightingStyle } from '../rules/fightingStyles'
import type { AbilityTotals } from './armorClass'
import { classTableDie } from './classTable'
import { itemBonus } from './itemBonus'
import { weaponProficiency, type Proficiencies } from './proficiencies'
import { heldBy, type HeldItem, type Sources } from './sources'
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
  masteryApplies: boolean
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
  const { key, why } = weaponAbility(held, ctx.totals)
  const mod = abilityMod(ctx.totals[key])
  const codes = weapon.properties.map((p) => p.code)
  const id = `attack|${held.item.key}`
  const ability = (suffix: string) =>
    lineOf(`${id}|${suffix}|ability`, ABILITY_NAMES[key], BASE_SOURCE, mod, { how: why })
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
  const proficient = weaponProficiency(ctx.proficiencies, held)
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
  toHit.push(...magic('hit', ['bonusWeapon', 'bonusWeaponAttack']))

  const damage: Line[] = [
    ability('damage'),
    ...magic('damage', ['bonusWeapon', 'bonusWeaponDamage']),
  ]
  const notes: string[] = []
  const twoHandedExtra: Line[] = []

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

  return {
    id,
    name: held.item.name,
    count: Math.max(1, held.stack.quantity),
    toHit: quantity([...toHit, ...flags]),
    damage: {
      dice: weapon.damage?.text ?? '-',
      types: weapon.damageTypes.map((t) => t.toLowerCase()).join(' or '),
      bonus: quantity(damage),
    },
    twoHanded: versatile
      ? { dice: versatile.text, bonus: quantity(twoHandedExtra) }
      : undefined,
    range: rangeText,
    properties: weapon.properties,
    mastery:
      ctx.masteryApplies && weapon.mastery.length > 0 ? weapon.mastery[0] : undefined,
    notes,
  }
}

/** The unarmed strike: always proficient; a Monk's die and an Unarmed Fighting style raise it. */
function unarmedRow(ctx: Context): AttackRow {
  const id = 'attack|unarmed'
  const str = abilityMod(ctx.totals.str)
  const dex = abilityMod(ctx.totals.dex)
  const monk = ctx.sources.classes.find((c) => c.row.name === 'Monk' && c.loaded)
  const monkFaces =
    monk?.loaded && monk.level > 0
      ? classTableDie(monk.loaded.entry, MARTIAL_ARTS, monk.level)
      : undefined
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
    notes: source && faces > 0 ? [`${source.label}: the damage die is d${faces}.`] : [],
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
    masteryApplies:
      sources.classes.length === 0 ||
      sources.classes.some((c) => c.loaded?.entry.edition === 'one'),
  }
  return [...weapons.flatMap((w) => weaponRow(w, ctx) ?? []), unarmedRow(ctx)]
}
