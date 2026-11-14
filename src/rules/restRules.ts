// What a short rest and a long rest do, for each edition, as one table. The rest windows list
// these effects and src/play/rest.ts applies them, so a rule changes here and nowhere else.
// The audit in restRules.test.ts checks the wording against the book data.

import type { Edition } from '../data/edition'

interface Effect<Kind extends string> {
  kind: Kind
  /** What the rest window says this does. */
  text: string
  /** Where the rule is written: the book and the page or the rule's name. */
  ruleRef: string
}

export type RestEffect =
  /** Starting the rest takes at least 1 hit point. It warns, and never blocks. */
  | Effect<'requiresHp'>
  /** Hit dice spent for hit points; each die heals at least `minimumPerDie`. */
  | (Effect<'spendHitDice'> & { minimumPerDie: number })
  | Effect<'restoreHp'>
  /** Spent hit dice regained: all of them, or half of the total (at least `minimum`). */
  | (Effect<'regainHitDice'> & { portion: 'all' | 'half'; minimum: number })
  | (Effect<'restoreSlots'> & { which: readonly ('standard' | 'pact')[] })
  | Effect<'endTempHp'>
  | Effect<'reduceExhaustion'>
  | Effect<'resetDeathSaves'>
  /** The limited uses of features and items that this rest restores, as each one says. */
  | (Effect<'rechargeUses'> & { on: RestKind })

export type RestKind = 'short' | 'long'

export interface RestRules {
  short: readonly RestEffect[]
  long: readonly RestEffect[]
}

export const REST_RULES: Record<Edition, RestRules> = {
  classic: {
    short: [
      {
        kind: 'spendHitDice',
        minimumPerDie: 0,
        text: 'Spend hit dice: each die plus your Constitution modifier heals you (never below 0)',
        ruleRef: 'PHB p. 186, Short Rest',
      },
      {
        kind: 'restoreSlots',
        which: ['pact'],
        text: 'Pact Magic slots are regained',
        ruleRef: 'PHB Warlock: Pact Magic',
      },
      {
        kind: 'rechargeUses',
        on: 'short',
        text: 'Uses that come back on a short rest are regained, as each feature says',
        ruleRef: 'PHB p. 186, Short Rest',
      },
    ],
    long: [
      {
        kind: 'requiresHp',
        text: 'You need at least 1 hit point at the start of the rest',
        ruleRef: 'PHB p. 186, Long Rest',
      },
      {
        kind: 'restoreHp',
        text: 'All lost hit points are regained',
        ruleRef: 'PHB p. 186, Long Rest',
      },
      {
        kind: 'resetDeathSaves',
        text: 'Death saves are cleared',
        ruleRef: 'PHB p. 186, Long Rest',
      },
      {
        kind: 'regainHitDice',
        portion: 'half',
        minimum: 1,
        text: 'Half of your total hit dice are regained (at least 1), the largest first',
        ruleRef: 'PHB p. 186, Long Rest',
      },
      {
        kind: 'restoreSlots',
        which: ['standard', 'pact'],
        text: 'All spell slots and Pact Magic slots are regained',
        ruleRef: 'PHB Spellcasting',
      },
      {
        kind: 'endTempHp',
        text: 'Temporary hit points end',
        ruleRef: 'PHB p. 198, Temporary Hit Points',
      },
      {
        kind: 'reduceExhaustion',
        text: 'Exhaustion goes down by 1, if you have had food and drink',
        ruleRef: 'PHB Appendix A, Exhaustion',
      },
      {
        kind: 'rechargeUses',
        on: 'long',
        text: 'Uses that come back on a long rest are regained, as each feature says',
        ruleRef: 'PHB p. 186, Long Rest',
      },
    ],
  },
  one: {
    short: [
      {
        kind: 'requiresHp',
        text: 'You need at least 1 hit point to start the rest',
        ruleRef: 'XPHB Short Rest',
      },
      {
        kind: 'spendHitDice',
        minimumPerDie: 1,
        text: 'Spend hit dice: each die plus your Constitution modifier heals you (at least 1 each)',
        ruleRef: 'XPHB Short Rest',
      },
      {
        kind: 'restoreSlots',
        which: ['pact'],
        text: 'Pact Magic slots are regained',
        ruleRef: 'XPHB Warlock: Pact Magic',
      },
      {
        kind: 'rechargeUses',
        on: 'short',
        text: 'Uses that come back on a short rest are regained, as each feature says',
        ruleRef: 'XPHB Short Rest',
      },
    ],
    long: [
      {
        kind: 'requiresHp',
        text: 'You need at least 1 hit point to start the rest',
        ruleRef: 'XPHB Long Rest',
      },
      {
        kind: 'restoreHp',
        text: 'All lost hit points are regained',
        ruleRef: 'XPHB Long Rest',
      },
      {
        kind: 'resetDeathSaves',
        text: 'Death saves are cleared',
        ruleRef: 'XPHB Long Rest',
      },
      {
        kind: 'regainHitDice',
        portion: 'all',
        minimum: 0,
        text: 'All spent hit dice are regained',
        ruleRef: 'XPHB Long Rest',
      },
      {
        kind: 'restoreSlots',
        which: ['standard', 'pact'],
        text: 'All spell slots and Pact Magic slots are regained',
        ruleRef: 'XPHB Spellcasting',
      },
      {
        kind: 'endTempHp',
        text: 'Temporary hit points end',
        ruleRef: 'XPHB Temporary Hit Points',
      },
      {
        kind: 'reduceExhaustion',
        text: 'Exhaustion goes down by 1',
        ruleRef: 'XPHB Long Rest',
      },
      {
        kind: 'rechargeUses',
        on: 'long',
        text: 'Uses that come back on a long rest are regained, as each feature says',
        ruleRef: 'XPHB Long Rest',
      },
    ],
  },
}
