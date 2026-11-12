// Spell slots as the sheet and the PDF read them: the slots of the classes' progressions,
// the Pact Magic slots, and the combined caster level a multiclass character's table is
// found by, with a line for each class that adds to it.

import type { Character } from '../character/model'
import { characterCasters } from '../character/spellcasting'
import type { LoadedClass } from '../data/class'
import {
  casterLevelContribution,
  spellSlots,
  type ClassCaster,
  type SpellSlots,
} from '../rules/spellcasting'
import type { Sources } from './sources'
import { quantity, type Line, type Quantity } from './types'

export interface DerivedSlots extends SpellSlots {
  /** The spellcasting classes, in class order. */
  casters: ClassCaster[]
  /**
   * The combined spellcaster level of a multiclass character, a line for each class that
   * adds to it. With one spellcasting class that class's own table is used, so the lines
   * show and add nothing.
   */
  casterLevel: Quantity
}

export function deriveSlots(
  character: Character,
  classByKey: Map<string, LoadedClass>,
  sources: Sources,
): DerivedSlots {
  const casters = characterCasters(character, classByKey, sources.summary.abilityBonus)
  const adding = casters.filter((c) => c.progression !== 'none' && !c.isPact)
  const combined = adding.length > 1
  const lines = adding.map((c): Line => ({
    id: `slots|${c.classKey}`,
    label: c.name,
    source: { kind: 'class', tag: `class:${c.classKey}`, label: c.name },
    amount: casterLevelContribution(c.progression, c.level),
    op: 'add',
    how: `${c.name} ${c.level}, ${progressionText(c.progression)}`,
    ...(combined
      ? { status: 'applied' as const }
      : {
          status: 'inactive' as const,
          why: 'One spellcasting class: its own table is used.',
        }),
  }))
  return { ...spellSlots(casters), casters, casterLevel: quantity(lines) }
}

const progressionText = (progression: string) =>
  progression === 'full'
    ? 'all levels'
    : progression === '1/2'
      ? 'half the levels, rounded down'
      : progression === '1/3'
        ? 'a third of the levels, rounded down'
        : 'half the levels, rounded up'
