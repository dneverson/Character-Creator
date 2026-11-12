// What each fighting style does to an attack. The 2014 styles are optional features of
// a class and the 2024 styles are feats of the Fighting Style category; both are listed
// here by their data identity. A style that raises an attack or damage roll is a number
// the attack rows apply; one that is a reaction or a cantrip grant is listed with where it
// is handled, so the audit in fightingStyles.test.ts can tell a style that is covered
// from one a book added.

import { holderId, type Holder } from './holder'

export type StyleEffect =
  /** A bonus to the attack roll with a weapon of this kind. */
  | { kind: 'attack'; amount: number; requires: 'ranged' }
  /** A bonus to the damage roll, when the weapon is used in the way named. */
  | { kind: 'damage'; amount: number; requires: 'oneHandedMelee' | 'thrownRanged' }
  /** The ability modifier is added to the damage of the second weapon's attack. */
  | { kind: 'offhandDamage'; requires: 'light' | 'oneHandedMelee' }
  /** Unarmed strikes deal this die, one larger with empty hands. */
  | { kind: 'unarmed'; faces: number; emptyHandsFaces: number }
  /** A rule the sheet shows with the attack, not a number (a reroll). */
  | { kind: 'note'; text: string; requires: 'twoHanded' }
  /** Handled in another number or by a reaction; `reason` says where. */
  | { kind: 'elsewhere'; reason: string }

export interface FightingStyle {
  holder: Holder
  label: string
  text: string
  effect: StyleEffect
}

const option = (name: string, source: string): Holder => ({ option: `${name}|${source}` })
const feat = (name: string, source: string): Holder => ({ feat: `${name}|${source}` })

const ARMOR_CLASS = { kind: 'elsewhere', reason: 'armor class' } as const
const REACTION = { kind: 'elsewhere', reason: 'a reaction in play' } as const
const CANTRIPS = { kind: 'elsewhere', reason: 'cantrips, in the spell grants' } as const
const SENSE = { kind: 'elsewhere', reason: 'senses' } as const

export const FIGHTING_STYLES: readonly FightingStyle[] = [
  // ---- 2014: optional features -------------------------------------------------
  {
    holder: option('Archery', 'PHB'),
    label: 'Archery',
    text: 'Archery: you gain a +2 bonus to attack rolls you make with ranged weapons.',
    effect: { kind: 'attack', amount: 2, requires: 'ranged' },
  },
  {
    holder: option('Dueling', 'PHB'),
    label: 'Dueling',
    text: 'Dueling: when you wield a melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with it.',
    effect: { kind: 'damage', amount: 2, requires: 'oneHandedMelee' },
  },
  {
    holder: option('Great Weapon Fighting', 'PHB'),
    label: 'Great Weapon Fighting',
    text: 'Great Weapon Fighting: when you roll a 1 or 2 on a damage die with a two-handed or versatile melee weapon held in both hands, you can reroll the die and must use the new roll.',
    effect: {
      kind: 'note',
      text: 'Roll a 1 or 2 on a damage die: reroll it and keep the new roll.',
      requires: 'twoHanded',
    },
  },
  {
    holder: option('Two-Weapon Fighting', 'PHB'),
    label: 'Two-Weapon Fighting',
    text: 'Two-Weapon Fighting: when you engage in two-weapon fighting, you can add your ability modifier to the damage of the second attack.',
    effect: { kind: 'offhandDamage', requires: 'oneHandedMelee' },
  },
  {
    holder: option('Thrown Weapon Fighting', 'TCE'),
    label: 'Thrown Weapon Fighting',
    text: 'Thrown Weapon Fighting: when you hit with a ranged attack using a thrown weapon, you gain a +2 bonus to the damage roll.',
    effect: { kind: 'damage', amount: 2, requires: 'thrownRanged' },
  },
  {
    holder: option('Unarmed Fighting', 'TCE'),
    label: 'Unarmed Fighting',
    text: 'Unarmed Fighting: your unarmed strikes deal 1d6 + Strength modifier bludgeoning damage; the d6 becomes a d8 when you hold no weapon or shield.',
    effect: { kind: 'unarmed', faces: 6, emptyHandsFaces: 8 },
  },
  {
    holder: option('Defense', 'PHB'),
    label: 'Defense',
    text: 'Defense',
    effect: ARMOR_CLASS,
  },
  {
    holder: option('Blessed Warrior', 'TCE'),
    label: 'Blessed Warrior',
    text: 'Blessed Warrior',
    effect: CANTRIPS,
  },
  {
    holder: option('Blind Fighting', 'TCE'),
    label: 'Blind Fighting',
    text: 'Blind Fighting',
    effect: SENSE,
  },
  {
    holder: option('Druidic Warrior', 'TCE'),
    label: 'Druidic Warrior',
    text: 'Druidic Warrior',
    effect: CANTRIPS,
  },
  {
    holder: option('Interception', 'TCE'),
    label: 'Interception',
    text: 'Interception',
    effect: REACTION,
  },
  {
    holder: option('Protection', 'PHB'),
    label: 'Protection',
    text: 'Protection',
    effect: REACTION,
  },
  {
    holder: option('Superior Technique', 'TCE'),
    label: 'Superior Technique',
    text: 'Superior Technique',
    effect: { kind: 'elsewhere', reason: 'a maneuver and a superiority die, in play' },
  },

  // ---- 2024: feats of the Fighting Style category --------------------------------
  {
    holder: feat('Archery', 'XPHB'),
    label: 'Archery',
    text: 'Archery: you gain a +2 bonus to attack rolls you make with ranged weapons.',
    effect: { kind: 'attack', amount: 2, requires: 'ranged' },
  },
  {
    holder: feat('Dueling', 'XPHB'),
    label: 'Dueling',
    text: "Dueling: when you're holding a melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.",
    effect: { kind: 'damage', amount: 2, requires: 'oneHandedMelee' },
  },
  {
    holder: feat('Great Weapon Fighting', 'XPHB'),
    label: 'Great Weapon Fighting',
    text: 'Great Weapon Fighting: when you roll damage for a melee attack with a weapon held in two hands that has the two-handed or versatile property, you can treat any 1 or 2 on a damage die as a 3.',
    effect: {
      kind: 'note',
      text: 'Treat a 1 or 2 on a damage die as a 3.',
      requires: 'twoHanded',
    },
  },
  {
    holder: feat('Two-Weapon Fighting', 'XPHB'),
    label: 'Two-Weapon Fighting',
    text: "Two-Weapon Fighting: when you make an extra attack with a weapon that has the light property, you can add your ability modifier to the damage if you aren't already adding it.",
    effect: { kind: 'offhandDamage', requires: 'light' },
  },
  {
    holder: feat('Thrown Weapon Fighting', 'XPHB'),
    label: 'Thrown Weapon Fighting',
    text: 'Thrown Weapon Fighting: when you hit with a ranged attack using a weapon that has the thrown property, you gain a +2 bonus to the damage roll.',
    effect: { kind: 'damage', amount: 2, requires: 'thrownRanged' },
  },
  {
    holder: feat('Unarmed Fighting', 'XPHB'),
    label: 'Unarmed Fighting',
    text: 'Unarmed Fighting: your unarmed strike deals 1d6 + Strength modifier bludgeoning damage; the d6 becomes a d8 when you hold no weapon or shield.',
    effect: { kind: 'unarmed', faces: 6, emptyHandsFaces: 8 },
  },
  {
    holder: feat('Defense', 'XPHB'),
    label: 'Defense',
    text: 'Defense',
    effect: ARMOR_CLASS,
  },
  {
    holder: feat('Blessed Warrior', 'XPHB'),
    label: 'Blessed Warrior',
    text: 'Blessed Warrior',
    effect: CANTRIPS,
  },
  {
    holder: feat('Blind Fighting', 'XPHB'),
    label: 'Blind Fighting',
    text: 'Blind Fighting',
    effect: SENSE,
  },
  {
    holder: feat('Druidic Warrior', 'XPHB'),
    label: 'Druidic Warrior',
    text: 'Druidic Warrior',
    effect: CANTRIPS,
  },
  {
    holder: feat('Interception', 'XPHB'),
    label: 'Interception',
    text: 'Interception',
    effect: REACTION,
  },
  {
    holder: feat('Protection', 'XPHB'),
    label: 'Protection',
    text: 'Protection',
    effect: REACTION,
  },
  {
    holder: feat('Arcane Warrior', 'AU'),
    label: 'Arcane Warrior',
    text: 'Arcane Warrior',
    effect: CANTRIPS,
  },
  {
    holder: feat('Void Warrior', 'WoW'),
    label: 'Void Warrior',
    text: 'Void Warrior',
    effect: CANTRIPS,
  },
]

export const fightingStyleId = (style: FightingStyle) => holderId(style.holder)

/** What the app does with a style, and what is left to the player in play. */
export function styleApplied(effect: StyleEffect): string {
  switch (effect.kind) {
    case 'attack':
      return `Automatic: +${effect.amount} to the attack roll of your ranged weapon attacks, in your attack rows.`
    case 'damage':
      return effect.requires === 'oneHandedMelee'
        ? `Automatic: +${effect.amount} to the damage of a melee weapon held in one hand with no other weapon, in your attack rows.`
        : `Automatic: +${effect.amount} to the damage of a thrown weapon ranged attack, in your attack rows.`
    case 'offhandDamage':
      return 'Automatic: your ability modifier is added to the damage of the second weapon attack, in your attack rows.'
    case 'unarmed':
      return `Automatic: your unarmed strike attack row deals 1d${effect.faces} (1d${effect.emptyHandsFaces} with no weapon or shield) plus your Strength modifier.`
    case 'note':
      return `You apply it in play: the attack row shows the rule (${effect.text})`
    case 'elsewhere':
      return STYLE_ELSEWHERE[effect.reason] ?? `Handled in ${effect.reason}.`
  }
}

const STYLE_ELSEWHERE: Record<string, string> = {
  'armor class': 'Automatic: +1 to your armor class while you wear armor.',
  'a reaction in play':
    'You apply it in play: it is a reaction, so the sheet only lists it.',
  'cantrips, in the spell grants':
    'Automatic: the cantrips it gives are listed in your spell grants, where you choose them.',
  senses: 'Automatic: the sense it gives is listed with your senses.',
  'a maneuver and a superiority die, in play':
    'You apply it in play: you learn a maneuver and gain a superiority die to spend at the table.',
}

/** The applied note of the style held as this holder id, when the table covers it. */
export function styleAppliedFor(holder: Holder): string | undefined {
  const id = holderId(holder)
  const style = FIGHTING_STYLES.find((s) => fightingStyleId(s) === id)
  return style ? styleApplied(style.effect) : undefined
}
