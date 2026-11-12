// The senses a character has, each a Quantity of its range in feet. A species and a feat
// give a sense outright (the largest range is used; the others show as not used); a bonus
// sense (Keenness of the Stone Giant) adds to it.

import { SENSE_RULES } from '../rules/senseRules'
import { titleCase } from '../text/titleCase'
import { heldBy, type Sources } from './sources'
import { quantity, type Line, type Quantity, type SourceRef } from './types'

export interface SenseRow {
  key: string
  label: string
  range: Quantity
}

interface Given {
  sense: string
  range: number
  source: SourceRef
  bonus: boolean
  label: string
  text?: string
}

/** The sense blocks of the data ({ darkvision: 60 }) as ranges. */
function ranges(blocks: unknown[] | undefined): [string, number][] {
  return (blocks ?? [])
    .flatMap((block) => (block && typeof block === 'object' ? Object.entries(block) : []))
    .filter((e): e is [string, number] => typeof e[1] === 'number')
}

function givenSenses(sources: Sources): Given[] {
  const given: Given[] = []
  const race = sources.race
  if (race) {
    const source: SourceRef = { kind: 'race', tag: 'race', label: race.name }
    const own: [string, number | undefined][] = [
      ['darkvision', race.darkvision],
      ['blindsight', race.blindsight],
    ]
    for (const [sense, range] of own) {
      if (range) given.push({ sense, range, source, bonus: false, label: race.name })
    }
  }
  for (const { feat, source } of sources.feats) {
    for (const [sense, range] of ranges(feat.senses)) {
      given.push({ sense, range, source, bonus: false, label: feat.label })
    }
    for (const [sense, range] of ranges(feat.bonusSenses)) {
      given.push({ sense, range, source, bonus: true, label: feat.label })
    }
  }
  for (const rule of SENSE_RULES) {
    const held = heldBy(sources, rule.holder)
    if (!held) continue
    given.push({
      sense: rule.sense,
      range: rule.range,
      source: held.source,
      bonus: false,
      label: rule.label,
      text: rule.text,
    })
  }
  return given
}

export function senseRows(sources: Sources): SenseRow[] {
  const given = givenSenses(sources)
  return [...new Set(given.map((g) => g.sense))].map((sense) => {
    const ofSense = given.filter((g) => g.sense === sense)
    const best = Math.max(0, ...ofSense.filter((g) => !g.bonus).map((g) => g.range))
    let used = false
    const lines = ofSense.map((g, i): Line => {
      const base = {
        id: `sense|${sense}|${i}`,
        label: g.label,
        source: g.source,
        amount: g.range,
        ...(g.text ? { text: g.text } : {}),
      }
      if (g.bonus) return { ...base, op: 'add', status: 'applied' }
      if (g.range === best && !used) {
        used = true
        return { ...base, op: 'base', status: 'applied' }
      }
      return {
        ...base,
        op: 'base',
        status: 'inactive',
        why: 'A larger range of the same sense is used.',
      }
    })
    return { key: sense, label: titleCase(sense), range: quantity(lines) }
  })
}
