// The hit dice of a character: for each die size, how many there are, with a line for each
// class that gives them (one die per class level).

import type { Character } from '../character/model'
import { levelDice } from '../character/hp'
import type { LoadedClass } from '../data/class'
import { quantity, type Line, type Quantity } from './types'

export interface HitDie {
  faces: number
  /** How many hit dice of this size, one line for each class that gives them. */
  count: Quantity
}

export function hitDice(
  character: Character,
  classByKey: Map<string, LoadedClass>,
): HitDie[] {
  const dice = levelDice(character, classByKey)
  const sizes = [...new Set(dice.map((d) => d.faces))].sort((a, b) => b - a)
  return sizes.map((faces) => {
    const lines: Line[] = character.classes.flatMap((row, index): Line[] => {
      const levels = dice.filter(
        (d) => d.classIndex === index && d.faces === faces,
      ).length
      if (levels === 0) return []
      return [
        {
          id: `hitdie|${faces}|${row.name}|${row.source}`,
          label: `${row.name} ${levels}`,
          source: {
            kind: 'class',
            tag: `class:${row.name}|${row.source}`,
            label: row.name,
          },
          amount: levels,
          op: 'base',
          status: 'applied',
          how: `${levels} levels, one d${faces} each`,
        },
      ]
    })
    return { faces, count: quantity(lines) }
  })
}
