import { describe, expect, it } from 'vitest'
import { pickCards, otherOptions, strayPicks } from './pickCards'
import { pickOptions, ownKinds } from './pickOptions'
import { proficiencies } from './proficiencies'
import { collectSources } from './sources'
import { readGrant } from '../data/grants'
import { createCharacter } from '../character/model'
import { clearPicks, picksCharged, togglePick } from '../character/picks'
import type { PlayableBackground } from '../data/background'
import { WIZARD, deps, featOf } from '../test/derivedFixtures'
import { makeItem } from '../test/itemFixtures'

const meleeWeapon = (name: string, category: 'simple' | 'martial', property: string) =>
  makeItem({
    name,
    kind: 'weapon',
    weapon: {
      category,
      melee: true,
      damageTypes: [],
      properties: [{ code: property, name: property, rule: '', label: property }],
      mastery: [],
    },
  })

const catalog = {
  languages: [
    { name: 'Dwarvish', entries: [{ source: 'PHB', type: 'standard' }] },
    {
      name: 'Draconic',
      entries: [
        { source: 'PHB', type: 'exotic' },
        { source: 'XPHB', type: 'standard' },
      ],
    },
    { name: 'Abyssal', entries: [{ source: 'XPHB', type: 'rare' }] },
    { name: 'Druidic', entries: [{ source: 'PHB', type: 'secret' }] },
  ],
  items: [
    makeItem({ name: "Smith's Tools", kind: 'tool', type: 'AT' }),
    makeItem({ name: 'Dice Set', kind: 'tool', type: 'GS' }),
    makeItem({ name: 'Lute', kind: 'instrument', type: 'INS' }),
    makeItem({ name: 'Herbalism Kit', kind: 'tool', type: 'T' }),
    makeItem({ name: '+1 Rapier', kind: 'weapon', magic: true }),
    meleeWeapon('Rapier', 'martial', 'F'),
    meleeWeapon('Club', 'simple', 'L'),
  ],
}

const background = (extra: Partial<PlayableBackground>): PlayableBackground => ({
  key: 'x|phb',
  name: 'Sage',
  source: 'PHB',
  abilityOptions: [],
  featGrants: [],
  storyTables: [],
  entries: [],
  ...extra,
})

const wizard = () => {
  const c = createCharacter('W')
  c.classes = [{ name: 'Wizard', source: 'PHB', level: 1 }]
  return c
}

describe('pickOptions', () => {
  const spec = (blocks: unknown[], kind: Parameters<typeof readGrant>[1]) =>
    readGrant(blocks, kind).alternatives[0].picks[0]

  it('offers the standard languages for a standard pick and not the secret ones', () => {
    const standard = pickOptions(spec([{ anyStandard: 1 }], 'language'), catalog)
    expect(standard.map((o) => o.label)).toEqual(['Draconic', 'Dwarvish'])
    const exotic = pickOptions(spec([{ anyExotic: 1 }], 'language'), catalog)
    expect(exotic.map((o) => o.label)).toEqual(['Abyssal', 'Draconic'])
    const all = pickOptions(spec([{ anyLanguage: 1 }], 'language'), catalog)
    expect(all.map((o) => o.label)).not.toContain('Druidic')
  })

  it('offers the tools of the kind the pick names', () => {
    expect(
      pickOptions(spec([{ anyArtisansTool: 1 }], 'tool'), catalog).map((o) => o.label),
    ).toEqual(["Smith's Tools"])
    expect(
      pickOptions(spec([{ anyMusicalInstrument: 1 }], 'tool'), catalog).map(
        (o) => o.label,
      ),
    ).toEqual(['Lute'])
    expect(
      pickOptions(spec([{ anyTool: 1 }], 'tool'), catalog).map((o) => o.label),
    ).toEqual(['Dice Set', 'Herbalism Kit', 'Lute', "Smith's Tools"])
  })

  it('offers the values a pick names, then the weapons a filter allows', () => {
    const named = pickOptions(
      spec([{ choose: { from: ['rapier', 'club'] } }], 'weapon'),
      catalog,
    )
    expect(named.map((o) => o.value)).toEqual(['club', 'rapier'])
    const finesse = pickOptions(
      spec(
        [{ choose: { fromFilter: 'type=martial weapon|property=finesse' } }],
        'weapon',
      ),
      catalog,
    )
    expect(finesse.map((o) => o.label)).toEqual(['Rapier'])
  })

  it('offers only what the books of the character print', () => {
    const books = { ...catalog, books: ['PHB'] }
    expect(
      pickOptions(spec([{ anyStandard: 1 }], 'language'), books).map((o) => o.label),
    ).toEqual(['Dwarvish'])
    expect(
      pickOptions(spec([{ anyExotic: 1 }], 'language'), books).map((o) => o.label),
    ).toEqual(['Draconic'])
    expect(
      pickOptions(spec([{ anyTool: 1 }], 'tool'), { ...catalog, books: ['XPHB'] }),
    ).toEqual([])
  })

  it('offers each kind of armor for an armor pick and nothing for an "other" language', () => {
    expect(pickOptions(spec([{ anyArmor: 1 }], 'armor'), catalog)).toHaveLength(4)
    expect(pickOptions(spec([{ other: true }], 'language'), catalog)).toEqual([])
  })

  it('keeps out of a mixed pick the kinds other cards show', () => {
    expect(ownKinds(['skill', 'tool'])).toEqual(['tool'])
    expect(ownKinds(['mixed', 'language'])).toEqual(['language'])
  })
})

describe('pickCards', () => {
  const sources = (bg: Partial<PlayableBackground>) => ({
    ...collectSources(wizard(), deps([WIZARD])),
    background: background(bg),
  })
  const cardsFor = (bg: Partial<PlayableBackground>, picks = {}) => {
    const s = sources(bg)
    const choices = { picks }
    return pickCards(s, choices, catalog, proficiencies(s, choices).listing)
  }

  it('makes a card of a pick with its list, its budget and what is left', () => {
    const [card] = cardsFor({ languageProficiencies: [{ anyStandard: 2 }] })
    expect(card).toMatchObject({
      tag: 'bg',
      label: 'Background · Sage',
      noun: 'languages',
      count: 2,
      used: 0,
      left: 2,
    })
    expect(card.chips.map((c) => [c.label, c.state])).toEqual([
      ['Draconic', 'available'],
      ['Dwarvish', 'available'],
    ])
  })

  it('marks a pick, a full card and a value taken from another source', () => {
    const [card] = cardsFor(
      { languageProficiencies: [{ anyStandard: 1 }] },
      { language: { dwarvish: 'bg' } },
    )
    expect(card).toMatchObject({ used: 1, left: 0, picks: ['dwarvish'] })
    expect(card.chips.map((c) => c.state)).toEqual(['full', 'picked'])

    const taken = cardsFor(
      {
        languageProficiencies: [{ anyStandard: 1 }],
        toolProficiencies: [{ anyTool: 1 }],
      },
      { tool: { 'dice set': 'bg' }, language: {} },
    )
    expect(taken).toHaveLength(2)
    const other = pickCards(
      { ...sources({ languageProficiencies: [{ anyStandard: 1 }] }) },
      { picks: { language: { dwarvish: 'race' } } },
      catalog,
      {
        armor: [],
        weapon: [],
        tool: [],
        save: [],
        language: [
          {
            value: 'Dwarvish',
            sources: [{ kind: 'race', tag: 'race', label: 'Dwarf' }],
          },
        ],
      },
    )
    expect(other[0].chips.find((c) => c.label === 'Dwarvish')).toMatchObject({
      state: 'taken',
      takenBy: 'Dwarf',
    })
  })

  it('flags a card with more picks than it grants', () => {
    const [card] = cardsFor(
      { languageProficiencies: [{ anyStandard: 1 }] },
      { language: { dwarvish: 'bg', draconic: 'bg' } },
    )
    expect(card).toMatchObject({ over: true, left: 0 })
  })

  it('shares the budget of a mixed pick with its skills', () => {
    const skilled = {
      ...featOf('Skilled', 'XPHB'),
      skillToolLanguageProficiencies: [
        { choose: [{ from: ['anySkill', 'anyTool'], count: 3 }] },
      ],
    }
    const base = collectSources(wizard(), deps([WIZARD]))
    const source = { kind: 'feat' as const, tag: 'feat:slot', label: 'Skilled' }
    const s = { ...base, feats: [{ feat: skilled, source }] }
    const choices = {
      picks: { skill: { arcana: 'feat:slot' }, tool: { lute: 'feat:slot' } },
    }
    const [card] = pickCards(s, choices, catalog, proficiencies(s, choices).listing)
    expect(card).toMatchObject({ kinds: ['tool'], count: 3, used: 2, left: 1 })
    expect(card.note).toBe('Shared with your skill picks, in Skills.')
    expect(picksCharged(choices.picks, 'feat:slot', ['skill', 'tool'])).toBe(2)
  })

  it('makes no card for the saving throw of Resilient', () => {
    const resilient = {
      ...featOf('Resilient', 'PHB'),
      savingThrowProficiencies: [{ choose: { from: ['str', 'dex'] } }],
    }
    const base = collectSources(wizard(), deps([WIZARD]))
    const s = {
      ...base,
      feats: [
        { feat: resilient, source: { kind: 'feat' as const, tag: 'feat:a', label: 'R' } },
      ],
    }
    expect(pickCards(s, {}, catalog, proficiencies(s).listing)).toEqual([])
  })
})

describe('the Other panel', () => {
  it('offers everything of a kind and finds the picks no source owns', () => {
    expect(otherOptions('language', catalog).length).toBeGreaterThan(0)
    expect(otherOptions('armor', catalog)).toHaveLength(4)
    const stray = strayPicks(
      { picks: { language: { elvish: 'manual', sylvan: 'gone', common: 'race' } } },
      'language',
      new Set(['race']),
    )
    expect(stray).toEqual([
      { value: 'elvish', tag: 'manual', orphan: false },
      { value: 'sylvan', tag: 'gone', orphan: true },
    ])
  })
})

describe('picks', () => {
  it('places a value, takes it back, and clears what a source paid for', () => {
    const placed = togglePick({}, 'tool', 'lute', 'bg')
    expect(placed).toEqual({ tool: { lute: 'bg' } })
    expect(togglePick(placed, 'tool', 'lute', 'bg')).toEqual({ tool: {} })
    const both = togglePick(placed, 'tool', 'flute', 'race')
    expect(clearPicks(both, 'bg', ['tool', 'language'])).toEqual({
      tool: { flute: 'race' },
    })
  })
})
