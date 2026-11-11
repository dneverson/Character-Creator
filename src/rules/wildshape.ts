// Druid Wild Shape limits by druid level, circle and edition. RAW by default; the
// UI still lets a player pick a form outside these limits, flagged non-standard.
//
// 2014 (Player's Handbook): no limit on how many forms; beasts you have seen, up to
// a challenge rating by level, swimming from 4 and flying from 8.
// 2024 (Player's Handbook): 4, 6 or 8 known forms (one swapped per long rest), the
// same challenge rating and flying limits, and no swimming limit.

import type { Edition } from '../data/edition'
import type { Beast } from '../data/beasts'

export interface WildShapeLimits {
  edition: Edition
  /** Wild Shape is unlocked (druid level >= 2). */
  available: boolean
  /** Highest beast challenge rating allowed (numeric, e.g. 0.25). */
  maxCr: number
  /** Beasts with a flying speed are allowed (druid level >= 8). */
  allowFly: boolean
  /** Beasts with a swimming speed are allowed (2014: druid level >= 4; 2024: always). */
  allowSwim: boolean
  /** Circle of the Moon raises the CR cap. */
  moon: boolean
  /** The druid level the limits were worked out for. */
  level: number
  /** How many forms the druid knows at most (2024); the 2014 rule has no count. */
  knownForms?: number
  /** Uses before a rest (2024 class table). */
  uses?: number
  /** Hours in a form (2024: half the druid level). */
  hours?: number
  /** Temporary hit points gained on shifting (2024). */
  tempHp?: number
}

/** The 2024 Druid table: Wild Shape uses by level. */
const usesAt = (level: number) => (level >= 17 ? 4 : level >= 6 ? 3 : 2)

/** The 2024 "Beast Shapes" table: known forms by level. */
const knownFormsAt = (level: number) => (level >= 8 ? 8 : level >= 4 ? 6 : 4)

/** The base challenge rating limit of the Beast Shapes table (same in both editions). */
const baseCr = (level: number) => (level >= 8 ? 1 : level >= 4 ? 0.5 : 0.25)

/**
 * Wild Shape limits for a druid of the given level. Circle of the Moon: CR 1 from
 * level 2 and a third of the druid level from 6 (2014), a third of the druid level
 * from the subclass at 3 (2024).
 */
export function wildShapeLimits(
  druidLevel: number,
  moon: boolean,
  edition: Edition = 'classic',
): WildShapeLimits {
  const level = Math.max(0, Math.floor(druidLevel))
  const available = level >= 2
  const one = edition === 'one'
  const moonCr = one ? Math.floor(level / 3) : Math.max(1, Math.floor(level / 3))
  const moonApplies = moon && (!one || level >= 3)
  const limits: WildShapeLimits = {
    edition,
    available,
    maxCr: moonApplies ? moonCr : baseCr(level),
    allowFly: level >= 8,
    allowSwim: one || level >= 4,
    moon,
    level,
  }
  if (one && available) {
    limits.knownForms = knownFormsAt(level)
    limits.uses = usesAt(level)
    limits.hours = Math.floor(level / 2)
    limits.tempHp = moonApplies ? 3 * level : level
  }
  return limits
}

/** A challenge rating written the way the books do: 1/8, 1/4, 1/2, 3. */
export function crLabel(cr: number): string {
  return cr > 0 && cr < 1 ? `1/${Math.round(1 / cr)}` : String(cr)
}

export interface BeastFit {
  standard: boolean
  /** Why the beast is outside the druid's limits (only when not standard). */
  reason?: string
}

/** Whether a beast is a form the druid's limits allow, and if not, why not. */
export function beastFit(beast: Beast, limits: WildShapeLimits): BeastFit {
  if (beast.swarm)
    return { standard: false, reason: 'A swarm cannot be a Wild Shape form' }
  if (!beast.hasCr) {
    return {
      standard: false,
      reason: "No challenge rating: this is a spell's creature, not a Wild Shape form",
    }
  }
  if (beast.crValue > limits.maxCr) {
    return {
      standard: false,
      reason: `CR ${beast.cr} is above your limit of ${crLabel(limits.maxCr)}`,
    }
  }
  if (beast.hasFly && !limits.allowFly) {
    return {
      standard: false,
      reason: 'Has a flying speed; you can take these from druid level 8',
    }
  }
  if (beast.hasSwim && !limits.allowSwim) {
    return { standard: false, reason: 'Swimming forms need druid level 4' }
  }
  return { standard: true }
}

/** What the limits say about movement, as the end of "beasts up to CR 1/2 ...". */
function movementClause(limits: WildShapeLimits): string {
  if (limits.allowFly) return ''
  return limits.allowSwim
    ? ' that have no flying speed'
    : ' that have neither a flying nor a swimming speed'
}

/**
 * The rule in force for this druid, in plain words, so nobody opens a book: what
 * a form may be, how many the druid knows, and what shifting gives. Wild Shape
 * works differently in the two editions.
 */
export function wildShapeRuleLines(limits: WildShapeLimits): string[] {
  const cr = crLabel(limits.maxCr)
  const lines = [
    `Druid ${limits.level}: Beasts up to CR ${cr}${movementClause(limits)}${
      limits.allowFly ? ', flying and swimming included' : ''
    }.`,
  ]
  if (limits.edition === 'one') {
    lines.push(
      `You know ${limits.knownForms} forms. After each long rest you can swap one for another eligible Beast.`,
      `Wild Shape: ${limits.uses} uses (one comes back on a short rest, all on a long rest); ` +
        `a form lasts up to ${limits.hours} hours; you gain ${limits.tempHp} temporary hit points ` +
        'when you shift.',
    )
    if (limits.moon && limits.level >= 3) {
      lines.push(
        'Circle of the Moon: while shifted your AC is 13 plus your Wisdom modifier if that is higher than the Beast.',
      )
    }
  } else {
    lines.push(
      'There is no limit on how many forms you know: any Beast you have seen is allowed.',
      `Wild Shape: twice, regained on a short or long rest; a form lasts up to ${Math.floor(limits.level / 2)} hours.`,
    )
    if (limits.moon) {
      lines.push('Circle of the Moon: you can shift as a bonus action.')
    }
  }
  return lines
}
