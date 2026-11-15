// What differs between the 2014 and the 2024 rules in play, apart from the rests (restRules.ts):
// the name of inspiration, which printing of the conditions applies, what each level of
// exhaustion does, and which conditions stop the character moving. The audit in
// playRules.test.ts checks every row against the book data.

import type { Edition } from '../data/edition'

export type ExhaustionRule =
  /**
   * 2014: six levels, each with its own effect; the effects of lower levels apply too. The
   * levels a number changes at: speed halved, hit point maximum halved, speed 0.
   */
  | {
      kind: 'levels'
      effects: readonly string[]
      speedHalvedAt: number
      hpMaxHalvedAt: number
      speedZeroAt: number
      /** The level from which ability checks have disadvantage. */
      checkDisadvantageAt: number
    }
  /** 2024: every level takes the same amount off d20 tests and off speed. */
  | { kind: 'perLevel'; d20Test: number; speedFeet: number; deathAt: number }

export interface PlayRules {
  /** What inspiration is called. */
  inspiration: string
  /** The book whose printing of the conditions, with their full text, applies. */
  conditionSource: string
  exhaustion: ExhaustionRule
  /** The conditions that make the character's speed 0, as that printing words it. */
  speedZero: readonly { condition: string; text: string }[]
  /**
   * The conditions that give disadvantage on ability checks, as that printing words it;
   * `when` is a condition the sheet cannot check (the source of fear in sight).
   */
  checkDisadvantage: readonly { condition: string; text: string; when?: string }[]
}

const FEAR_IN_SIGHT = 'Only while the source of your fear is within line of sight.'

export const PLAY_RULES: Record<Edition, PlayRules> = {
  classic: {
    inspiration: 'Inspiration',
    conditionSource: 'PHB',
    exhaustion: {
      kind: 'levels',
      effects: [
        'Disadvantage on ability checks',
        'Speed halved',
        'Disadvantage on attack rolls and saving throws',
        'Hit point maximum halved',
        'Speed reduced to 0',
        'Death',
      ],
      speedHalvedAt: 2,
      hpMaxHalvedAt: 4,
      speedZeroAt: 5,
      checkDisadvantageAt: 1,
    },
    speedZero: [
      { condition: 'Grappled', text: 'speed becomes 0' },
      { condition: 'Paralyzed', text: "can't move" },
      { condition: 'Petrified', text: "can't move" },
      { condition: 'Restrained', text: 'speed becomes 0' },
      { condition: 'Stunned', text: "can't move" },
      { condition: 'Unconscious', text: "can't move" },
    ],
    checkDisadvantage: [
      {
        condition: 'Frightened',
        text: 'disadvantage on ability checks and attack rolls while the source of its fear is within line of sight',
        when: FEAR_IN_SIGHT,
      },
      { condition: 'Poisoned', text: 'disadvantage on attack rolls and ability checks' },
    ],
  },
  one: {
    inspiration: 'Heroic Inspiration',
    conditionSource: 'XPHB',
    exhaustion: { kind: 'perLevel', d20Test: 2, speedFeet: 5, deathAt: 6 },
    speedZero: ['Grappled', 'Paralyzed', 'Petrified', 'Restrained', 'Unconscious'].map(
      (condition) => ({ condition, text: 'Speed is 0' }),
    ),
    checkDisadvantage: [
      {
        condition: 'Frightened',
        text: 'Disadvantage on ability checks and attack rolls while the source of fear is within line of sight',
        when: FEAR_IN_SIGHT,
      },
      { condition: 'Poisoned', text: 'Disadvantage on attack rolls and ability checks' },
    ],
  },
}

/** What a character at this exhaustion level suffers, one line for each effect. */
export function exhaustionEffects(edition: Edition, level: number): string[] {
  const rule = PLAY_RULES[edition].exhaustion
  if (level <= 0) return []
  if (rule.kind === 'levels') return rule.effects.slice(0, level)
  return level >= rule.deathAt
    ? ['Death']
    : [`D20 Tests: -${rule.d20Test * level}`, `Speed: -${rule.speedFeet * level} ft.`]
}
