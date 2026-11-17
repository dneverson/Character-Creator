// The effects of the class options the character holds (rules/optionEffects.ts) as lines
// of the numbers they change: the attacks with the pact weapon or the infused item, the
// armor class and the spell attacks while the infused item is worn or held, the walking
// speed, initiative, the checks and saving throws given advantage, and on the option's own
// row of the Features & Traits tab what it adds and to what (Agonizing Blast's Charisma
// modifier to the cantrip, a maneuver's superiority die). The item an effect is on is the
// one picked on the option's card (the pact weapon, the infused item).

import { ABILITY_NAMES, abilityMod, type AbilityKey } from '../dice/dice'
import {
  OPTION_EFFECTS,
  SUPERIORITY_DICE,
  SUPERIORITY_TYPES,
  stepAt,
  type EffectItem,
  type OptionEffect,
  type OptionEffectRule,
} from '../rules/optionEffects'
import { EFFECT_ITEM_PICKS } from '../rules/optionEffects'
import type { ClassOption } from '../data/classOptions'
import type { AbilityTotals } from './armorClass'
import { PICK_MARK } from './featurePicks'
import { itemBonus } from './itemBonus'
import { heldBy, type HeldItem, type Sources } from './sources'
import type { Line, SourceRef } from './types'

/** An effect of an option the character holds. */
export interface HeldEffect {
  rule: OptionEffectRule
  effect: OptionEffect
  /** The option, as a line's source. */
  source: SourceRef
  /** The option's key: "Enhanced Weapon|TCE". */
  key: string
  /** The level of the class (or the character, for a feat) that took the option. */
  level: number
}

const keyOf = (rule: OptionEffectRule) =>
  'option' in rule.holder ? rule.holder.option : ''

/** The level of the class or feat whose slot holds an option. */
function ownerLevel(sources: Sources, key: string): number {
  return (
    sources.optionSlots.find(
      (s) =>
        s.required.includes(key) ||
        (sources.character.classOptions[s.tag] ?? []).includes(key),
    )?.owner.level ?? 0
  )
}

/** Every effect of every option the character holds. */
export function heldOptionEffects(sources: Sources): HeldEffect[] {
  return OPTION_EFFECTS.flatMap((rule) => {
    const held = heldBy(sources, rule.holder)
    if (!held) return []
    const key = keyOf(rule)
    const level = ownerLevel(sources, key)
    return rule.effects.map((effect) => ({
      rule,
      effect,
      source: { ...held.source, label: rule.label },
      key,
      level,
    }))
  })
}

/** The picked items an effect is on, by their key in lower case. */
export function effectItems(sources: Sources, key: string, item: EffectItem): string[] {
  const rows =
    item === 'pact'
      ? EFFECT_ITEM_PICKS.filter((r) => r.title === 'Pact weapon')
      : EFFECT_ITEM_PICKS.filter((r) => r.option === key)
  return rows.flatMap((r) =>
    sources.options.has(r.option)
      ? (sources.character.classOptions[`option:${r.option}${PICK_MARK}${r.title}`] ?? [])
      : [],
  )
}

const isOn = (sources: Sources, h: HeldEffect, held: HeldItem) =>
  'item' in h.effect &&
  effectItems(sources, h.key, h.effect.item).includes(held.item.key.toLowerCase())

/** Why an effect of an item is not in force: attunement it needs, not made. */
const notAttuned = (h: HeldEffect, held: HeldItem) =>
  h.rule.attune && held.stack.attuned !== true
    ? 'The infused item needs attunement, and you are not attuned.'
    : undefined

const line = (
  id: string,
  h: HeldEffect,
  amount: number | undefined,
  extra: Partial<Line> = {},
): Line => ({
  id: `${id}|option|${h.key}`,
  label: h.rule.label,
  source: h.source,
  ...(amount === undefined ? { op: 'note' as const } : { op: 'add' as const, amount }),
  status: 'applied',
  text: h.rule.text,
  ...extra,
})

/** What the options add to the attacks with one weapon. */
export interface WeaponEffects {
  hit: Line[]
  damage: Line[]
  notes: string[]
  /** An option makes the character proficient with it (Pact of the Blade). */
  proficient?: SourceRef
  /** An ability the attacks may use instead (Charisma for a 2024 pact weapon). */
  ability?: { key: AbilityKey; source: SourceRef; label: string }
}

export function weaponEffects(
  sources: Sources,
  held: HeldItem,
  totals: AbilityTotals,
  effects: readonly HeldEffect[],
): WeaponEffects {
  const out: WeaponEffects = { hit: [], damage: [], notes: [] }
  const id = `attack|${held.item.key}`
  const melee = held.item.weapon?.melee ?? true
  for (const h of effects) {
    if (!isOn(sources, h, held)) continue
    const e = h.effect
    const why = notAttuned(h, held)
    const off: Partial<Line> = why ? { status: 'inactive', why } : {}
    if (e.kind === 'weaponBonus') {
      const amount = stepAt(e.steps, h.level)
      const magic =
        e.unlessMagic &&
        ['bonusWeapon', 'bonusWeaponAttack', 'bonusWeaponDamage'].some(
          (f) =>
            itemBonus(
              held.item,
              f as 'bonusWeapon' | 'bonusWeaponAttack' | 'bonusWeaponDamage',
            ) !== 0,
        )
      const state: Partial<Line> = magic
        ? {
            status: 'inactive',
            why: 'The weapon already has a magic bonus to those rolls.',
          }
        : e.ranged && melee
          ? { status: 'conditional', when: 'only when it makes a ranged attack' }
          : off
      out.hit.push(line(`${id}|hit`, h, amount, state))
      out.damage.push(line(`${id}|damage`, h, amount, state))
    } else if (e.kind === 'weaponAbilityDamage') {
      const amount = Math.max(e.min, abilityMod(totals[e.ability]))
      out.damage.push(
        line(`${id}|damage`, h, amount, {
          how: `${e.damageType} damage: your ${ABILITY_NAMES[e.ability]} modifier, at least ${e.min}`,
          ...off,
        }),
      )
    } else if (e.kind === 'weaponNote') {
      out.notes.push(`${h.rule.label}: ${e.text}`)
    } else if (e.kind === 'weaponProficiency') {
      out.proficient = h.source
    } else if (e.kind === 'weaponAbility') {
      out.ability = { key: e.ability, source: h.source, label: h.rule.label }
    }
  }
  return out
}

/** The infusions' bonuses to the armor class of the armor and the shield that count. */
export function acEffectLines(
  sources: Sources,
  effects: readonly HeldEffect[],
  counted: readonly (HeldItem | undefined)[],
): Line[] {
  return effects.flatMap((h): Line[] => {
    if (h.effect.kind !== 'acBonus') return []
    const steps = h.effect.steps
    return sources.items.flatMap((held): Line[] => {
      if (!isOn(sources, h, held)) return []
      const why =
        notAttuned(h, held) ??
        (counted.includes(held) ? undefined : 'Not the armor or shield that counts.')
      return [
        line(`ac|${held.item.key}`, h, stepAt(steps, h.level), {
          how: `Infused into ${held.item.name}`,
          ...(why ? { status: 'inactive', why } : {}),
        }),
      ]
    })
  })
}

/** The infusions' bonuses to spell attack rolls while the infused item is held. */
export function spellAttackEffectLines(
  sources: Sources,
  effects: readonly HeldEffect[],
  id: string,
): Line[] {
  return effects.flatMap((h): Line[] => {
    if (h.effect.kind !== 'spellAttack') return []
    const steps = h.effect.steps
    return sources.items.flatMap((held): Line[] => {
      if (!isOn(sources, h, held)) return []
      const why = notAttuned(h, held)
      return [
        line(`${id}|${held.item.key}`, h, stepAt(steps, h.level), {
          how: `While holding ${held.item.name}`,
          ...(why ? { status: 'inactive', why } : {}),
        }),
      ]
    })
  })
}

/** The feet the infused armor adds to the walking speed while worn. */
export function speedEffectLines(
  sources: Sources,
  effects: readonly HeldEffect[],
): Line[] {
  return effects.flatMap((h): Line[] => {
    if (h.effect.kind !== 'speed') return []
    const amount = h.effect.amount
    return sources.items.flatMap((held): Line[] => {
      if (!isOn(sources, h, held) || !held.stack.equipped) return []
      const why = notAttuned(h, held)
      return [
        line(`speed|${held.item.key}`, h, amount, {
          how: `While wearing ${held.item.name}`,
          ...(why ? { status: 'inactive', why } : {}),
        }),
      ]
    })
  })
}

/** Advantage on initiative while the infused item is worn: shown, not a number. */
export function initiativeEffectLines(
  sources: Sources,
  effects: readonly HeldEffect[],
): Line[] {
  return effects.flatMap((h): Line[] => {
    if (h.effect.kind !== 'initiativeAdvantage') return []
    return sources.items.flatMap((held): Line[] => {
      if (!isOn(sources, h, held) || !held.stack.equipped) return []
      const why = notAttuned(h, held)
      return [
        line(`initiative|${held.item.key}`, h, undefined, {
          how: `Advantage on the roll, while wearing ${held.item.name}`,
          ...(why
            ? { status: 'inactive', why }
            : { status: 'conditional', when: 'on the roll' }),
        }),
      ]
    })
  })
}

/** Advantage on the checks of a skill: a note beside the modifier. */
export function checkEffectLines(
  effects: readonly HeldEffect[],
  skill: string,
  id: string,
): Line[] {
  return effects.flatMap((h): Line[] =>
    h.effect.kind === 'checkAdvantage' && h.effect.skills.includes(skill)
      ? [
          line(id, h, undefined, {
            how: 'Advantage on the check',
            ...(h.rule.carried
              ? { status: 'conditional', when: 'while you wear or carry the rune' }
              : {}),
          }),
        ]
      : [],
  )
}

/** Advantage on the saving throws of an ability in a case: a note beside the bonus. */
export function saveEffectLines(
  effects: readonly HeldEffect[],
  ability: AbilityKey,
  id: string,
): Line[] {
  return effects.flatMap((h): Line[] =>
    h.effect.kind === 'saveAdvantage' && h.effect.ability === ability
      ? [
          line(id, h, undefined, {
            how: 'Advantage on the saving throw',
            status: 'conditional',
            when: h.effect.when,
          }),
        ]
      : [],
  )
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())
const spellName = (key: string) => titleCase(key.split('|')[0])

/** The words for the item an effect is on, and the flag when none is picked. */
function itemWords(sources: Sources, h: HeldEffect, item: EffectItem) {
  const picked = effectItems(sources, h.key, item)
  const names = picked.map((k) => {
    const held = sources.items.find((i) => i.item.key.toLowerCase() === k)
    return held ? held.item.name : titleCase(k.split('|')[0])
  })
  return names.length > 0
    ? { how: `On ${names.join(', ')}` }
    : {
        status: 'flag' as const,
        why:
          item === 'pact'
            ? 'No pact weapon picked: pick it on its card in Class Features to see this on its attacks.'
            : 'No item picked: pick the infused item on its card in Class Features to see this on its numbers.',
      }
}

/** What an option does to one spell: its key, the number it adds, and what that is. */
interface SpellPart {
  spell: string
  amount?: number
  /** The value of the spell it changes; none for a rider on a hit. */
  on?: 'damage' | 'range'
  /** The new range in feet, when the option sets it instead of adding to it. */
  set?: number
  /** In words, for the spell named: a spell's name, or "this spell" on the spell's own row. */
  how: (subject: string) => string
}

const isSpellEffect = (e: OptionEffect) =>
  e.kind === 'spellDamage' ||
  e.kind === 'spellDamagePick' ||
  e.kind === 'spellRange' ||
  e.kind === 'spellRangePick' ||
  e.kind === 'spellNote' ||
  e.kind === 'spellNotePick'

/** The picked spell keys of an option's card. */
const pickedSpells = (sources: Sources, h: HeldEffect, pick: string) =>
  sources.character.classOptions[`option:${h.key}${PICK_MARK}${pick}`] ?? []

/**
 * What an effect that changes a spell's damage or range does, once per spell it is on:
 * an empty list when it is on the spells picked and none is. Not a spell effect: undefined.
 */
function spellParts(
  sources: Sources,
  h: HeldEffect,
  totals: AbilityTotals,
): SpellPart[] | undefined {
  const e = h.effect
  if (e.kind === 'spellDamage' || e.kind === 'spellDamagePick') {
    const amount = abilityMod(totals[e.ability])
    const spells = e.kind === 'spellDamage' ? e.spells : pickedSpells(sources, h, e.pick)
    return spells.map((spell) => ({
      spell,
      amount,
      on: 'damage',
      how: (subject) =>
        `${ABILITY_NAMES[e.ability]} modifier to the damage of ${subject}`,
    }))
  }
  if (e.kind === 'spellRange') {
    return e.spells.map((spell) => ({
      spell,
      on: 'range',
      set: e.feet,
      how: (subject) => `Range of ${subject} is ${e.feet} feet`,
    }))
  }
  if (e.kind === 'spellRangePick') {
    const feet = e.perLevel * h.level
    return pickedSpells(sources, h, e.pick).map((spell) => ({
      spell,
      amount: feet,
      on: 'range',
      how: (subject) =>
        `feet added to the range of ${subject} (${e.perLevel} feet times ${h.level} class levels)`,
    }))
  }
  if (e.kind === 'spellNote' || e.kind === 'spellNotePick') {
    const spells = e.kind === 'spellNote' ? e.spells : pickedSpells(sources, h, e.pick)
    return spells.map((spell) => ({
      spell,
      how: (subject) =>
        subject === 'this spell' ? e.text : `${e.text}, with ${subject}`,
    }))
  }
  return undefined
}

/**
 * What the options the character holds do to each spell, by the spell's key ("eldritch
 * blast|phb"), as lines for that spell's own row and detail: the one place the effect table
 * names a spell or a pick, read here for the spell and for the option's row alike.
 */
export function spellEffectLines(
  sources: Sources,
  effects: readonly HeldEffect[],
  totals: AbilityTotals,
): Record<string, Line[]> {
  const out: Record<string, Line[]> = {}
  for (const h of effects) {
    const parts = spellParts(sources, h, totals) ?? []
    for (const [i, p] of parts.entries()) {
      const spell = out[p.spell] ?? []
      spell.push(
        line(`spell|${p.spell}|${h.key}|${i}`, h, p.set ?? p.amount, {
          how: p.how('this spell'),
          ...(p.on ? { on: p.on } : {}),
          ...(p.set === undefined ? {} : { op: 'base' as const }),
        }),
      )
      out[p.spell] = spell
    }
  }
  return out
}

/** What one effect does, as a line of the option's row. */
function summaryLine(
  sources: Sources,
  h: HeldEffect,
  totals: AbilityTotals,
  index: number,
): Line[] {
  const e = h.effect
  const id = `feature|${h.key}|${index}`
  if (isSpellEffect(e)) {
    const parts = spellParts(sources, h, totals) ?? []
    return parts.length === 0
      ? [
          line(id, h, undefined, {
            status: 'flag',
            why: 'No cantrip picked: pick it on its card in Class Features.',
          }),
        ]
      : parts.map((p, i) =>
          line(`${id}|${i}`, h, p.amount, { how: p.how(spellName(p.spell)) }),
        )
  }
  if (e.kind === 'checkAdvantage') {
    return [
      line(id, h, undefined, {
        how: `Advantage on ${e.skills.map(titleCase).join(' and ')} checks, shown on those skills`,
      }),
    ]
  }
  if (e.kind === 'saveAdvantage') {
    return [
      line(id, h, undefined, {
        how: `Advantage on ${ABILITY_NAMES[e.ability]} saving throws ${e.when}, shown on that saving throw`,
      }),
    ]
  }
  const words = itemWords(sources, h, e.item)
  const what: Record<typeof e.kind, string> = {
    weaponBonus: 'to attack and damage rolls, on its attack row',
    weaponAbilityDamage: 'extra damage, on its attack row',
    weaponNote: 'a note on its attack row',
    weaponProficiency: 'proficiency, on its attack row',
    weaponAbility: 'its ability for attack and damage, on its attack row',
    acBonus: 'to armor class while it counts',
    spellAttack: 'to spell attack rolls while held',
    speed: 'feet of walking speed while worn',
    initiativeAdvantage: 'advantage on initiative while worn',
  }
  const amount =
    e.kind === 'weaponBonus' || e.kind === 'acBonus' || e.kind === 'spellAttack'
      ? stepAt(e.steps, h.level)
      : e.kind === 'speed'
        ? e.amount
        : e.kind === 'weaponAbilityDamage'
          ? Math.max(e.min, abilityMod(totals[e.ability]))
          : undefined
  const how = 'how' in words ? `${words.how}: ${what[e.kind]}` : what[e.kind]
  return [line(id, h, amount, { ...words, how })]
}

/** The superiority dice a maneuver can be fuelled with, one line per source of dice. */
function superiorityLines(sources: Sources, key: string): Line[] {
  return SUPERIORITY_DICE.flatMap((row): Line[] => {
    const held = heldBy(sources, row.holder)
    if (!held) return []
    const level = held.classLevel ?? 1
    const faces = stepAt(row.steps, level)
    return [
      {
        id: `feature|${key}|superiority|${held.source.tag}|${row.label}`,
        label: 'Superiority die',
        source: { ...held.source, label: row.label },
        op: 'note',
        status: 'applied',
        how: `d${faces}${held.classLevel ? `, at ${held.source.label.split(',')[0]} level ${level}` : ''}`,
      },
    ]
  })
}

/** The lines of an option's own row: what each of its effects adds, and to what. */
export function optionRowLines(
  sources: Sources,
  option: ClassOption,
  totals: AbilityTotals,
  effects: readonly HeldEffect[],
): Line[] {
  const own = effects.filter((h) => h.key === option.key)
  return [
    ...own.flatMap((h, i) => summaryLine(sources, h, totals, i)),
    ...(option.types.some((t) => SUPERIORITY_TYPES.includes(t))
      ? superiorityLines(sources, option.key)
      : []),
  ]
}
