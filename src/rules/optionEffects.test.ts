// The option effects table on its own, and every option of the books against it in
// `.local/data` (skipped without it): each option whose text states a number or a grant
// the sheet models is applied by a rules table or a data field, or is excused with why;
// the rest the player applies in play, and the option tables say so.

import { describe, expect, it, vi } from 'vitest'
import { loadClassOptions, type ClassOption } from '../data/classOptions'
import { optionApplied, optionAppliedParts } from '../derived/classOptions'
import { dataDir, records, recordId, textOf as recordText } from '../test/dataAudit'
import { styleAppliedFor } from './fightingStyles'
import { holderId } from './holder'
import {
  EFFECT_ITEM_PICKS,
  OPTION_EFFECTS,
  OPTION_EFFECTS_IN_PLAY,
  stepAt,
} from './optionEffects'

vi.mock('./../data/dataClient', async () => {
  const { readFileSync } = await import('node:fs')
  return {
    fetchData: (path: string): Promise<unknown> =>
      Promise.resolve(JSON.parse(readFileSync(`.local/data/${path}`, 'utf8'))),
  }
})

describe('the option effects table', () => {
  it('has one row for each option, and each row does something', () => {
    const ids = OPTION_EFFECTS.map((r) => holderId(r.holder))
    expect(new Set(ids).size).toBe(ids.length)
    for (const rule of OPTION_EFFECTS) {
      expect(rule.effects.length, rule.label).toBeGreaterThan(0)
      expect(rule.text.startsWith(`${rule.label}:`), rule.label).toBe(true)
    }
  })

  it('reads an amount by level from its steps', () => {
    const steps = [
      [1, 1],
      [10, 2],
    ] as const
    expect([0, 1, 9, 10, 20].map((l) => stepAt(steps, l))).toEqual([0, 1, 1, 2, 2])
  })

  it('picks an item for every effect that is on one', () => {
    const picked = new Set(EFFECT_ITEM_PICKS.map((r) => r.option))
    for (const rule of OPTION_EFFECTS) {
      const key = 'option' in rule.holder ? rule.holder.option : ''
      const onInfused = rule.effects.some((e) => 'item' in e && e.item === 'infused')
      if (onInfused) expect(picked.has(key), key).toBe(true)
    }
  })

  it('never excuses an option it applies', () => {
    const applied = OPTION_EFFECTS.map((r) =>
      'option' in r.holder ? r.holder.option : '',
    )
    expect(applied.filter((k) => k in OPTION_EFFECTS_IN_PLAY)).toEqual([])
  })
})

/**
 * Text that states a number or a grant the sheet models: a bonus to an attack, damage,
 * armor class or spell attack; an ability modifier added to a roll; a proficiency; a
 * sense; a speed; a spell cast without a slot; advantage on a check, initiative or a
 * saving throw; a superiority die; the hit point maximum.
 */
const MODELLED = [
  /\+\d+ bonus to|bonus to (?:its |your )?(?:AC|Armor Class|attack|damage|spell attack)/i,
  /\badd(?:s|ing)? your \w+ modifier to\b/i,
  /extra \w+ damage equal to your \w+ modifier/i,
  /\b(?:gain|have) proficiency (?:in|with)\b|\byou are proficient with\b/i,
  /darkvision|see normally in|blindsight|truesight|tremorsense/i,
  /(?:walking|swimming|flying|climbing|burrowing) speed|(?:Swim|Fly|Climb|Burrow) Speed|speed increases/i,
  /\bcast [\w ]+ (?:at will|without expending a spell slot)/i,
  /advantage on (?:\w+ \([\w ]+\) (?:checks?|or)|initiative|[\w ]*saving throws?)/i,
  /superiority die/i,
  /hit point maximum/i,
]

describe.skipIf(!dataDir)('every option against the effects it states', async () => {
  const catalog: ClassOption[] = dataDir ? await loadClassOptions() : []
  const text = new Map(
    records(dataDir ?? '')
      .filter(({ collection }) => collection === 'optionalfeature')
      .map(({ collection, record }) => [
        recordId(collection, record),
        recordText(record),
      ]),
  )
  const textOf = (o: ClassOption) => text.get(holderId({ option: o.key })) ?? ''

  it('has every option of the tables in the data', () => {
    const keys = new Set(catalog.map((o) => o.key))
    const named = [
      ...OPTION_EFFECTS.map((r) => ('option' in r.holder ? r.holder.option : '')),
      ...EFFECT_ITEM_PICKS.map((r) => r.option),
      ...Object.keys(OPTION_EFFECTS_IN_PLAY),
    ]
    expect(named.filter((k) => !keys.has(k))).toEqual([])
  })

  it('applies, or excuses with why, every option whose text states what the sheet models', () => {
    const tally = { style: 0, applied: 0, excused: 0, play: 0 }
    const missing: string[] = []
    const stale: string[] = []
    for (const option of catalog) {
      const modelled = MODELLED.some((re) => re.test(textOf(option)))
      if (styleAppliedFor({ option: option.key })) tally.style++
      else if (optionAppliedParts(option).length > 0) tally.applied++
      else if (option.key in OPTION_EFFECTS_IN_PLAY) tally.excused++
      else if (modelled) missing.push(option.key)
      else tally.play++
      if (option.key in OPTION_EFFECTS_IN_PLAY && !modelled) stale.push(option.key)
    }
    expect(missing).toEqual([])
    expect(stale).toEqual([])
    // Every option of the books is one of the four, in the books of this writing.
    expect(tally.style + tally.applied + tally.excused + tally.play).toBe(catalog.length)
    expect(tally).toEqual({ style: 13, applied: 148, excused: 5, play: 67 })
  })

  it('tells the truth in the "In this app" column: in play only when nothing applies it', () => {
    for (const option of catalog) {
      const said = optionApplied(option)
      const applies =
        styleAppliedFor({ option: option.key }) !== undefined ||
        optionAppliedParts(option).length > 0
      if (!applies) expect(said, option.key).toMatch(/^You apply it in play/)
      else if (!styleAppliedFor({ option: option.key }))
        expect(said, option.key).toMatch(/^Automatic: /)
    }
  })
})
