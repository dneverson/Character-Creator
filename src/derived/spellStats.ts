// Spell save DC and spell attack bonus, one row for each spellcasting ability the
// character casts with: each casting class, and each ability a species, feat or
// background gives its own spells. Armor the character is not proficient with stops
// spellcasting, which is said beside the numbers and never enforced.

import { ABILITY_NAMES, abilityMod, formatMod, type AbilityKey } from '../dice/dice'
import { characterCasters } from '../character/spellcasting'
import { resolveSpellGrants } from '../character/spellGrants'
import type { AbilityTotals } from './armorClass'
import { itemBonus } from './itemBonus'
import type { DeriveDeps, Sources } from './sources'
import { BASE_SOURCE, quantity, type Line, type Quantity } from './types'

export interface SpellStatRow {
  id: string
  /** What casts with this ability: "Cleric", "Fey Touched". */
  from: string
  ability: AbilityKey
  dc: Quantity
  attack: Quantity
}

const line = (
  id: string,
  label: string,
  amount: number,
  extra: Partial<Line> = {},
): Line => ({
  id,
  label,
  source: BASE_SOURCE,
  amount,
  op: 'add',
  status: 'applied',
  ...extra,
})

function itemLines(
  sources: Sources,
  id: string,
  field: 'bonusSpellSaveDc' | 'bonusSpellAttack',
) {
  return sources.items.flatMap((held) => {
    const amount = itemBonus(held.item, field)
    if (amount === 0) return []
    return [
      line(`${id}|${held.item.key}`, held.item.name, amount, {
        source: held.source,
        ...(held.active
          ? {}
          : { status: 'inactive', why: 'Needs attunement, and you are not attuned.' }),
      }),
    ]
  })
}

function row(
  sources: Sources,
  totals: AbilityTotals,
  prof: number,
  armorFlags: readonly Line[],
  id: string,
  from: string,
  ability: AbilityKey,
): SpellStatRow {
  const mod = abilityMod(totals[ability])
  const abilityLine = (suffix: string) =>
    line(`${id}|${suffix}|ability`, ABILITY_NAMES[ability], mod, {
      how: `Your ${ABILITY_NAMES[ability]} modifier, ${formatMod(mod)}`,
    })
  const profLine = (suffix: string) =>
    line(`${id}|${suffix}|prof`, 'Proficiency bonus', prof)
  const flags = armorFlags.map((l) => ({ ...l, id: `${id}|${l.id}` }))
  return {
    id,
    from,
    ability,
    dc: quantity([
      { ...line(`${id}|dc|base`, 'Base', 8), op: 'base' },
      profLine('dc'),
      abilityLine('dc'),
      ...itemLines(sources, `${id}|dc|item`, 'bonusSpellSaveDc'),
      ...flags,
    ]),
    attack: quantity([
      profLine('attack'),
      abilityLine('attack'),
      ...itemLines(sources, `${id}|attack|item`, 'bonusSpellAttack'),
      ...flags,
    ]),
  }
}

export function spellStats(
  sources: Sources,
  deps: DeriveDeps,
  totals: AbilityTotals,
  prof: number,
  acLines: readonly Line[],
): SpellStatRow[] {
  const { character, summary } = sources
  const armorFlags = acLines.filter(
    (l) => l.id.endsWith('-proficiency') && l.status === 'flag',
  )
  const make = (id: string, from: string, ability: AbilityKey) =>
    row(sources, totals, prof, armorFlags, id, from, ability)

  const rows: SpellStatRow[] = []
  for (const caster of characterCasters(
    character,
    deps.classByKey,
    summary.abilityBonus,
  )) {
    if (caster.ability)
      rows.push(make(`spell|class|${caster.classKey}`, caster.name, caster.ability))
  }

  const { grants } = resolveSpellGrants(character, {
    race: deps.race,
    background: deps.background,
    featSlots: summary.slots,
    classByKey: deps.classByKey,
  })
  const seen = new Set<string>()
  for (const grant of grants) {
    const a = grant.ability
    if (!a || a.kind === 'inherit' || grant.locked) continue
    const ability =
      a.kind === 'fixed'
        ? a.key
        : (() => {
            const picked = grant.abilityId
              ? character.spellGrants[grant.abilityId]?.ability
              : undefined
            return picked && a.keys.includes(picked) ? picked : undefined
          })()
    if (!ability) continue
    const key = `${grant.sourceId}|${ability}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push(make(`spell|grant|${key}`, grant.from, ability))
  }
  return rows
}
