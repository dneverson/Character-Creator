// What the class options (invocations, infusions, runes, maneuvers) do to the numbers of
// the sheet, which the data gives in text only. Each row names its option and says what
// it adds and where: to the damage of a cantrip, to the attacks with the pact weapon or
// the infused item, to the armor class or the spell attacks while the infused item is
// worn, advantage on some checks or saving throws. The other rules tables carry the rest
// (senses, speeds, limited uses, fighting styles), and the data carries the spells and
// skills an option gives. The audit in optionEffects.test.ts holds every option of the
// books to one of them, to the play text, or to an excuse with a reason.

import type { AbilityKey } from '../dice/dice'
import type { Holder } from './holder'

/** The item an effect is on: the pact weapon, or the item the infusion is put into. */
export type EffectItem = 'pact' | 'infused'

/** An amount by the level of the class that took the option: `[from level, amount]`. */
export type Steps = readonly (readonly [number, number])[]

export type OptionEffect =
  /** An ability modifier added to the damage of named spells ("eldritch blast|phb"). */
  | { kind: 'spellDamage'; ability: AbilityKey; spells: readonly string[] }
  /** An ability modifier added to the damage of the spells picked on the option's card. */
  | { kind: 'spellDamagePick'; ability: AbilityKey; pick: string }
  /**
   * A new range for named spells (Eldritch Spear 2014: "its range is 300 feet"), or the
   * range of the spells picked on the option's card increased by `perLevel` feet for each
   * level in the owning class (Eldritch Spear 2024).
   */
  | { kind: 'spellRange'; spells: readonly string[]; feet: number }
  | { kind: 'spellRangePick'; pick: string; perLevel: number }
  /** A bonus to the attack and damage rolls with the item. */
  | {
      kind: 'weaponBonus'
      item: EffectItem
      steps: Steps
      /** Only when it makes a ranged attack (Repeating Shot). */
      ranged?: true
      /** Not on a magic weapon with a bonus of its own (Improved Pact Weapon). */
      unlessMagic?: true
    }
  /** Extra damage of another type equal to an ability modifier, at least `min`. */
  | {
      kind: 'weaponAbilityDamage'
      item: EffectItem
      ability: AbilityKey
      min: number
      damageType: string
    }
  /** A rule that goes with the attacks with the item and is not a number. */
  | { kind: 'weaponNote'; item: EffectItem; text: string }
  /** The attack and damage rolls with the item may use this ability instead. */
  | { kind: 'weaponAbility'; item: EffectItem; ability: AbilityKey }
  /** Proficiency with the item. */
  | { kind: 'weaponProficiency'; item: EffectItem }
  /** A bonus to the armor class while the item is worn or wielded. */
  | { kind: 'acBonus'; item: EffectItem; steps: Steps }
  /** A bonus to spell attack rolls while the item is held. */
  | { kind: 'spellAttack'; item: EffectItem; steps: Steps }
  /** Feet added to the walking speed while the item is worn. */
  | { kind: 'speed'; item: EffectItem; amount: number }
  /** Advantage on initiative rolls while the item is worn. */
  | { kind: 'initiativeAdvantage'; item: EffectItem }
  /** Advantage on the checks of these skills. */
  | { kind: 'checkAdvantage'; skills: readonly string[] }
  /** Advantage on the saving throws of an ability, in the case named. */
  | { kind: 'saveAdvantage'; ability: AbilityKey; when: string }

export interface OptionEffectRule {
  holder: Holder
  label: string
  /** The rule in plain words. */
  text: string
  effects: readonly OptionEffect[]
  /** The infused item works only while the wearer is attuned to it. */
  attune?: true
  /** Only while the object inscribed with the rune is worn or carried (a rune). */
  carried?: true
}

const option = (key: string): Holder => ({ option: key })

/** An infusion's bonus: +1, and +2 from 10th level in the class. */
const PLUS_ONE_TO_TWO: Steps = [
  [1, 1],
  [10, 2],
]
const PLUS_ONE: Steps = [[1, 1]]

const THIRSTING_BLADE =
  'you attack twice with it, instead of once, when you take the Attack action on your turn.'

export const OPTION_EFFECTS: readonly OptionEffectRule[] = [
  {
    holder: option('Agonizing Blast|PHB'),
    label: 'Agonizing Blast',
    text: 'Agonizing Blast: when you cast eldritch blast, add your Charisma modifier to the damage it deals on a hit.',
    effects: [{ kind: 'spellDamage', ability: 'cha', spells: ['eldritch blast|phb'] }],
  },
  {
    holder: option('Agonizing Blast|XPHB'),
    label: 'Agonizing Blast',
    text: 'Agonizing Blast: you can add your Charisma modifier to the damage rolls of the Warlock cantrip you chose, one that deals damage.',
    effects: [
      { kind: 'spellDamagePick', ability: 'cha', pick: 'Agonizing Blast cantrip' },
    ],
  },
  {
    holder: option('Eldritch Spear|PHB'),
    label: 'Eldritch Spear',
    text: 'Eldritch Spear: when you cast eldritch blast, its range is 300 feet.',
    effects: [{ kind: 'spellRange', spells: ['eldritch blast|phb'], feet: 300 }],
  },
  {
    holder: option('Eldritch Spear|XPHB'),
    label: 'Eldritch Spear',
    text: 'Eldritch Spear: when you cast the Warlock cantrip you chose, one that deals damage and has a range of 10 feet or more, its range increases by 30 feet for each Warlock level you have.',
    effects: [{ kind: 'spellRangePick', pick: 'Eldritch Spear cantrip', perLevel: 30 }],
  },
  {
    holder: option('Pact of the Blade|PHB'),
    label: 'Pact of the Blade',
    text: 'Pact of the Blade: you are proficient with your pact weapon while you wield it, and it counts as magical for overcoming resistance and immunity to nonmagical attacks and damage.',
    effects: [
      { kind: 'weaponProficiency', item: 'pact' },
      {
        kind: 'weaponNote',
        item: 'pact',
        text: 'it counts as magical for overcoming resistance and immunity to nonmagical attacks and damage.',
      },
    ],
  },
  {
    holder: option('Pact of the Blade|XPHB'),
    label: 'Pact of the Blade',
    text: 'Pact of the Blade: you have proficiency with the bonded weapon, and you can use your Charisma modifier for its attack and damage rolls instead of Strength or Dexterity; it can deal Necrotic, Psychic or Radiant damage or its normal type.',
    effects: [
      { kind: 'weaponProficiency', item: 'pact' },
      { kind: 'weaponAbility', item: 'pact', ability: 'cha' },
      {
        kind: 'weaponNote',
        item: 'pact',
        text: 'it can deal Necrotic, Psychic or Radiant damage instead of its normal type, your choice.',
      },
    ],
  },
  {
    holder: option('Improved Pact Weapon|XGE'),
    label: 'Improved Pact Weapon',
    text: 'Improved Pact Weapon: your pact weapon gains a +1 bonus to its attack and damage rolls, unless it is a magic weapon that already has a bonus to those rolls; it can be a shortbow, longbow, light crossbow or heavy crossbow, and it is a spellcasting focus for your warlock spells.',
    effects: [{ kind: 'weaponBonus', item: 'pact', steps: PLUS_ONE, unlessMagic: true }],
  },
  {
    holder: option('Lifedrinker|PHB'),
    label: 'Lifedrinker',
    text: 'Lifedrinker: when you hit a creature with your pact weapon, it takes extra necrotic damage equal to your Charisma modifier (minimum of 1).',
    effects: [
      {
        kind: 'weaponAbilityDamage',
        item: 'pact',
        ability: 'cha',
        min: 1,
        damageType: 'necrotic',
      },
    ],
  },
  {
    holder: option('Lifedrinker|XPHB'),
    label: 'Lifedrinker',
    text: 'Lifedrinker: once per turn when you hit with your pact weapon, you can deal an extra 1d6 Necrotic, Psychic or Radiant damage, and spend a Hit Point Die to regain hit points.',
    effects: [
      {
        kind: 'weaponNote',
        item: 'pact',
        text: 'once per turn on a hit, an extra 1d6 Necrotic, Psychic or Radiant damage (your choice); you can spend a Hit Point Die to regain its roll plus your Constitution modifier in hit points.',
      },
    ],
  },
  {
    holder: option('Thirsting Blade|PHB'),
    label: 'Thirsting Blade',
    text: `Thirsting Blade: ${THIRSTING_BLADE}`,
    effects: [{ kind: 'weaponNote', item: 'pact', text: THIRSTING_BLADE }],
  },
  {
    holder: option('Thirsting Blade|XPHB'),
    label: 'Thirsting Blade',
    text: 'Thirsting Blade: you gain the Extra Attack feature for your pact weapon only.',
    effects: [
      {
        kind: 'weaponNote',
        item: 'pact',
        text: `Extra Attack for this weapon only: ${THIRSTING_BLADE}`,
      },
    ],
  },
  {
    holder: option('Eldritch Mind|TCE'),
    label: 'Eldritch Mind',
    text: 'Eldritch Mind: you have advantage on Constitution saving throws that you make to maintain your concentration on a spell.',
    effects: [
      { kind: 'saveAdvantage', ability: 'con', when: 'to maintain concentration' },
    ],
  },
  {
    holder: option('Eldritch Mind|XPHB'),
    label: 'Eldritch Mind',
    text: 'Eldritch Mind: you have Advantage on Constitution saving throws that you make to maintain Concentration.',
    effects: [
      { kind: 'saveAdvantage', ability: 'con', when: 'to maintain concentration' },
    ],
  },
  {
    holder: option('Enhanced Defense|TCE'),
    label: 'Enhanced Defense',
    text: 'Enhanced Defense: a creature gains a +1 bonus to Armor Class while wearing (armor) or wielding (shield) the infused item; +2 from 10th level in the class.',
    effects: [{ kind: 'acBonus', item: 'infused', steps: PLUS_ONE_TO_TWO }],
  },
  {
    holder: option('Repulsion Shield|TCE'),
    label: 'Repulsion Shield',
    text: 'Repulsion Shield: a creature gains a +1 bonus to Armor Class while wielding this shield.',
    effects: [{ kind: 'acBonus', item: 'infused', steps: PLUS_ONE }],
    attune: true,
  },
  {
    holder: option('Enhanced Weapon|TCE'),
    label: 'Enhanced Weapon',
    text: 'Enhanced Weapon: this magic weapon grants a +1 bonus to attack and damage rolls made with it; +2 from 10th level in the class.',
    effects: [{ kind: 'weaponBonus', item: 'infused', steps: PLUS_ONE_TO_TWO }],
  },
  {
    holder: option('Radiant Weapon|TCE'),
    label: 'Radiant Weapon',
    text: 'Radiant Weapon: this magic weapon grants a +1 bonus to attack and damage rolls made with it.',
    effects: [{ kind: 'weaponBonus', item: 'infused', steps: PLUS_ONE }],
    attune: true,
  },
  {
    holder: option('Returning Weapon|TCE'),
    label: 'Returning Weapon',
    text: "Returning Weapon: this magic weapon grants a +1 bonus to attack and damage rolls made with it, and it returns to the wielder's hand after a ranged attack.",
    effects: [
      { kind: 'weaponBonus', item: 'infused', steps: PLUS_ONE },
      {
        kind: 'weaponNote',
        item: 'infused',
        text: 'it returns to your hand immediately after it is used to make a ranged attack.',
      },
    ],
  },
  {
    holder: option('Repeating Shot|TCE'),
    label: 'Repeating Shot',
    text: 'Repeating Shot: this magic weapon grants a +1 bonus to attack and damage rolls made with it when it is used to make a ranged attack, and it ignores the loading property.',
    effects: [
      { kind: 'weaponBonus', item: 'infused', steps: PLUS_ONE, ranged: true },
      {
        kind: 'weaponNote',
        item: 'infused',
        text: 'it ignores the loading property, and makes its own ammunition when it has none.',
      },
    ],
    attune: true,
  },
  {
    holder: option('Enhanced Arcane Focus|TCE'),
    label: 'Enhanced Arcane Focus',
    text: 'Enhanced Arcane Focus: while holding this item, a creature gains a +1 bonus to spell attack rolls (+2 from 10th level in the class) and ignores half cover when making a spell attack.',
    effects: [{ kind: 'spellAttack', item: 'infused', steps: PLUS_ONE_TO_TWO }],
    attune: true,
  },
  {
    holder: option('Arcane Propulsion Armor|TCE'),
    label: 'Arcane Propulsion Armor',
    text: "Arcane Propulsion Armor: the wearer's walking speed increases by 5 feet.",
    effects: [{ kind: 'speed', item: 'infused', amount: 5 }],
    attune: true,
  },
  {
    holder: option('Helm of Awareness|TCE'),
    label: 'Helm of Awareness',
    text: "Helm of Awareness: while wearing this helmet, a creature has advantage on initiative rolls, and can't be surprised unless it is incapacitated.",
    effects: [{ kind: 'initiativeAdvantage', item: 'infused' }],
    attune: true,
  },
  {
    holder: option('Cloud Rune|TCE'),
    label: 'Cloud Rune',
    text: 'Cloud Rune: while wearing or carrying an object inscribed with this rune, you have advantage on Dexterity (Sleight of Hand) checks and Charisma (Deception) checks.',
    effects: [{ kind: 'checkAdvantage', skills: ['sleight of hand', 'deception'] }],
    carried: true,
  },
  {
    holder: option('Frost Rune|TCE'),
    label: 'Frost Rune',
    text: 'Frost Rune: while wearing or carrying an object inscribed with this rune, you have advantage on Wisdom (Animal Handling) checks and Charisma (Intimidation) checks.',
    effects: [{ kind: 'checkAdvantage', skills: ['animal handling', 'intimidation'] }],
    carried: true,
  },
  {
    holder: option('Stone Rune|TCE'),
    label: 'Stone Rune',
    text: 'Stone Rune: while wearing or carrying an object inscribed with this rune, you have advantage on Wisdom (Insight) checks.',
    effects: [{ kind: 'checkAdvantage', skills: ['insight'] }],
    carried: true,
  },
  {
    holder: option('Storm Rune|TCE'),
    label: 'Storm Rune',
    text: "Storm Rune: while wearing or carrying an object inscribed with this rune, you have advantage on Intelligence (Arcana) checks, and you can't be surprised as long as you aren't incapacitated.",
    effects: [{ kind: 'checkAdvantage', skills: ['arcana'] }],
    carried: true,
  },
  {
    holder: option('Hill Rune|TCE'),
    label: 'Hill Rune',
    text: 'Hill Rune: while wearing or carrying an object that bears this rune, you have advantage on saving throws against being poisoned, and resistance to poison damage.',
    effects: [{ kind: 'saveAdvantage', ability: 'con', when: 'against being poisoned' }],
    carried: true,
  },
]

/** What an option's row of the infused-item or pact-weapon pick reads its items as. */
export type PickedItemKind =
  | 'weapon'
  | 'armorOrShield'
  | 'shield'
  | 'armor'
  | 'focus'
  | 'any'
  /** A simple or martial weapon without the heavy and special properties (Dedicated Weapon). */
  | 'monkCandidate'

/**
 * The item each option is put into, for the pick of it: the pact weapon of Pact of the
 * Blade, and the object each infusion with an effect above is put into (by its `item`
 * prerequisite).
 */
export const EFFECT_ITEM_PICKS: readonly {
  option: string
  title: string
  items: PickedItemKind
  note: string
  /** Only a nonmagical object can be infused. */
  nonmagical?: true
  /** A ranged weapon only with this option (Improved Pact Weapon). */
  rangedWith?: string
}[] = [
  ...['PHB', 'XPHB'].map((source) => ({
    option: `Pact of the Blade|${source}`,
    title: 'Pact weapon',
    items: 'weapon' as const,
    rangedWith: 'Improved Pact Weapon|XGE',
    note: 'The weapon in your inventory that is your pact weapon: its attacks show what your invocations add to it. A pact weapon is a melee weapon (a bow or crossbow too with Improved Pact Weapon).',
  })),
  ...(
    [
      ['Enhanced Defense', 'armorOrShield', 'A suit of armor or a shield'],
      ['Repulsion Shield', 'shield', 'A shield'],
      ['Enhanced Weapon', 'weapon', 'A simple or martial weapon'],
      ['Radiant Weapon', 'weapon', 'A simple or martial weapon'],
      [
        'Returning Weapon',
        'weapon',
        'A simple or martial weapon with the thrown property',
      ],
      [
        'Repeating Shot',
        'weapon',
        'A simple or martial weapon with the ammunition property',
      ],
      ['Enhanced Arcane Focus', 'focus', 'A rod, staff or wand'],
      ['Arcane Propulsion Armor', 'armor', 'A suit of armor'],
      ['Helm of Awareness', 'any', 'A helmet'],
    ] as const
  ).map(([name, items, what]) => ({
    option: `${name}|TCE`,
    title: 'Infused item',
    items,
    nonmagical: true as const,
    note: `${what} in your inventory that you infuse with ${name}, one for each time you know it: its bonus shows on that item's numbers.`,
  })),
]

/**
 * The size of the superiority dice a maneuver is fuelled with, by what gives the dice:
 * `[from level, faces]` by the level of the class the holder is a feature of.
 */
export const SUPERIORITY_DICE: readonly {
  holder: Holder
  label: string
  steps: Steps
}[] = [
  ...['PHB', 'XPHB'].map((source) => ({
    holder: {
      subclassFeature: {
        className: 'Fighter',
        shortName: 'Battle Master',
        source,
        name: 'Combat Superiority',
      },
    },
    label: 'Combat Superiority',
    steps: [
      [3, 8],
      [10, 10],
      [18, 12],
    ] as Steps,
  })),
  { holder: { feat: 'Martial Adept|PHB' }, label: 'Martial Adept', steps: [[1, 6]] },
  {
    holder: { option: 'Superior Technique|TCE' },
    label: 'Superior Technique',
    steps: [[1, 6]],
  },
]

/** The feature types whose options are fuelled by superiority dice (the maneuvers). */
export const SUPERIORITY_TYPES: readonly string[] = ['MV:B']

/** The amount of steps at a level: the last step reached, 0 below the first. */
export const stepAt = (steps: Steps, level: number): number =>
  steps.reduce((n, [at, amount]) => (level >= at ? amount : n), 0)

/**
 * The options whose text states a number or a grant the sheet models, but which the
 * sheet leaves to play, with why: the effect is switched on in play, or is on a number
 * the sheet does not keep.
 */
export const OPTION_EFFECTS_IN_PLAY: Readonly<Record<string, string>> = {
  'Extended Spell|XPHB':
    'Its advantage on Constitution saves is for concentration on the one spell you extend, when you spend the sorcery points.',
  'Heightened Spell|PHB':
    'The disadvantage it gives is on the saving throw of a target of your spell, not on a number of yours.',
  'Health Funnel|WoW':
    'Your Charisma modifier is added to Hit Dice you spend in play, for temporary hit points of your familiar or another fiend.',
  'Investment of the Chain Master|TCE':
    'It changes the numbers of your familiar, which the sheet does not keep.',
  'Investment of the Chain Master|XPHB':
    'It changes the numbers of your familiar, which the sheet does not keep.',
}
