// Gaining a level: the character with one more level in a class (`applyLevel`), and what
// that level asks of the player (`levelUpSteps`). Both are pure, so the Level up view, its
// tests and the sweep over every class of the books read the same answers.
//
// The level is added to a copy, the draft. What the steps change is changed on the draft
// too, and the store sees nothing until the player confirms (see LevelUpView).

import type { LoadedClass } from '../data/class'
import { multiclassRequirements, subclassesFor, subclassUnlockLevel } from '../data/class'
import { chosenOptions, optionCards } from '../derived/classOptions'
import { featureRows, type FeatureRow } from '../derived/features'
import { collectSources, type DeriveDeps, type Sources } from '../derived/sources'
import { STANDARD_LEVEL_CAP, checkMulticlass, type Deviation } from '../rules/compliance'
import {
  classMaxSpellLevel,
  spellbookFreeCount,
  type ClassCaster,
} from '../rules/spellcasting'
import { totalLevel } from './derive'
import { classEntryScores, type FeatSummary } from './feats'
import { averageDie, levelDice } from './hp'
import type { Character, ClassRef } from './model'
import { characterCasters } from './spellcasting'
import { resolveSpellGrants } from './spellGrants'
import { unassignedAbilities } from './stats'
import { cardGrantsOf } from './spellTiers'

/** The class a level is gained in: one the character has, or a new one. */
export interface LevelTarget {
  name: string
  source: string
}

export const targetKey = (target: LevelTarget) => `${target.name}|${target.source}`

/** Where the new level's hit die is: its place in `hp.rolls` and its size. */
export interface NewLevelDie {
  index: number
  faces: number
  /** The first level of the character, which takes the die's maximum. */
  first: boolean
  /**
   * The character rolls its hit points (the rolled method with a roll for every level), so
   * the new level needs a roll too. Until one is made it holds the die's average.
   */
  rolled: boolean
}

export interface LevelUp {
  /** The character with the level gained. */
  draft: Character
  /** The class's place in `classes`. */
  classIndex: number
  /** The class level before (0 for a new class) and after. */
  from: number
  to: number
  /** Absent when the class has no hit die in the data. */
  die?: NewLevelDie
}

/** Whether the character can gain a level: the rules end at level 20. */
export const canGainLevel = (character: Character) =>
  totalLevel(character) < STANDARD_LEVEL_CAP

/** The character with one more level in `target`, and where that level went. */
export function applyLevel(
  character: Character,
  target: LevelTarget,
  classByKey: Map<string, LoadedClass>,
): LevelUp {
  const key = targetKey(target)
  const at = character.classes.findIndex((c) => `${c.name}|${c.source}` === key)
  const from = at >= 0 ? character.classes[at].level : 0
  const classes: ClassRef[] =
    at >= 0
      ? character.classes.map((c, i) => (i === at ? { ...c, level: c.level + 1 } : c))
      : [...character.classes, { name: target.name, source: target.source, level: 1 }]
  const classIndex = at >= 0 ? at : classes.length - 1
  const leveled: Character = { ...character, classes }

  const before = levelDice(character, classByKey)
  const after = levelDice(leveled, classByKey)
  // The new die is the last one of its class: the hit dice run in class order.
  const index = after.findLastIndex((d) => d.classIndex === classIndex)
  if (index < 0 || after.length !== before.length + 1) {
    return { draft: leveled, classIndex, from, to: from + 1 }
  }
  const { faces, isFirst } = after[index]
  const rolled =
    character.hp.method === 'rolled' &&
    before.length > 0 &&
    character.hp.rolls.length === before.length
  const draft: Character = rolled
    ? {
        ...leveled,
        hp: {
          ...leveled.hp,
          rolls: withRoll(character.hp.rolls, index, averageDie(faces)),
        },
      }
    : leveled
  return {
    draft,
    classIndex,
    from,
    to: from + 1,
    die: { index, faces, first: isFirst, rolled },
  }
}

/**
 * The multiclass prerequisites a new class would not meet, flagged and never blocking:
 * only those the class brings (the first class is checked when a second is taken).
 */
export function newClassFlags(
  character: Character,
  target: LevelTarget,
  classByKey: Map<string, LoadedClass>,
  summary: FeatSummary,
): Deviation[] {
  const requirements = new Map(
    [...classByKey].map(([key, loaded]) => [key, multiclassRequirements(loaded.entry)]),
  )
  const unset = unassignedAbilities(character.abilities, character.statMethod)
  const check = (c: Character) =>
    checkMulticlass(c.classes, requirements, classEntryScores(c, summary), unset)
  const had = new Set(check(character).map((d) => d.id))
  const next: Character = {
    ...character,
    classes: [
      ...character.classes,
      { name: target.name, source: target.source, level: 1 },
    ],
  }
  return check(next).filter((d) => !had.has(d.id))
}

/** The rolls with a new level's value put in at its place. */
function withRoll(rolls: readonly number[], index: number, value: number): number[] {
  return [...rolls.slice(0, index), value, ...rolls.slice(index)]
}

/** The rolls of the draft with the new level's value replaced. */
export function setLevelRoll(
  rolls: readonly number[],
  die: NewLevelDie,
  value: number,
): number[] {
  const clamped = Math.min(die.faces, Math.max(1, Math.round(value)))
  return rolls.map((r, i) => (i === die.index ? clamped : r))
}

/** What the new level's spells ask for, when the step shows. */
export interface SpellStep {
  /** The class's own choices: more cantrips or spells, or a spell it may replace. */
  classKey?: string
  /** It may replace one spell it knows with another on gaining the level. */
  swap: boolean
  /**
   * The spell grants the level brought (a feat, an option, a level reached), shown with
   * the choice one of them asks for.
   */
  grantIds: string[]
}

export interface LevelUpSteps {
  /** The level is the one the class chooses its subclass at. */
  subclass: boolean
  /** The ids of the feat slots the level brought. */
  featSlots: string[]
  spells: SpellStep | null
  /** The tags of the class option cards with more to choose than before. */
  options: string[]
  /** The features and traits the level brought, with their text. */
  features: FeatureRow[]
}

const sameCaster = (c: ClassCaster, key: string) => c.classKey === key

/** What a caster's level lets it choose, to see whether the level changed it. */
const allowance = (c: ClassCaster | undefined) =>
  c
    ? [
        c.cantripsKnown,
        c.spellsKnown ?? 0,
        c.preparedMax ?? 0,
        c.spellbookFree ?? spellbookFreeCount(c.level),
        classMaxSpellLevel(c),
      ].join('/')
    : ''

/** The spell grants in force that are not a class's own list, and whether each asks for a pick. */
function cardGrants(sources: Sources, deps: DeriveDeps): { id: string; pick: boolean }[] {
  const { character, summary } = sources
  const casters = characterCasters(character, deps.classByKey, summary.abilityBonus)
  const { grants } = resolveSpellGrants(character, {
    race: deps.race,
    background: deps.background,
    featSlots: summary.slots,
    classByKey: deps.classByKey,
    options: chosenOptions(sources, deps),
  })
  return cardGrantsOf(grants, casters)
    .filter((g) => !g.locked)
    .map((g) => ({ id: g.id, pick: !!g.pick }))
}

/** A feature's identity across the two characters: who gives it, at what level, its name. */
const featureKey = (f: FeatureRow) => `${f.kind}|${f.from}|${f.level ?? ''}|${f.name}`

/** The rows of `after` that `before` has not got, a repeated name counted as often as it is. */
function newFeatures(before: FeatureRow[], after: FeatureRow[]): FeatureRow[] {
  const had = new Map<string, number>()
  for (const f of before) had.set(featureKey(f), (had.get(featureKey(f)) ?? 0) + 1)
  return after.filter((f) => {
    const left = had.get(featureKey(f)) ?? 0
    if (left === 0) return true
    had.set(featureKey(f), left - 1)
    return false
  })
}

/**
 * What gaining the level asks of the player, from the character before and the draft
 * after. Read again as the draft changes, so a choice made in one step (a subclass, a
 * feat with options) adds to the others.
 */
export function levelUpSteps(
  before: Character,
  after: Character,
  level: Pick<LevelUp, 'classIndex' | 'from' | 'to'>,
  deps: DeriveDeps,
): LevelUpSteps {
  const was = collectSources(before, deps)
  const is = collectSources(after, deps)
  const row = after.classes[level.classIndex]
  const key = `${row.name}|${row.source}`
  const loaded = deps.classByKey.get(key)

  const unlock = loaded ? subclassUnlockLevel(loaded) : 0
  const subclass =
    !!loaded &&
    level.from < unlock &&
    level.to >= unlock &&
    subclassesFor(loaded).some((s) => after.selectedBooks.includes(s.source))

  const slotsBefore = new Set(was.summary.slots.map((s) => s.slot.id))
  const featSlots = is.summary.slots
    .map((s) => s.slot.id)
    .filter((id) => !slotsBefore.has(id))

  const castersOf = (sources: Sources) =>
    characterCasters(sources.character, deps.classByKey, sources.summary.abilityBonus)
  const casterBefore = castersOf(was).find((c) => sameCaster(c, key))
  const casterAfter = castersOf(is).find((c) => sameCaster(c, key))
  const swap =
    !!casterBefore &&
    !!casterAfter &&
    (casterAfter.kind === 'known' || casterAfter.changes === 'level')
  const grown = !!casterAfter && allowance(casterBefore) !== allowance(casterAfter)
  const grantsBefore = new Set(cardGrants(was, deps).map((g) => g.id))
  const brought = cardGrants(is, deps).filter((g) => !grantsBefore.has(g.id))
  const grantIds = brought.map((g) => g.id)
  const spells =
    grown || swap || brought.some((g) => g.pick)
      ? { ...(grown || swap ? { classKey: key } : {}), swap, grantIds }
      : null

  const countBefore = new Map(optionCards(was, deps).map((c) => [c.tag, c.count]))
  const options = optionCards(is, deps)
    .filter((c) => c.count > (countBefore.get(c.tag) ?? 0))
    .map((c) => c.tag)

  const features = newFeatures(
    featureRows(was, deps.optionCatalog),
    featureRows(is, deps.optionCatalog),
  )

  return { subclass, featSlots, spells, options, features }
}
