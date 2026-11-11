// Hit points and hit dice. Computes the average and (optionally) rolled HP for
// a character: the first character level takes the maximum die, later levels
// take the fixed average or a rolled value, and every level adds the CON
// modifier plus any per-level bonuses. Kept out of components for testing.

import { abilityMod, randomInt, type AbilityKey } from '../dice/dice'
import type { LoadedClass } from '../data/class'
import type { Character } from './model'
import { hpSources, type HpLine } from '../rules/hpSources'
import { characterAbilityTotals, totalLevel } from './derive'

/** What feats contribute to hit points: ability increases, and which feats are taken. */
export interface FeatEffects {
  abilityBonus: Partial<Record<AbilityKey, number>>
  /** The feat slots as resolved; each chosen feat's rules are applied by `hpSources`. */
  slots?: readonly { feat?: { key: string } }[]
}

const NO_FEATS: FeatEffects = { abilityBonus: {} }

export interface LevelDie {
  /** Which class in the list this level belongs to. */
  classIndex: number
  faces: number
  /** True for the very first character level (takes the maximum die). */
  isFirst: boolean
}

/** Ordered per-level hit dice; the first character level is flagged. */
export function levelDice(
  character: Character,
  classByKey: Map<string, LoadedClass>,
): LevelDie[] {
  const out: LevelDie[] = []
  character.classes.forEach((c, i) => {
    const lc = classByKey.get(`${c.name}|${c.source}`)
    const faces = lc?.entry.hd?.faces ?? 0
    // Skip rows whose class isn't chosen/resolved yet (no hit die).
    if (faces <= 0) return
    const levels = Math.max(0, Math.floor(c.level || 0))
    for (let j = 0; j < levels; j++) {
      out.push({ classIndex: i, faces, isFirst: out.length === 0 })
    }
  })
  return out
}

/** Fixed average value of a die (RAW: half, rounded up - d8 = 5). */
export function averageDie(faces: number): number {
  return Math.floor(faces / 2) + 1
}

export interface HitDiceGroup {
  faces: number
  count: number
}

/** Hit dice grouped by die size, e.g. [{faces:10,count:3},{faces:8,count:2}]. */
export function hitDiceGroups(dice: LevelDie[]): HitDiceGroup[] {
  const m = new Map<number, number>()
  for (const d of dice) if (d.faces > 0) m.set(d.faces, (m.get(d.faces) ?? 0) + 1)
  return [...m.entries()]
    .map(([faces, count]) => ({ faces, count }))
    .sort((a, b) => b.faces - a.faces)
}

/** Character's CON modifier from its effective ability totals (feats included). */
export function conModifier(
  character: Character,
  featBonus: Partial<Record<AbilityKey, number>> = {},
): number {
  return abilityMod(characterAbilityTotals(character, featBonus).con)
}

/** True for a Hill Dwarf, who gains +1 HP per level (2014). */
export function isHillDwarf(character: Character): boolean {
  const r = character.race
  return !!r && r.baseName === 'Dwarf' && r.subraceName === 'Hill'
}

/** The levels of one class row: its hit die, which levels, and what they give. */
export interface HpDiceLine {
  classIndex: number
  className: string
  faces: number
  /** First and last character level of the row. */
  fromLevel: number
  toLevel: number
  /** The first character level takes the maximum die and is not part of the average. */
  hasFirst: boolean
  /** Levels that take the average (or a roll). */
  averaged: number
  /** The value one averaged level takes. */
  average: number
  /** Total with the maximum first level and averaged later levels. */
  averageTotal: number
  /** Total with the rolled values, when stored rolls cover every level. */
  rolledTotal?: number
}

/** One line per class row: its dice by level, average and (when rolled) rolled. */
export function diceLines(
  character: Character,
  dice: LevelDie[],
  rolled: boolean,
): HpDiceLine[] {
  const lines: HpDiceLine[] = []
  dice.forEach((d, i) => {
    const last = lines[lines.length - 1]
    const value = d.isFirst ? d.faces : averageDie(d.faces)
    const roll = d.isFirst ? d.faces : character.hp.rolls[i]
    if (last && last.classIndex === d.classIndex) {
      last.toLevel = i + 1
      last.averaged += 1
      last.averageTotal += value
      if (last.rolledTotal !== undefined) last.rolledTotal += roll
      return
    }
    lines.push({
      classIndex: d.classIndex,
      className: character.classes[d.classIndex]?.name ?? '',
      faces: d.faces,
      fromLevel: i + 1,
      toLevel: i + 1,
      hasFirst: d.isFirst,
      averaged: d.isFirst ? 0 : 1,
      average: averageDie(d.faces),
      averageTotal: value,
      rolledTotal: rolled ? roll : undefined,
    })
  })
  return lines
}

export interface HpBreakdown {
  totalLevel: number
  conMod: number
  /** CON modifier summed across all levels. */
  conTotal: number
  /** Sum of die values using the fixed-average method. */
  averageDiceTotal: number
  /** The hit dice, one line per class row. */
  dice: HpDiceLine[]
  /** Every rule that raises the maximum for this character, each with its source. */
  lines: HpLine[]
  /** Per-level bonuses (rules + the manual one) summed across levels. */
  perLevelTotal: number
  /** Flat bonuses (rules + the manual one). */
  flatBonus: number
  averageHP: number
  /** Rolled HP, present only when stored rolls cover every level. */
  rolledHP?: number
}

/** Full HP breakdown for display. `feats` carries the resolved feat effects. */
export function hpBreakdown(
  character: Character,
  classByKey: Map<string, LoadedClass>,
  feats: FeatEffects = NO_FEATS,
): HpBreakdown {
  const dice = levelDice(character, classByKey)
  const level = totalLevel(character)
  const conMod = conModifier(character, feats.abilityBonus)
  const conTotal = conMod * level
  const featKeys = (feats.slots ?? []).flatMap((s) => (s.feat ? [s.feat.key] : []))
  const lines = hpSources(character, featKeys)
  const rulePerLevel = lines.reduce((sum, l) => sum + l.perLevel * l.levels, 0)
  const perLevelTotal = rulePerLevel + (character.hp.perLevelBonus || 0) * level
  const flatBonus =
    lines.reduce((sum, l) => sum + l.flat, 0) + (character.hp.flatBonus || 0)

  const averageDiceTotal = dice.reduce(
    (sum, d) => sum + (d.isFirst ? d.faces : averageDie(d.faces)),
    0,
  )

  const averageHP = averageDiceTotal + conTotal + perLevelTotal + flatBonus

  let rolledHP: number | undefined
  const rolls = character.hp.rolls
  if (dice.length > 0 && rolls.length === dice.length) {
    const rolledDiceTotal = dice.reduce(
      (sum, d, i) => sum + (d.isFirst ? d.faces : rolls[i]),
      0,
    )
    rolledHP = rolledDiceTotal + conTotal + perLevelTotal + flatBonus
  }

  return {
    totalLevel: level,
    conMod,
    conTotal,
    averageDiceTotal,
    dice: diceLines(character, dice, rolledHP !== undefined),
    lines,
    perLevelTotal,
    flatBonus,
    averageHP,
    rolledHP,
  }
}

/** Roll a hit-die value for each level (the first level is stored as its max). */
export function rollHitDice(dice: LevelDie[]): number[] {
  return dice.map((d) => (d.faces > 0 ? randomInt(1, d.faces) : 0))
}
