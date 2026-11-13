import { describe, expect, it } from 'vitest'
import { dataDir, records, textOf, type Rec } from '../test/dataAudit'
import { exhaustionEffects, PLAY_RULES } from './playRules'

describe('play rules', () => {
  it('names inspiration and the printing of the conditions per edition', () => {
    expect(PLAY_RULES.classic.inspiration).toBe('Inspiration')
    expect(PLAY_RULES.one.inspiration).toBe('Heroic Inspiration')
    expect(PLAY_RULES.classic.conditionSource).toBe('PHB')
    expect(PLAY_RULES.one.conditionSource).toBe('XPHB')
  })

  it('lists the 2014 effects level by level, each level with the ones below it', () => {
    expect(exhaustionEffects('classic', 0)).toEqual([])
    expect(exhaustionEffects('classic', 2)).toEqual([
      'Disadvantage on ability checks',
      'Speed halved',
    ])
    expect(exhaustionEffects('classic', 6)).toHaveLength(6)
  })

  it('takes 2 off d20 tests and 5 feet off speed for each 2024 level, and dies at 6', () => {
    expect(exhaustionEffects('one', 3)).toEqual(['D20 Tests: -6', 'Speed: -15 ft.'])
    expect(exhaustionEffects('one', 6)).toEqual(['Death'])
    expect(exhaustionEffects('one', 0)).toEqual([])
  })

  it('lists the conditions that make the speed 0 per edition', () => {
    const names = (edition: 'classic' | 'one') =>
      PLAY_RULES[edition].speedZero.map((r) => r.condition)
    expect(names('classic')).toContain('Stunned')
    expect(names('one')).not.toContain('Stunned')
    expect(names('one')).toEqual([
      'Grappled',
      'Paralyzed',
      'Petrified',
      'Restrained',
      'Unconscious',
    ])
  })
})

describe.skipIf(!dataDir)('play rules against the data', () => {
  const conditions = records(dataDir ?? '').filter((r) => r.collection === 'condition')
  const find = (name: string, source: string): Rec | undefined =>
    conditions.find((r) => r.record.name === name && r.record.source === source)?.record

  it('has the conditions in the printing each edition names', () => {
    for (const rules of Object.values(PLAY_RULES)) {
      const names = conditions
        .filter((r) => r.record.source === rules.conditionSource)
        .map((r) => String(r.record.name))
      expect(names).toContain('Exhaustion')
      expect(names).toContain('Prone')
      expect(names.length).toBe(15)
    }
  })

  it('matches the 2014 exhaustion table row for row', () => {
    const rule = PLAY_RULES.classic.exhaustion
    const entry = find('Exhaustion', 'PHB')
    const entries = Array.isArray(entry?.entries) ? (entry.entries as unknown[]) : []
    const table = entries.find(
      (e): e is { rows: string[][] } =>
        typeof e === 'object' && e !== null && 'rows' in e,
    )
    expect(rule.kind).toBe('levels')
    expect(table).toBeDefined()
    expect(table ? table.rows.map((row) => row[1]) : []).toEqual(
      rule.kind === 'levels' ? rule.effects : [],
    )
  })

  it('matches the 2024 exhaustion text: 2 times and 5 times the level, death at 6', () => {
    const rule = PLAY_RULES.one.exhaustion
    const text = textOf(find('Exhaustion', 'XPHB') ?? {})
    expect(rule.kind).toBe('perLevel')
    if (rule.kind !== 'perLevel') return
    expect(text).toContain(`reduced by ${rule.d20Test} times your Exhaustion level`)
    expect(text).toContain(`equal to ${rule.speedFeet} times your Exhaustion level`)
    expect(text).toContain(`if your Exhaustion level is ${rule.deathAt}`)
  })

  it('changes the 2014 numbers at the levels the table names', () => {
    const rule = PLAY_RULES.classic.exhaustion
    expect(rule.kind).toBe('levels')
    if (rule.kind !== 'levels') return
    expect(rule.effects[rule.speedHalvedAt - 1]).toBe('Speed halved')
    expect(rule.effects[rule.hpMaxHalvedAt - 1]).toBe('Hit point maximum halved')
    expect(rule.effects[rule.speedZeroAt - 1]).toBe('Speed reduced to 0')
  })

  it('stops exactly the conditions whose text makes the speed 0, in each printing', () => {
    const STOPS = /Speed is 0 and can't increase|speed becomes 0|can't move/i
    for (const rules of Object.values(PLAY_RULES)) {
      const stopping = conditions
        .filter((r) => r.record.source === rules.conditionSource)
        .filter((r) => STOPS.test(textOf(r.record)))
        .map((r) => String(r.record.name))
        .sort()
      expect(rules.speedZero.map((r) => r.condition)).toEqual(stopping)
      for (const { condition, text } of rules.speedZero) {
        expect(textOf(find(condition, rules.conditionSource) ?? {})).toContain(text)
      }
    }
  })
})
