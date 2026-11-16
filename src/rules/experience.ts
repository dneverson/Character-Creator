// Experience points: the total a character needs to reach each level, from the Character
// Advancement table. Both editions print the same numbers (2014 Player's Handbook, 2024
// Player's Handbook), but each is kept as its own row so a change in one printing is one
// edit; experience.test.ts checks both rows against the book data.

import type { Edition } from '../data/edition'

/** Experience points needed for level 2, 3, ... 20 (level 1 needs none). */
export const XP_FOR_LEVEL: Record<Edition, readonly number[]> = {
  classic: [
    300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000,
    140000, 165000, 195000, 225000, 265000, 305000, 355000,
  ],
  one: [
    300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000,
    140000, 165000, 195000, 225000, 265000, 305000, 355000,
  ],
}

/** The highest level the table reaches. */
export const MAX_XP_LEVEL = 20

/** Experience points that reach `level` (1 to 20); 0 for level 1. */
export function xpForLevel(edition: Edition, level: number): number {
  if (level <= 1) return 0
  const table = XP_FOR_LEVEL[edition]
  return table[Math.min(level, MAX_XP_LEVEL) - 2]
}

/** The highest level `xp` reaches. */
export function levelForXp(edition: Edition, xp: number): number {
  const reached = XP_FOR_LEVEL[edition].filter((needed) => xp >= needed).length
  return reached + 1
}

/**
 * Where a character stands against the table: the experience points of the next level, or
 * null at level 20, and whether a level is waiting (the points reach a level above the one
 * the character has). Multiclass characters pass their total level.
 */
export function xpStanding(
  edition: Edition,
  xp: number,
  level: number,
): { next: number | null; ready: boolean } {
  const next = level >= MAX_XP_LEVEL ? null : xpForLevel(edition, level + 1)
  return { next, ready: next !== null && xp >= next }
}
