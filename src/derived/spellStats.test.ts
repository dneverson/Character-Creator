import { describe, expect, it } from 'vitest'
import { deriveSheet } from '.'
import { createCharacter } from '../character/model'
import { build, deps, loadedClass, stack } from '../test/derivedFixtures'
import { makeItem } from '../test/itemFixtures'

function caster(name: string, ability: string) {
  const l = loadedClass(name, [], [])
  l.entry.spellcastingAbility = ability
  l.entry.casterProgression = 'full'
  l.entry.cantripProgression = [3]
  return l
}

describe('spell save DC and spell attack', () => {
  it('works out each casting class from its own ability', () => {
    const wizard = caster('Wizard', 'int')
    const cleric = caster('Cleric', 'wis')
    const c = createCharacter('Multi')
    c.classes = [
      { name: 'Wizard', source: 'PHB', level: 3 },
      { name: 'Cleric', source: 'PHB', level: 2 },
    ]
    c.abilities = {
      ...c.abilities,
      int: { base: 16, other: 0 },
      wis: { base: 14, other: 0 },
    }
    const sheet = deriveSheet(c, deps([wizard, cleric]))
    const [w, cl] = sheet.spellStats
    expect(sheet.prof.value).toBe(3)
    expect(w.from).toBe('Wizard')
    expect(w.dc.value).toBe(8 + 3 + 3)
    expect(w.attack.value).toBe(3 + 3)
    expect(cl.from).toBe('Cleric')
    expect(cl.dc.value).toBe(8 + 3 + 2)
  })

  it('adds the bonus of a held item and greys it when not attuned', () => {
    const wizard = caster('Wizard', 'int')
    const rod = makeItem({
      name: 'Rod of the Pact Keeper',
      kind: 'gear',
      bonuses: [
        { what: 'spell attack', value: '+1' },
        { what: 'spell save DC', value: '+1' },
      ],
      attunement: { required: true, optional: false, classes: [] },
    })
    const c = build('Wizard', 1, { int: 16 }, [
      { ...stack('Rod of the Pact Keeper'), attuned: false },
    ])
    const off = deriveSheet(c, deps([wizard], [rod]))
    expect(off.spellStats[0].dc.value).toBe(8 + 2 + 3)
    expect(off.spellStats[0].dc.lines.some((l) => l.status === 'inactive')).toBe(true)
    c.equipment.items = [{ ...stack('Rod of the Pact Keeper'), attuned: true }]
    const on = deriveSheet(c, deps([wizard], [rod]))
    expect(on.spellStats[0].dc.value).toBe(8 + 2 + 3 + 1)
    expect(on.spellStats[0].attack.value).toBe(2 + 3 + 1)
  })

  it('has no spell rows for a character who casts nothing', () => {
    expect(deriveSheet(build('Fighter', 1, {}, []), deps([])).spellStats).toEqual([])
  })
})
