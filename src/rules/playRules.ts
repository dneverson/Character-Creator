// What differs between the 2014 and the 2024 rules in play, apart from the rests (restRules.ts):
// the name of inspiration, which printing of the conditions applies, and what each level of
// exhaustion does. The audit in playRules.test.ts checks every row against the book data.

import type { Edition } from '../data/edition'

export type ExhaustionRule =
  /** 2014: six levels, each with its own effect; the effects of lower levels apply too. */
  | { kind: 'levels'; effects: readonly string[] }
  /** 2024: every level takes the same amount off d20 tests and off speed. */
  | { kind: 'perLevel'; d20Test: number; speedFeet: number; deathAt: number }

export interface PlayRules {
  /** What inspiration is called. */
  inspiration: string
  /** The book whose printing of the conditions, with their full text, applies. */
  conditionSource: string
  exhaustion: ExhaustionRule
}

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
    },
  },
  one: {
    inspiration: 'Heroic Inspiration',
    conditionSource: 'XPHB',
    exhaustion: { kind: 'perLevel', d20Test: 2, speedFeet: 5, deathAt: 6 },
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
