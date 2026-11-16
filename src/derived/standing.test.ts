import { describe, expect, it } from 'vitest'
import { deriveSheet } from '.'
import type { PlayableRace } from '../data/race'
import { build, deps, FIGHTER, ITEMS, loadedClass, stack } from '../test/derivedFixtures'
import { makeItem } from '../test/itemFixtures'

const dwarf: PlayableRace = {
  key: 'dwarf|phb',
  name: 'Dwarf',
  baseName: 'Dwarf',
  source: 'PHB',
  baseSource: 'PHB',
  speed: 25,
  abilityOptions: [],
  featGrants: [],
}

const barbarian = loadedClass('Barbarian', [], [], {
  classFeature: [
    { name: 'Rage', level: 1 },
    { name: 'Danger Sense', level: 2 },
  ].map(({ name, level }) => ({
    name,
    source: 'PHB',
    className: 'Barbarian',
    classSource: 'PHB',
    level,
    entries: [],
  })),
})

const MANTLE = makeItem({
  name: 'Mantle of Spell Resistance',
  source: 'DMG',
  magic: true,
  attunement: { required: true, optional: false, classes: [] },
})

describe('standing notes on saves and checks', () => {
  it('note the advantage a species has on a save, beside the bonus and not in it', () => {
    const c = build('Fighter', 1, { con: 14 }, [])
    const con = deriveSheet(c, { ...deps([FIGHTER]), race: dwarf }).saves.con.total
    expect(con.lines).toContainEqual(
      expect.objectContaining({
        label: 'Dwarf',
        op: 'note',
        how: 'Advantage on the saving throw',
        when: 'against poison',
        status: 'conditional',
      }),
    )
    expect(con.value).toBe(2)
  })

  it('note a class feature on the saves and the skills it covers, in its case', () => {
    const c = build('Barbarian', 2, {}, [])
    const sheet = deriveSheet(c, deps([barbarian]))
    expect(sheet.saves.dex.total.lines).toContainEqual(
      expect.objectContaining({
        label: 'Danger Sense',
        how: 'Advantage on the saving throw',
        when: 'against effects that you can see',
      }),
    )
    const athletics = sheet.skills.find((s) => s.key === 'athletics')
    expect(athletics?.total.lines).toContainEqual(
      expect.objectContaining({ label: 'Rage', how: 'Advantage on the check' }),
    )
    expect(sheet.skills.find((s) => s.key === 'stealth')?.total.lines).not.toContainEqual(
      expect.objectContaining({ label: 'Rage' }),
    )
  })

  it('show an item note greyed until the item is attuned', () => {
    const lines = (attuned: boolean) =>
      deriveSheet(
        build('Fighter', 1, {}, [
          stack('Mantle of Spell Resistance', { source: 'DMG', attuned }),
        ]),
        deps([FIGHTER], [...ITEMS, MANTLE]),
      ).saves.wis.total.lines.filter((l) => l.label === 'Mantle of Spell Resistance')
    expect(lines(true)[0]).toMatchObject({
      status: 'conditional',
      when: 'against spells',
    })
    expect(lines(false)[0]).toMatchObject({
      status: 'inactive',
      why: 'Needs attunement, and you are not attuned.',
    })
  })

  it('note disadvantage on Stealth in the armor that hampers it, from the armor class', () => {
    const stealth = (item: string) =>
      deriveSheet(
        build('Fighter', 1, { str: 15 }, [stack(item)]),
        deps([FIGHTER]),
      ).skills.find((s) => s.key === 'stealth')?.total
    expect(stealth('Plate Armor')?.lines).toContainEqual(
      expect.objectContaining({
        id: 'skill|stealth|armor',
        op: 'note',
        how: 'Disadvantage on the check',
      }),
    )
    expect(stealth('Leather Armor')?.lines.map((l) => l.id)).not.toContain(
      'skill|stealth|armor',
    )
  })
})
