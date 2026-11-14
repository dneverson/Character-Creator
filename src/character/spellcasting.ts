// Bridge a character's classes to the spellcasting rules: resolve each class's
// spellcasting-ability modifier and classify it as a caster. Kept out of the
// component for reuse/testing.

import { abilityMod, type AbilityKey } from '../dice/dice'
import { classCaster, type ClassCaster } from '../rules/spellcasting'
import { subclassOf, type LoadedClass } from '../data/class'
import type { Character } from './model'
import { characterAbilityTotals } from './derive'

/**
 * The character's spellcasting classes (excludes non-casters), in class order.
 * `featBonus` carries the ability increases from feats.
 */
export function characterCasters(
  character: Character,
  classByKey: Map<string, LoadedClass>,
  featBonus: Partial<Record<AbilityKey, number>> = {},
): ClassCaster[] {
  const totals = characterAbilityTotals(character, featBonus)
  const out: ClassCaster[] = []
  for (const c of character.classes) {
    const lc = classByKey.get(`${c.name}|${c.source}`)
    if (!lc) continue
    const subclass = subclassOf(lc, c.subclass)
    // A casting subclass (Eldritch Knight) brings its own ability; the class has none.
    const castingSource = subclass?.casterProgression ? subclass : lc.entry
    const ability = castingSource.spellcastingAbility as AbilityKey | undefined
    const mod = ability ? abilityMod(totals[ability]) : 0
    const caster = classCaster({
      entry: lc.entry,
      level: c.level,
      abilityMod: mod,
      subclass,
    })
    if (caster.kind !== 'none') out.push(caster)
  }
  return out
}
