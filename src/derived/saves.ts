// The six saving throws as Quantities: the ability modifier, the proficiency bonus when a
// source grants the proficiency (the first class, a feat such as Resilient, a feature such
// as Diamond Soul), the bonus of an item that adds to saving throws (a Cloak of
// Protection), and an aura such as Aura of Protection.

import { ABILITIES, ABILITY_NAMES, abilityMod, type AbilityKey } from '../dice/dice'
import { SAVE_RULES } from '../rules/saveRules'
import type { AbilityTotals } from './armorClass'
import { itemBonus } from './itemBonus'
import type { Proficiencies } from './proficiencies'
import { heldBy, type Sources } from './sources'
import { BASE_SOURCE, quantity, type Line, type Quantity } from './types'

export interface SaveRow {
  key: AbilityKey
  label: string
  proficient: boolean
  total: Quantity
}

/** The abilities a saving-throw proficiency is held in, from the listing of the sheet. */
export function saveRows(
  sources: Sources,
  totals: AbilityTotals,
  prof: number,
  known: Proficiencies,
): Record<AbilityKey, SaveRow> {
  const auras = SAVE_RULES.flatMap((rule) => {
    const held = heldBy(sources, rule.holder)
    return held && rule.effect.kind === 'abilityMod'
      ? [{ rule, effect: rule.effect, source: held.source }]
      : []
  })
  return Object.fromEntries(
    ABILITIES.map((key) => {
      const name = ABILITY_NAMES[key]
      const modifier = abilityMod(totals[key])
      const lines: Line[] = [
        {
          id: `save|${key}|ability`,
          label: name,
          source: BASE_SOURCE,
          amount: modifier,
          op: 'base',
          status: 'applied',
        },
      ]
      const given = known.listing.save.find((s) => s.value === name)
      if (given) {
        lines.push({
          id: `save|${key}|proficiency`,
          label: 'Proficiency bonus',
          source: given.sources[0],
          amount: prof,
          op: 'add',
          status: 'applied',
          how: `Proficient, from ${given.sources.map((s) => s.label || 'the class').join(', ')}`,
        })
      }
      for (const held of sources.items) {
        const amount = itemBonus(held.item, 'bonusSavingThrow')
        if (amount === 0) continue
        lines.push({
          id: `save|${key}|item|${held.item.key}`,
          label: held.item.name,
          source: held.source,
          amount,
          op: 'add',
          status: held.active ? 'applied' : 'inactive',
          ...(held.active ? {} : { why: 'Needs attunement, and you are not attuned.' }),
        })
      }
      for (const { rule, effect, source } of auras) {
        lines.push({
          id: `save|${key}|${source.tag}|${rule.label}`,
          label: rule.label,
          source,
          amount: Math.max(effect.min, abilityMod(totals[effect.ability])),
          op: 'add',
          text: rule.text,
          status: 'applied',
        })
      }
      return [
        key,
        { key, label: name, proficient: given !== undefined, total: quantity(lines) },
      ]
    }),
  ) as Record<AbilityKey, SaveRow>
}
