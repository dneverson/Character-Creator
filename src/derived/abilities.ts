// Each ability score as a Quantity: the lines it adds up from (the assigned score, the
// species and background increases, each feat or Ability Score Improvement, and what the
// player added by hand). The total is the one `characterAbilityBreakdown` works out. A
// species or background increase the origin does not allow still counts, under a flag.

import { ABILITIES, ABILITY_NAMES, type AbilityKey } from '../dice/dice'
import { characterAbilityBreakdown } from '../character/derive'
import type { Character } from '../character/model'
import { checkOriginIncreases } from '../rules/compliance'
import type { Sources } from './sources'
import { BASE_SOURCE, quantity, type Line, type Quantity, type SourceRef } from './types'

const MANUAL: SourceRef = { kind: 'manual', tag: 'manual', label: '' }

export function abilityQuantities(
  character: Character,
  sources: Sources,
): Record<AbilityKey, Quantity> {
  const breakdown = characterAbilityBreakdown(character, sources.summary.abilityBonus)
  const raceSource: SourceRef = {
    kind: 'race',
    tag: 'race',
    label: sources.race?.name ?? 'Species',
  }
  const backgroundSource: SourceRef = {
    kind: 'background',
    tag: 'background',
    label: sources.background?.name ?? 'Background',
  }
  const deviations = checkOriginIncreases(character, sources.race, sources.background)
  return Object.fromEntries(
    ABILITIES.map((key) => {
      const row = breakdown[key]
      const name = ABILITY_NAMES[key]
      const lines: Line[] = [
        {
          id: `ability|${key}|base`,
          label: 'Base score',
          source: BASE_SOURCE,
          amount: row.base ?? 0,
          op: 'base',
          status: 'applied',
        },
      ]
      const add = (id: string, label: string, source: SourceRef, amount: number) => {
        if (amount === 0) return
        lines.push({
          id: `ability|${key}|${id}`,
          label,
          source,
          amount,
          op: 'add',
          status: 'applied',
        })
      }
      const race = character.race
      add(
        'race',
        'Species',
        raceSource,
        (race?.abilityFixed[key] ?? 0) + (race?.abilityChoices[key] ?? 0),
      )
      add(
        'background',
        'Background',
        backgroundSource,
        character.background?.abilityChoices[key] ?? 0,
      )
      for (const slot of sources.summary.slots) {
        const amount = slot.increases[key] ?? 0
        const label = slot.feat?.label ?? 'Ability Score Improvement'
        add(
          `slot|${slot.slot.id}`,
          slot.slot.label,
          { kind: 'feat', tag: `feat:${slot.slot.id}`, label },
          amount,
        )
      }
      add('other', `Other ${name} bonus`, MANUAL, row.other)
      for (const d of deviations) {
        if (!d.abilities?.includes(key)) continue
        const species = d.id.endsWith(':race')
        lines.push({
          id: `ability|${key}|${d.id}`,
          label: species ? 'Species' : 'Background',
          source: species ? raceSource : backgroundSource,
          amount: 0,
          op: 'note',
          status: 'flag',
          why: d.message,
        })
      }
      return [key, quantity(lines)]
    }),
  ) as Record<AbilityKey, Quantity>
}
