import { describe, expect, it } from 'vitest'
import { deriveSheet, sameBuild } from '.'
import { build, FIGHTER, WIZARD, deps } from '../test/derivedFixtures'
import { makeItem } from '../test/itemFixtures'

describe('deriveSheet picks', () => {
  const guild = {
    key: 'g|phb',
    name: 'Guild Artisan',
    source: 'PHB',
    abilityOptions: [],
    featGrants: [],
    storyTables: [],
    entries: [],
    toolProficiencies: [{ anyArtisansTool: 1 }],
    languageProficiencies: [{ anyStandard: 2 }],
  }
  const withData = () => ({
    ...deps([FIGHTER, WIZARD]),
    background: guild,
    items: [makeItem({ name: "Smith's Tools", kind: 'tool', type: 'AT' })],
    languages: [
      { name: 'Dwarvish', entries: [{ source: 'PHB', type: 'standard' }] },
      { name: 'Elvish', entries: [{ source: 'PHB', type: 'standard' }] },
    ],
  })

  it('counts the picks left and builds the cards from the picks stored', () => {
    const c = build('Fighter', 1, {}, [])
    c.background = { name: 'Guild Artisan', source: 'PHB', abilityChoices: {} }
    const open = deriveSheet(c, withData())
    expect(open.choicesOpen).toBe(3)
    expect(open.picks.map((p) => p.noun)).toEqual(['languages', 'tools'])
    expect(open.grantTags).toContain('bg')

    c.grantPicks = { language: { dwarvish: 'bg' }, tool: { "smith's tools": 'bg' } }
    const some = deriveSheet(c, withData())
    expect(some.choicesOpen).toBe(1)
    expect(some.proficiencies.listing.tool[0].value).toBe("Smith's Tools")
  })

  it('lists the alternatives and optional grants a source has', () => {
    const fighter = { ...FIGHTER, entry: { ...FIGHTER.entry } }
    fighter.entry.startingProficiencies = {
      ...fighter.entry.startingProficiencies,
      toolProficiencies: [{ "smith's tools": true }, { "mason's tools": true }],
      weaponProficiencies: [{ proficiency: 'firearms', optional: true }],
    }
    const c = build('Fighter', 1, {}, [])
    const sheet = deriveSheet(c, deps([fighter]))
    expect(sheet.alternatives).toMatchObject([
      {
        id: 'class:Fighter|PHB|toolProficiencies',
        options: ["Smith's Tools", "Mason's Tools"],
        chosen: 0,
      },
    ])
    expect(sheet.optionals).toMatchObject([{ text: 'Firearms', on: false }])
  })
})

describe('sameBuild', () => {
  it('holds across play, history, favorites and portrait, not a build change', () => {
    const c = build('Fighter', 1, {}, [])
    expect(sameBuild(c, c)).toBe(true)
    const played = {
      ...c,
      play: { ...c.play, tempHp: 5 },
      history: [],
      favorites: [],
      portrait: 'data:',
      updatedAt: c.updatedAt + 1,
    }
    expect(sameBuild(c, played)).toBe(true)
    expect(sameBuild(c, { ...c, name: 'Other' })).toBe(false)
    expect(sameBuild(c, { ...c, play: { ...c.play, masteryAtRest: {} } })).toBe(false)
    // A field only one of them has is a change too.
    expect(sameBuild({ ...c, completedAt: 1 }, { ...c, completedAt: undefined })).toBe(
      false,
    )
  })
})
