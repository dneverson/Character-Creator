// Each skill's modifier as a Quantity: the ability modifier, the proficiency bonus (with
// the source that grants it), expertise (the bonus a second time), and the half-proficiency
// bonus of Jack of All Trades or Remarkable Athlete where it applies, and an item's bonus
// to ability checks (Stone of Good Luck).

import { abilityMod } from '../dice/dice'
import type { SkillRow, SkillSource } from '../character/skills'
import { halfLines, halfRules, itemCheckLines } from './combat'
import type { AbilityTotals } from './armorClass'
import type { Sources } from './sources'
import { BASE_SOURCE, quantity, type Line, type SourceRef, type Quantity } from './types'

export type DerivedSkill = SkillRow & { total: Quantity }

const MANUAL: SourceRef = { kind: 'manual', tag: 'manual', label: 'Non-standard' }

export function skillTotals(
  rows: SkillRow[],
  skillSources: SkillSource[],
  sources: Sources,
  totals: AbilityTotals,
  prof: number,
  expertise: ReadonlyMap<string, SourceRef>,
): DerivedSkill[] {
  const byTag = new Map(skillSources.map((s) => [s.tag, s]))
  return rows.map((row) => {
    const lines: Line[] = [
      {
        id: `skill|${row.key}|ability`,
        label: 'Ability modifier',
        source: BASE_SOURCE,
        amount: abilityMod(totals[row.ability]),
        op: 'base',
        status: 'applied',
      },
    ]
    if (row.proficient) {
      const found = row.source ? byTag.get(row.source) : undefined
      const source: SourceRef = found
        ? {
            kind: found.kind === 'multiclass' ? 'class' : found.kind,
            tag: found.tag,
            label: found.label,
          }
        : MANUAL
      lines.push({
        id: `skill|${row.key}|proficiency`,
        label: 'Proficiency bonus',
        source,
        amount: prof,
        op: 'add',
        status: 'applied',
      })
      const expert = row.expertise === undefined ? undefined : expertise.get(row.key)
      if (expert) {
        lines.push({
          id: `skill|${row.key}|expertise`,
          label: 'Expertise',
          source: expert,
          amount: prof,
          op: 'add',
          status: 'applied',
          text: 'Expertise counts your proficiency bonus twice.',
        })
      }
    }
    lines.push(
      ...halfLines(
        halfRules(sources, prof, `skill|${row.key}`, row.ability),
        row.proficient,
      ),
      ...itemCheckLines(sources, `skill|${row.key}`),
    )
    return { ...row, total: quantity(lines) }
  })
}
