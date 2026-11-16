import { describe, expect, it } from 'vitest'
import { deriveSheet } from '.'
import type { PlayableRace } from '../data/race'
import { build, deps, loadedClass, stack } from '../test/derivedFixtures'
import { makeItem } from '../test/itemFixtures'

const race = (extra: Partial<PlayableRace> = {}): PlayableRace => ({
  key: 'dwarf|phb',
  name: 'Dwarf',
  baseName: 'Dwarf',
  source: 'PHB',
  baseSource: 'PHB',
  speed: 25,
  abilityOptions: [],
  featGrants: [],
  ...extra,
})

const RAGER = loadedClass('Barbarian', [], [], {
  classFeature: [
    {
      name: 'Rage',
      source: 'PHB',
      className: 'Barbarian',
      classSource: 'PHB',
      level: 1,
      entries: [],
    },
  ],
})

const RING = makeItem({
  name: 'Ring of Fire Warding',
  kind: 'wondrous',
  magic: true,
  attunement: { required: true, optional: false, classes: [] },
  defenses: { resist: ['fire', 'poison'], condition: ['frightened'] },
})

const sheetOf = (
  extra: Partial<PlayableRace> | null,
  items = [RING],
  className = 'Fighter',
) => {
  const c = build(className, 1, {}, [])
  c.equipment.items = items.map((i) => stack(i.name, { attuned: true }))
  return { c, d: { ...deps([RAGER], items), ...(extra ? { race: race(extra) } : {}) } }
}

describe('defenses', () => {
  it('list what a species gives, each as a row that names its source', () => {
    const { c, d } = sheetOf({ resist: ['poison'], conditionImmune: ['charmed'] }, [])
    const rows = deriveSheet(c, d).defenses
    expect(rows.map((r) => [r.kind, r.label])).toEqual([
      ['resist', 'Poison'],
      ['condition', 'Charmed'],
    ])
    expect(rows[0].held.value).toBe(1)
    expect(rows[0].held.lines[0]).toMatchObject({
      label: 'Dwarf',
      text: 'Resistance to poison damage',
    })
  })

  it('give an item defense only while it is worn, and attuned when it needs it', () => {
    const { c, d } = sheetOf(null)
    expect(deriveSheet(c, d).defenses.map((r) => r.key)).toEqual([
      'resist|fire',
      'resist|poison',
      'condition|frightened',
    ])
    c.equipment.items = [stack(RING.name, { attuned: false })]
    expect(deriveSheet(c, d).defenses).toEqual([])
    c.equipment.items = [stack(RING.name, { attuned: true, equipped: false })]
    expect(deriveSheet(c, d).defenses).toEqual([])
  })

  it('count one defense once and show the other source as not stacking', () => {
    const { c, d } = sheetOf({ resist: ['poison'] })
    const poison = deriveSheet(c, d).defenses.find((r) => r.key === 'resist|poison')
    expect(poison?.held.value).toBe(1)
    expect(poison?.held.lines.map((l) => [l.label, l.how])).toEqual([
      ['Dwarf', undefined],
      ['Ring of Fire Warding', 'Does not stack'],
    ])
  })

  it('show a defense under a condition as conditional, with the reason', () => {
    const { c, d } = sheetOf(null, [], 'Barbarian')
    const rows = deriveSheet(c, d).defenses
    const slashing = rows.find((r) => r.key === 'resist|slashing')
    expect(slashing?.held.value).toBe(0)
    expect(slashing?.conditional).toBe('Only while your Rage is active.')
  })

  it('list a type the player picks once picked, and not before', () => {
    const { c, d } = sheetOf({ resist: [{ choose: { from: ['cold', 'fire'] } }] }, [])
    expect(deriveSheet(c, d).defenses.map((r) => r.key)).not.toContain('resist|cold')
    c.grantPicks = { resist: { cold: 'race' } }
    const row = deriveSheet(c, d).defenses.find((r) => r.key === 'resist|cold')
    expect(row?.held.value).toBe(1)
  })

  it('offer the pick as a card of the race', () => {
    const { c, d } = sheetOf({ resist: [{ choose: { from: ['cold', 'fire'] } }] }, [])
    const sheet = deriveSheet(c, d)
    expect(sheet.picks.map((p) => [p.tag, p.noun, p.count])).toEqual([
      ['race', 'damage resistances', 1],
    ])
  })

  it('have none when nothing gives one', () => {
    const c = build('Fighter', 1, {}, [])
    expect(deriveSheet(c, deps([])).defenses).toEqual([])
  })
})
