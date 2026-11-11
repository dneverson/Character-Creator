import { describe, expect, it } from 'vitest'
import {
  grantSets,
  grantText,
  grantValues,
  listedGrants,
  matchesFilter,
  parseSpellFilter,
  spellGrants,
  type GrantKind,
} from './grants'
import { SKILLS } from './skills'
import { listsOf, makeSpell } from '../test/spellFixtures'

describe('parseSpellFilter and matchesFilter', () => {
  it('reads each key of the data language, in any case', () => {
    expect(
      parseSpellFilter(
        'level=0;1|class=Cleric;wizard|school=d;E|Components & Miscellaneous=ritual|spell attack=m;r;o|source=xphb',
      ),
    ).toEqual({
      levels: [0, 1],
      classes: ['Cleric', 'wizard'],
      schools: ['D', 'E'],
      ritual: true,
      attacks: ['m', 'r', 'o'],
      sources: ['XPHB'],
    })
    expect(parseSpellFilter('')).toEqual({
      levels: [],
      classes: [],
      schools: [],
      ritual: false,
      attacks: [],
      sources: [],
    })
  })

  it('offers what every part of the filter allows', () => {
    const cure = makeSpell({
      name: 'Cure Wounds',
      level: 1,
      school: 'V',
      lists: listsOf('Cleric|PHB', 'Cleric|XPHB'),
    })
    const bolt = makeSpell({
      name: 'Ray of Frost',
      level: 0,
      attack: 'Ranged',
      lists: listsOf('Wizard|PHB'),
    })
    const owl = makeSpell({ name: 'Find Familiar', ritual: true, school: 'C' })
    expect(matchesFilter(cure, parseSpellFilter('level=1|class=cleric'))).toBe(true)
    expect(matchesFilter(cure, parseSpellFilter('level=0|class=Cleric'))).toBe(false)
    expect(matchesFilter(cure, parseSpellFilter('level=1|class=Wizard'))).toBe(false)
    expect(matchesFilter(cure, parseSpellFilter('school=V;E'))).toBe(true)
    expect(matchesFilter(cure, parseSpellFilter('school=A'))).toBe(false)
    expect(matchesFilter(bolt, parseSpellFilter('spell attack=m;r;o'))).toBe(true)
    expect(matchesFilter(cure, parseSpellFilter('spell attack=m;r;o'))).toBe(false)
    expect(
      matchesFilter(owl, parseSpellFilter('components & miscellaneous=ritual')),
    ).toBe(true)
    expect(
      matchesFilter(cure, parseSpellFilter('components & miscellaneous=ritual')),
    ).toBe(false)
    expect(matchesFilter(cure, parseSpellFilter('source=PHB'))).toBe(true)
    expect(matchesFilter(cure, parseSpellFilter('source=XPHB'))).toBe(false)
    expect(matchesFilter(cure, parseSpellFilter(''))).toBe(true)
  })

  it('reads a class list from the edition of the grant', () => {
    const only2014 = makeSpell({ name: 'Acid Splash', lists: listsOf('Wizard|PHB') })
    const filter = parseSpellFilter('class=Wizard')
    expect(matchesFilter(only2014, filter, 'classic')).toBe(true)
    expect(matchesFilter(only2014, filter, 'one')).toBe(false)
    expect(matchesFilter(only2014, filter)).toBe(true)
    const optional = makeSpell({
      name: 'Booming Blade',
      source: 'TCE',
      lists: { classes: [], variants: { 'Wizard|PHB': ['TCE'] }, subclasses: [] },
    })
    expect(matchesFilter(optional, filter, 'classic')).toBe(true)
  })
})

const label = (blocks: unknown[] | undefined, kind: GrantKind) =>
  grantText(grantSets(blocks, kind))

describe('grantSets', () => {
  it('names what is granted outright', () => {
    expect(label([{ common: true, 'deep speech': true }], 'language')).toBe(
      'Common, Deep Speech',
    )
    expect(label([{ "thieves' tools": true }], 'tool')).toBe("Thieves' Tools")
  })

  it('counts what is the player’s to choose', () => {
    expect(label([{ common: true, anyStandard: 1 }], 'language')).toBe(
      'Common, 1 standard language of your choice',
    )
    expect(label([{ any: 2 }], 'language')).toBe('2 languages of your choice')
    expect(label([{ anyArtisansTool: 1, anyMusicalInstrument: 2 }], 'tool')).toBe(
      "1 set of artisan's tools of your choice, 2 musical instruments of your choice",
    )
    expect(label([{ common: true, other: true }], 'language')).toBe('Common, 1 other')
  })

  it('lists a choice between named things', () => {
    expect(
      label([{ choose: { from: ['elvish', 'giant', 'other'], count: 2 } }], 'language'),
    ).toBe('2 of Elvish, Giant, Other')
    expect(
      label([{ choose: { from: ['anyArtisansTool', "navigator's tools"] } }], 'tool'),
    ).toBe("1 of Set of Artisan's Tools, Navigator's Tools")
  })

  it('reads a kind of tool named plainly as one of that kind of the player’s choice', () => {
    expect(label([{ 'gaming set': true }], 'tool')).toBe('1 gaming set of your choice')
    expect(
      label([{ choose: { from: ['musical instrument', 'gaming set'] } }], 'tool'),
    ).toBe('1 musical instrument or gaming set of your choice')
    expect(
      label([{ choose: { from: ['anyArtisansTool', 'musical instrument'] } }], 'tool'),
    ).toBe("1 set of artisan's tools or musical instrument of your choice")
    expect(label([{ "artisan's tools": true }], 'mixed')).toBe(
      "1 set of artisan's tools of your choice",
    )
    // Beside a named tool it is still one of the list.
    expect(
      label(
        [
          {
            choose: {
              from: ['gaming set', 'musical instrument', "thieves' tools"],
              count: 2,
            },
          },
        ],
        'tool',
      ),
    ).toBe("2 of Gaming Set, Musical Instrument, Thieves' Tools")
  })

  it('reads the tools races grant as before', () => {
    expect(
      label(
        [{ choose: { from: ["smith's tools", "brewer's supplies", "mason's tools"] } }],
        'tool',
      ),
    ).toBe("1 of Smith's Tools, Brewer's Supplies, Mason's Tools")
    expect(label([{ anyMusicalInstrument: 1, "thieves' tools": true }], 'tool')).toBe(
      "Thieves' Tools, 1 musical instrument of your choice",
    )
    // Only a tool is read as a kind of tool.
    expect(label([{ 'gaming set': true }], 'language')).toBe('Gaming Set')
  })

  it('reads a free choice between kinds as one choice', () => {
    expect(
      label([{ choose: [{ from: ['anySkill', 'anyTool'], count: 2 }] }], 'mixed'),
    ).toBe('2 skills or tools of your choice')
    expect(label([{ choose: [{ from: ['anySkill', 'anyTool'] }] }], 'mixed')).toBe(
      '1 skill or tool of your choice',
    )
    expect(label([{ anyLanguage: 1, anyTool: 1 }], 'mixed')).toBe(
      '1 language of your choice, 1 tool of your choice',
    )
  })

  it('names weapons without their source, and weapon and armor groups in full', () => {
    expect(label([{ 'longsword|phb': true, 'hand crossbow|phb': true }], 'weapon')).toBe(
      'Longsword, Hand Crossbow',
    )
    expect(label([{ martial: true, firearms: true }], 'weapon')).toBe(
      'Martial weapons, Firearms',
    )
    expect(label([{ light: true, medium: true, shield: true }], 'armor')).toBe(
      'Light armor, Medium armor, Shields',
    )
  })

  it('reads a choice the data filters from its item list by kind', () => {
    expect(
      label(
        [
          {
            choose: { fromFilter: 'type=martial weapon|miscellaneous=mundane', count: 2 },
          },
        ],
        'weapon',
      ),
    ).toBe('2 martial weapons of your choice')
    expect(label([{ choose: { fromFilter: 'type=simple weapon' } }], 'weapon')).toBe(
      '1 simple weapon of your choice',
    )
    expect(
      label(
        [
          {
            choose: {
              fromFilter: 'type=martial weapon;mundane weapon|miscellaneous=mundane',
              count: 4,
            },
          },
        ],
        'weapon',
      ),
    ).toBe('4 simple or martial weapons of your choice')
    expect(label([{ choose: { fromFilter: 'rarity=none' } }], 'weapon')).toBe(
      '1 weapon of your choice',
    )
  })

  it('words a free choice with the noun of its kind', () => {
    expect(label([{ any: 1 }], 'skill')).toBe('1 skill of your choice')
    expect(label([{ any: 1 }], 'tool')).toBe('1 tool of your choice')
    expect(label([{ any: 1 }], 'weapon')).toBe('1 weapon of your choice')
    expect(label([{ any: 1 }], 'armor')).toBe('1 armor of your choice')
    // A grant of mixed kinds has no one noun to give.
    expect(label([{ any: 1 }], 'mixed')).toBe('1 of your choice')
  })

  it('reads expertise, naming a skill the character is proficient in', () => {
    expect(label([{ anyProficientSkill: 1 }], 'expertise')).toBe(
      '1 skill you are proficient in',
    )
    expect(label([{ anyProficientSkill: 2 }], 'expertise')).toBe(
      '2 skills you are proficient in',
    )
    expect(label([{ 'sleight of hand': true }], 'expertise')).toBe('Sleight of Hand')
  })

  it('names saving throws in full, and any one as a free choice', () => {
    expect(label([{ con: true }], 'save')).toBe('Constitution')
    expect(
      label([{ choose: { from: ['str', 'dex', 'con', 'int', 'wis', 'cha'] } }], 'save'),
    ).toBe('1 saving throw of your choice')
    expect(label([{ choose: { from: ['str', 'dex'] } }], 'save')).toBe(
      '1 of Strength, Dexterity',
    )
  })

  it('names improvised weapons', () => {
    expect(label([{ improvised: true }], 'weapon')).toBe('Improvised weapons')
  })

  it('reads every skill as one', () => {
    const all = Object.fromEntries(SKILLS.map((s) => [s.key, true]))
    expect(label([all], 'skill')).toBe('Every skill')
    expect(label([all], 'expertise')).toBe('Every skill')
    expect(label([{ arcana: true }], 'skill')).toBe('Arcana')
  })

  it('uses the skill names', () => {
    expect(label([{ 'sleight of hand': true, any: 1 }], 'skill')).toBe(
      'Sleight of Hand, 1 skill of your choice',
    )
  })

  it('joins alternatives with "or"', () => {
    expect(label([{ dwarvish: true }, { anyStandard: 1 }], 'language')).toBe(
      'Dwarvish or 1 standard language of your choice',
    )
  })

  it('grants nothing for what it cannot read', () => {
    expect(grantSets(undefined, 'language')).toEqual([])
    expect(
      grantSets(
        [null, 'common', {}, { common: false, any: true, choose: 'x' }],
        'language',
      ),
    ).toEqual([])
    expect(
      grantSets([{ choose: { from: [] } }, { choose: { count: 2 } }], 'tool'),
    ).toEqual([])
  })
})

describe('listedGrants', () => {
  it('names each item, and words a choice between them', () => {
    expect(
      grantText(listedGrants(['poison', { choose: { from: ['acid', 'cold', 'fire'] } }])),
    ).toBe('Poison, 1 of Acid, Cold, Fire')
  })

  it('is nothing for an empty or unreadable list', () => {
    expect(listedGrants(undefined)).toEqual([])
    expect(listedGrants([null, 3])).toEqual([])
  })
})

describe('spellGrants', () => {
  it('names the spells wherever the data keeps them, once each', () => {
    const sets = spellGrants([
      {
        innate: {
          '3': { daily: { '1': ['faerie fire|xphb'] } },
          '5': { daily: { '1': ['darkness|xphb'] } },
        },
        ability: { choose: ['int', 'wis', 'cha'] },
        known: { '1': ['dancing lights|xphb#c'] },
      },
      { known: { '1': ['dancing lights#c'] } },
    ])
    expect(grantText(sets)).toBe('Faerie Fire, Darkness, Dancing Lights')
  })

  it('says so when a spell is the player’s to choose', () => {
    const sets = spellGrants([
      { known: { '1': { _: [{ choose: 'level=0|class=Wizard' }] } } },
      { known: { '1': { _: [{ choose: 'level=0|class=Druid' }] } } },
    ])
    expect(grantText(sets)).toBe('1 Wizard cantrip, 1 Druid cantrip')
  })

  it('words a chosen spell from its filter', () => {
    const choose = (filter: string, count?: number) =>
      grantText(spellGrants([{ known: { _: [{ choose: filter, count }] } }]))
    expect(choose('level=1|school=D;E')).toBe('1 level 1 Divination or Enchantment spell')
    expect(choose('level=1|school=V')).toBe('1 level 1 Evocation spell')
    expect(choose('level=0|class=Wizard', 2)).toBe('2 Wizard cantrips')
    expect(choose('level=1|class=druid;wizard')).toBe('1 level 1 Druid or Wizard spell')
    expect(choose('level=1|components & miscellaneous=ritual')).toBe(
      '1 level 1 ritual spell',
    )
    expect(choose('level=0;1;2;3|class=Cleric')).toBe('1 level 0 to 3 Cleric spell')
    expect(choose('level=2;2')).toBe('1 level 2 spell')
    expect(choose('school=X')).toBe('1 X spell')
    expect(grantText(spellGrants([{ known: { _: [{ choose: ['a'] }] } }]))).toBe(
      'Spell of your choice',
    )
  })

  it('reads only the places asked for', () => {
    const blocks = [
      {
        innate: { '1': ['misty step'] },
        known: { '1': ['light#c'] },
        prepared: { '1': ['bless'] },
        expanded: { s1: ['shield', 'sleep'] },
      },
    ]
    expect(grantText(spellGrants(blocks, ['known', 'innate', 'prepared']))).toBe(
      'Misty Step, Light, Bless',
    )
    expect(grantText(spellGrants(blocks, ['expanded']))).toBe('Shield, Sleep')
    expect(grantText(spellGrants(blocks))).toBe('Misty Step, Light, Bless, Shield, Sleep')
  })

  it('is nothing without spells', () => {
    expect(spellGrants(undefined)).toEqual([])
    expect(spellGrants([null, { ability: 'int' }, { innate: { '1': [''] } }])).toEqual([])
  })
})

describe('grantValues', () => {
  it('offers each thing given once, and one value for any choice', () => {
    const sets = grantSets(
      [
        { common: true, elvish: true },
        { common: true, anyStandard: 1 },
      ],
      'language',
    )
    expect(grantValues(sets)).toEqual(['Common', 'Elvish', 'Choice'])
    expect(grantValues([])).toEqual([])
  })
})
