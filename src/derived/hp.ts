// Hit points on the shared shape: the breakdown of character/hp.ts (the hit dice, the
// Constitution modifier, every rule and the manual lines) as the lines of one Quantity.
// The arithmetic stays in hp.ts; this only names each part so the same table can show it.

import { formatMod } from '../dice/dice'
import type { HpBreakdown, HpDiceLine } from '../character/hp'
import type { Character } from '../character/model'
import type { HpLine } from '../rules/hpSources'
import { BASE_SOURCE, quantity, type Line, type Quantity, type SourceRef } from './types'

const levelRange = (from: number, to: number) =>
  from === to ? `level ${from}` : `levels ${from}-${to}`

const ruleSource = (line: HpLine): SourceRef => ({
  kind: line.origin === 'Feat' ? 'feat' : line.origin === 'Race' ? 'race' : 'subclass',
  tag: `${line.origin.toLowerCase()}:${line.id}`,
  label: line.source,
})

/** The lines of one class row's hit dice: the maximum first level, then the rest. */
function diceLines(d: HpDiceLine, rolled: boolean): Line[] {
  const lines: Line[] = []
  const die = `${d.className} d${d.faces}`
  const base = { source: BASE_SOURCE, op: 'base', status: 'applied' } as const
  if (d.hasFirst) {
    lines.push({
      ...base,
      id: `hp|dice|${d.classIndex}|first`,
      label: 'Hit dice, level 1',
      how: `${die}, maximum`,
      amount: d.faces,
    })
  }
  if (d.averaged > 0) {
    const first = d.hasFirst ? d.faces : 0
    const rolledTotal = d.rolledTotal === undefined ? 0 : d.rolledTotal - first
    lines.push({
      ...base,
      id: `hp|dice|${d.classIndex}|rest`,
      label: `Hit dice, ${levelRange(d.fromLevel + (d.hasFirst ? 1 : 0), d.toLevel)}`,
      how: `${die}, ${rolled ? 'rolled' : `average ${d.average} x ${d.averaged}`}`,
      amount: rolled ? rolledTotal : d.averageTotal - first,
    })
  }
  return lines
}

export const HP_MANUAL_PER_LEVEL = 'hp|manual|perLevel'
export const HP_MANUAL_FLAT = 'hp|manual|flat'

/** The hit point maximum with its lines, by the rolled or the average method. */
export function hpQuantity(
  character: Character,
  breakdown: HpBreakdown,
  rolled: boolean,
): Quantity {
  const manual: Pick<Line, 'source' | 'op' | 'status' | 'badge'> = {
    source: { kind: 'manual', tag: 'manual', label: '' },
    op: 'add',
    status: 'applied',
    badge: 'Manual',
  }
  const lines: Line[] = [
    ...breakdown.dice.flatMap((d) => diceLines(d, rolled)),
    {
      id: 'hp|constitution',
      label: 'Constitution modifier',
      source: BASE_SOURCE,
      op: 'add',
      status: 'applied',
      how: `${formatMod(breakdown.conMod)} x ${breakdown.totalLevel} levels`,
      amount: breakdown.conTotal,
    },
    ...breakdown.lines.map((line): Line => ({
      id: line.id,
      label: line.label,
      source: ruleSource(line),
      op: 'add',
      status: 'applied',
      text: line.text,
      badge: 'Automatic',
      how:
        line.perLevel !== 0
          ? `${formatMod(line.perLevel)} per ${line.per === 'class' ? 'class ' : ''}level x ${line.levels}`
          : 'Flat',
      amount: line.total,
    })),
    {
      ...manual,
      id: HP_MANUAL_PER_LEVEL,
      label: 'Other bonus per level',
      amount: (character.hp.perLevelBonus || 0) * breakdown.totalLevel,
    },
    {
      ...manual,
      id: HP_MANUAL_FLAT,
      label: 'Flat bonus',
      amount: character.hp.flatBonus || 0,
    },
  ]
  return quantity(lines)
}
