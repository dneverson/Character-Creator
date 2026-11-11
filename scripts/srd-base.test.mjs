import { describe, expect, it } from 'vitest'
import {
  ANY_KIND,
  addVocabulary,
  applyRenames,
  buildBase,
  collectAliases,
  findProblems,
  keptIndex,
  licenseNotice,
  mapText,
  reduceBooks,
  reduceIndex,
  reduceSpellLookup,
  removeDangling,
  renamer,
  selectEntries,
  srdFlag,
  strip,
} from './srd-base.mjs'

const FLAGS = ['srd', 'srd52']
const files = (record) => new Map(Object.entries(record))

describe('srdFlag', () => {
  it('names the flag an entry carries', () => {
    expect(srdFlag({ name: 'Fireball', srd: true }, FLAGS)).toBe('srd')
    expect(srdFlag({ name: 'Fireball', srd52: 'Fire Ball' }, FLAGS)).toBe('srd52')
  })

  it('reads the flag a magic item variant passes on', () => {
    expect(srdFlag({ name: '+1 Weapon', inherits: { srd52: true } }, FLAGS)).toBe('srd52')
  })

  it('is undefined for an entry no SRD covers, and for anything that is not an entry', () => {
    expect(srdFlag({ name: 'Booming Blade', basicRules: true }, FLAGS)).toBeUndefined()
    expect(srdFlag({ name: 'Silvery Barbs', srd: false }, FLAGS)).toBeUndefined()
    expect(srdFlag('Fireball', FLAGS)).toBeUndefined()
    expect(srdFlag(null, FLAGS)).toBeUndefined()
  })
})

describe('selectEntries', () => {
  const full = files({
    'spells/spells-phb.json': {
      _meta: { internalCopies: ['spell'] },
      spell: [
        { name: 'Fireball', source: 'PHB', srd: true },
        { name: 'Hex', source: 'PHB' },
      ],
    },
    'spells/spells-xge.json': { spell: [{ name: 'Shadow Blade', source: 'XGE' }] },
    'magicvariants.json': {
      magicvariant: [{ name: '+1 Weapon', inherits: { source: 'DMG', srd: true } }],
      linkedLootTables: { DMG: {} },
    },
    'list.json': ['not', 'an', 'object'],
  })

  it('keeps the flagged entries of the top-level arrays and nothing else', () => {
    const base = selectEntries(full, FLAGS)
    expect([...base.keys()]).toEqual(['spells/spells-phb.json', 'magicvariants.json'])
    expect(base.get('spells/spells-phb.json')).toEqual({
      spell: [{ name: 'Fireball', source: 'PHB', srd: true }],
    })
    expect(Object.keys(base.get('magicvariants.json'))).toEqual(['magicvariant'])
  })

  it('copies the entries, so later changes leave the full data alone', () => {
    const base = selectEntries(full, FLAGS)
    base.get('spells/spells-phb.json').spell[0].name = 'Changed'
    expect(full.get('spells/spells-phb.json').spell[0].name).toBe('Fireball')
  })
})

describe('addVocabulary', () => {
  const full = files({
    'items-base.json': {
      baseitem: [
        {
          name: 'Longsword',
          source: 'PHB',
          srd: true,
          type: 'M',
          property: ['V', { uid: '2H|XPHB', note: 'unless mounted' }],
        },
      ],
      itemProperty: [
        { abbreviation: 'V', source: 'PHB', entries: ['Versatile text'] },
        { abbreviation: '2H', source: 'XPHB', entries: ['Two-handed text'] },
        { abbreviation: '2H', source: 'PHB', entries: ['Not used'] },
      ],
      itemType: [
        {
          name: 'Melee Weapon',
          abbreviation: 'M',
          source: 'PHB',
          page: 149,
          entries: ['The book describes melee weapons here.'],
          _copy: { abbreviation: 'R', source: 'PHB' },
        },
        { name: 'Ranged Weapon', abbreviation: 'R', source: 'PHB' },
        { name: 'Potion', abbreviation: 'P', source: 'DMG' },
      ],
      itemEntry: [
        { name: 'Potion of Resistance', source: 'DMG', entriesTemplate: ['Shared text'] },
        { name: 'Potion of Resistance', source: 'XDMG', entriesTemplate: ['Newer text'] },
        { name: 'Absorbing Tattoo', source: 'TCE', entriesTemplate: ['Not used'] },
      ],
    },
    'items.json': {
      item: [
        {
          name: 'Potion of Fire Resistance',
          source: 'DMG',
          srd: true,
          type: 'P|DMG',
          entries: ['{#itemEntry Potion of Resistance}'],
        },
        {
          name: 'Potion of Fire Resistance',
          source: 'XDMG',
          srd52: true,
          entries: ['{#itemEntry Potion of Resistance|XDMG}'],
        },
      ],
    },
  })

  it('keeps the properties, types and shared text that kept items use', () => {
    const base = selectEntries(full, FLAGS)
    addVocabulary(base, full)
    const kept = base.get('items-base.json')
    expect(kept.itemProperty.map((p) => `${p.abbreviation}|${p.source}`)).toEqual([
      'V|PHB',
      '2H|XPHB',
    ])
    expect(kept.itemProperty[0].entries).toEqual(['Versatile text'])
    expect(kept.itemEntry.map((e) => `${e.name}|${e.source}`)).toEqual([
      'Potion of Resistance|DMG',
      'Potion of Resistance|XDMG',
    ])
  })

  it('keeps a type as a name only, without the book text that describes it', () => {
    const base = selectEntries(full, FLAGS)
    addVocabulary(base, full)
    expect(base.get('items-base.json').itemType).toEqual([
      { name: 'Melee Weapon', abbreviation: 'M', source: 'PHB', page: 149 },
      { name: 'Potion', abbreviation: 'P', source: 'DMG' },
    ])
  })

  it('adds nothing when no kept item uses any', () => {
    const none = files({
      'items-base.json': {
        itemType: [{ name: 'Potion', abbreviation: 'P', source: 'DMG' }],
      },
      'spells/spells-phb.json': {
        spell: [{ name: 'Fireball', source: 'PHB', srd: true }],
      },
    })
    const base = selectEntries(none, FLAGS)
    addVocabulary(base, none)
    expect(base.has('items-base.json')).toBe(false)
  })
})

describe('keptIndex', () => {
  const base = new Map([
    [
      'class/class-barbarian.json',
      {
        class: [{ name: 'Barbarian', source: 'PHB' }],
        subclass: [
          {
            name: 'Path of the Berserker',
            shortName: 'Berserker',
            className: 'Barbarian',
            classSource: 'PHB',
            source: 'PHB',
          },
        ],
        classFeature: [
          {
            name: 'Rage',
            className: 'Barbarian',
            classSource: 'PHB',
            level: 1,
            source: 'PHB',
          },
        ],
        subclassFeature: [
          {
            name: 'Frenzy',
            className: 'Barbarian',
            classSource: 'XPHB',
            subclassShortName: 'Berserker',
            subclassSource: 'XPHB',
            level: 3,
            source: 'XPHB',
          },
        ],
      },
    ],
    ['feats.json', { feat: [{ name: 'Grappler', source: 'PHB' }] }],
    [
      'magicvariants.json',
      { magicvariant: [{ name: '+1 Armor', inherits: { source: 'XDMG' } }] },
    ],
    ['items-base.json', { itemProperty: [{ abbreviation: '2H', source: 'XPHB' }] }],
  ])
  const has = keptIndex(base)

  it('fills in what a uid leaves out', () => {
    expect(has('classFeature', 'Rage|Barbarian||1')).toBe(true)
    expect(has('classFeature', 'Rage|Barbarian||1|TCE')).toBe(false)
    expect(has('classFeature', 'Rage|Barbarian||2')).toBe(false)
    expect(has('subclassFeature', 'Frenzy|Barbarian|XPHB|Berserker|XPHB|3')).toBe(true)
    expect(has('subclassFeature', 'Frenzy|Barbarian||Berserker||3')).toBe(false)
    expect(has('feat', 'grappler')).toBe(true)
    expect(has('feat', 'Grappler|XPHB')).toBe(false)
    expect(has('itemProperty', '2H|XPHB')).toBe(true)
  })

  it('finds an entry of any kind by a uid written out in full', () => {
    expect(has(ANY_KIND, 'Grappler|PHB')).toBe(true)
    expect(has(ANY_KIND, 'Berserker|Barbarian|PHB|PHB')).toBe(true)
    // A magic item variant keeps its source under `inherits`.
    expect(has(ANY_KIND, '+1 Armor|XDMG')).toBe(true)
    expect(has(ANY_KIND, 'Grappler|XPHB')).toBe(false)
  })

  it('answers no for a kind with nothing kept and for a uid that is not text', () => {
    expect(has('optionalfeature', 'Archery')).toBe(false)
    expect(has('feat', undefined)).toBe(false)
  })
})

describe('strip', () => {
  it('copies a value without the items and properties picked out', () => {
    const value = { keep: 1, drop: 2, list: ['a', 'x', { drop: 3, keep: ['x', 'b'] }] }
    const out = strip(value, (item, key) => key === 'drop' || item === 'x')
    expect(out).toEqual({ keep: 1, list: ['a', { keep: ['b'] }] })
    expect(value.list).toHaveLength(3)
  })
})

describe('removeDangling', () => {
  const build = () =>
    new Map([
      [
        'class/class-fighter.json',
        {
          class: [
            {
              name: 'Fighter',
              source: 'PHB',
              classFeatures: [
                'Fighting Style|Fighter||1',
                'Martial Versatility|Fighter||4|TCE',
                {
                  classFeature: 'Martial Archetype|Fighter||3',
                  gainSubclassFeature: true,
                },
                { classFeature: 'Unlisted|Fighter||5' },
              ],
            },
            // A class without a feature list is left as it is.
            { name: 'Sidekick', source: 'PHB' },
          ],
          subclass: [
            {
              name: 'Champion',
              shortName: 'Champion',
              className: 'Fighter',
              classSource: 'PHB',
              source: 'PHB',
              subclassFeatures: [
                'Improved Critical|Fighter||Champion||3',
                'Not Kept|Fighter||Champion||7|TCE',
              ],
            },
          ],
          classFeature: [
            {
              name: 'Fighting Style',
              className: 'Fighter',
              classSource: 'PHB',
              level: 1,
              source: 'PHB',
              hasFluffImages: true,
              entries: [
                {
                  type: 'options',
                  entries: [
                    { type: 'refOptionalfeature', optionalfeature: 'Archery' },
                    { type: 'refOptionalfeature', optionalfeature: 'Blind Fighting|TCE' },
                    { type: 'refFeat', feat: 'Blessed Warrior|XPHB' },
                    {
                      type: 'refClassFeature',
                      classFeature: 'Fighting Style|Fighter||1',
                    },
                    { type: 'refClassFeature', classFeature: 'Gone|Fighter||1' },
                    {
                      type: 'refSubclassFeature',
                      subclassFeature: 'Improved Critical|Fighter||Champion||3',
                    },
                    {
                      type: 'image',
                      href: { type: 'internal', path: 'classes/fighter.webp' },
                    },
                    { type: 'gallery', images: [] },
                    'Plain text stays.',
                  ],
                },
              ],
            },
          ],
          subclassFeature: [
            {
              name: 'Improved Critical',
              className: 'Fighter',
              classSource: 'PHB',
              subclassShortName: 'Champion',
              subclassSource: 'PHB',
              level: 3,
              source: 'PHB',
            },
          ],
        },
      ],
      [
        'optionalfeatures.json',
        { optionalfeature: [{ name: 'Archery', source: 'PHB' }] },
      ],
      [
        'items.json',
        {
          item: [
            {
              name: 'Oathbow',
              source: 'DMG',
              hasFluff: true,
              soundClip: { type: 'internal', path: 'items/oathbow.mp3' },
              reprintedAs: [{ uid: 'Oathbow|XDMG', tag: 'item' }, 'Longbow|PHB'],
            },
            { name: 'Longbow', source: 'PHB', reprintedAs: ['Longbow|XPHB'] },
          ],
        },
      ],
      [
        'magicvariants.json',
        {
          magicvariant: [
            {
              name: '+1 Armor',
              inherits: { source: 'DMG', reprintedAs: ['+1 Armor|XDMG', 'Longbow|PHB'] },
            },
          ],
        },
      ],
      [
        'decks.json',
        { card: [{ name: 'Sun', source: 'DMG', face: { type: 'image', href: {} } }] },
      ],
    ])

  it('prunes the feature lists, keeping the marker of the subclass level', () => {
    const base = build()
    const removed = removeDangling(base)
    const { class: classes, subclass } = base.get('class/class-fighter.json')
    expect(classes[0].classFeatures).toEqual([
      'Fighting Style|Fighter||1',
      { classFeature: 'Martial Archetype|Fighter||3', gainSubclassFeature: true },
    ])
    expect(classes[1]).toEqual({ name: 'Sidekick', source: 'PHB' })
    expect(subclass[0].subclassFeatures).toEqual([
      'Improved Critical|Fighter||Champion||3',
    ])
    expect(removed).toContain('Fighter|PHB: Martial Versatility|Fighter||4|TCE')
    expect(removed).toContain('Fighter|PHB: Unlisted|Fighter||5')
    expect(removed).toContain('Champion|PHB: Not Kept|Fighter||Champion||7|TCE')
  })

  it('takes reference entries to entries that were not kept out of a description', () => {
    const base = build()
    const removed = removeDangling(base)
    const [feature] = base.get('class/class-fighter.json').classFeature
    expect(feature.entries[0].entries).toEqual([
      { type: 'refOptionalfeature', optionalfeature: 'Archery' },
      { type: 'refClassFeature', classFeature: 'Fighting Style|Fighter||1' },
      {
        type: 'refSubclassFeature',
        subclassFeature: 'Improved Critical|Fighter||Champion||3',
      },
      'Plain text stays.',
    ])
    expect(removed).toContain('Fighting Style|PHB: Blind Fighting|TCE')
    expect(removed).toContain('Fighting Style|PHB: Blessed Warrior|XPHB')
    expect(removed).toContain('Fighting Style|PHB: Gone|Fighter||1')
  })

  it('takes out every pointer to art, sound and lore', () => {
    const base = build()
    removeDangling(base)
    expect(
      base.get('class/class-fighter.json').classFeature[0].hasFluffImages,
    ).toBeUndefined()
    expect(base.get('items.json').item[0]).toEqual({
      name: 'Oathbow',
      source: 'DMG',
      reprintedAs: ['Longbow|PHB'],
    })
    expect(base.get('decks.json').card).toEqual([{ name: 'Sun', source: 'DMG' }])
  })

  it('prunes the reprint lists, and drops a list left empty', () => {
    const base = build()
    const removed = removeDangling(base)
    expect(base.get('items.json').item[1]).toEqual({ name: 'Longbow', source: 'PHB' })
    expect(base.get('magicvariants.json').magicvariant[0].inherits).toEqual({
      source: 'DMG',
      reprintedAs: ['Longbow|PHB'],
    })
    expect(removed).toContain('Oathbow|DMG: reprintedAs Oathbow|XDMG')
    expect(removed).toContain('+1 Armor|DMG: reprintedAs +1 Armor|XDMG')
  })
})

describe('collectAliases', () => {
  it('reads the SRD names off the flags and leaves plain flags behind', () => {
    const base = new Map([
      [
        'spells/spells-phb.json',
        {
          spell: [
            { name: "Melf's Acid Arrow", source: 'PHB', srd: 'Acid Arrow' },
            { name: 'Fireball', source: 'PHB', srd: true },
            // The same name as the SRD's: nothing to rename.
            { name: 'Light', source: 'PHB', srd: 'Light' },
          ],
        },
      ],
      [
        'items.json',
        {
          item: [
            { name: 'Deck of Many Things', source: 'XDMG', srd52: 'Mysterious Deck' },
          ],
        },
      ],
      [
        'decks.json',
        {
          deck: [
            { name: 'Deck of Many Things', source: 'XDMG', srd52: 'Mysterious Deck' },
          ],
        },
      ],
      [
        'magicvariants.json',
        {
          magicvariant: [
            { name: 'Vicious Weapon', inherits: { source: 'DMG', srd: 'Cruel Weapon' } },
          ],
        },
      ],
    ])
    expect(collectAliases(base, FLAGS)).toEqual([
      { name: "Melf's Acid Arrow", source: 'PHB', flag: 'srd', to: 'Acid Arrow' },
      {
        name: 'Deck of Many Things',
        source: 'XDMG',
        flag: 'srd52',
        to: 'Mysterious Deck',
      },
      { name: 'Vicious Weapon', source: 'DMG', flag: 'srd', to: 'Cruel Weapon' },
    ])
    expect(base.get('spells/spells-phb.json').spell.map((s) => s.srd)).toEqual([
      true,
      true,
      true,
    ])
    expect(base.get('magicvariants.json').magicvariant[0].inherits.srd).toBe(true)
  })
})

describe('renamer', () => {
  const rename = renamer([
    {
      name: 'Carrion Crawler Mucus',
      source: 'DMG',
      flag: 'srd',
      to: 'Crawler Mucus (Contact)',
    },
    { name: 'Carrion Crawler Mucus', source: 'XDMG', flag: 'srd52', to: 'Crawler Mucus' },
    { name: "Melf's Acid Arrow", source: 'PHB', flag: 'srd', to: 'Acid Arrow' },
    { name: "Melf's Acid Arrow", source: 'XPHB', flag: 'srd52', to: 'Acid Arrow' },
    { name: 'Deck of Many Things', source: 'XDMG', flag: 'srd52', to: 'Mysterious Deck' },
    { name: "Quaal's Feather Token", source: 'XDMG', flag: 'srd52', to: 'Feather Token' },
    {
      name: "Quaal's Feather Token, Anchor",
      source: 'XDMG',
      flag: 'srd52',
      to: 'Feather Token, Anchor',
    },
  ])

  it('lets a source written after the name decide', () => {
    expect(rename('{@item Carrion Crawler Mucus|XDMG}', 'srd')).toBe(
      '{@item Crawler Mucus|XDMG}',
    )
    expect(rename('{@item Carrion Crawler Mucus|DMG|the mucus}', 'srd52')).toBe(
      '{@item Crawler Mucus (Contact)|DMG|the mucus}',
    )
    expect(rename('{@card Fool|Deck of Many Things|XDMG}', 'srd')).toBe(
      '{@card Fool|Mysterious Deck|XDMG}',
    )
    expect(rename('Deck of Many Things (13 cards)|XDMG', 'srd')).toBe(
      'Mysterious Deck (13 cards)|XDMG',
    )
  })

  it('leaves a name alone when the source after it has no SRD name for it', () => {
    expect(rename('{@item Deck of Many Things|DMG}', 'srd52')).toBe(
      '{@item Deck of Many Things|DMG}',
    )
    expect(rename('Deck of Many Things|BMT', 'srd52')).toBe('Deck of Many Things|BMT')
  })

  it('otherwise goes by the SRD of the entry holding the text', () => {
    expect(rename('Carrion Crawler Mucus', 'srd')).toBe('Crawler Mucus (Contact)')
    expect(rename('Carrion Crawler Mucus', 'srd52')).toBe('Crawler Mucus')
    expect(rename('{@card Fool|Deck of Many Things}', 'srd52')).toBe(
      '{@card Fool|Mysterious Deck}',
    )
    // The 5.1 SRD has a Deck of Many Things of its own.
    expect(rename('{@card Fool|Deck of Many Things}', 'srd')).toBe(
      '{@card Fool|Deck of Many Things}',
    )
    // A source in a later tag belongs to that tag, not to this name.
    expect(rename('a Deck of Many Things or a {@item Bag of Holding|XDMG}', 'srd')).toBe(
      'a Deck of Many Things or a {@item Bag of Holding|XDMG}',
    )
  })

  it('uses the one name every SRD agrees on when the text belongs to no SRD', () => {
    expect(rename("melf's acid arrow")).toBe('acid arrow')
    // Two different names and nothing to choose by: left alone.
    expect(rename('Carrion Crawler Mucus')).toBe('Carrion Crawler Mucus')
  })

  it('keeps a lower-case mention lower-case', () => {
    expect(rename("melf's acid arrow|xphb", 'srd')).toBe('acid arrow|xphb')
    expect(rename("{@spell Melf's acid arrow}", 'srd')).toBe('{@spell Acid Arrow}')
  })

  it('matches the longest name first', () => {
    expect(rename("Quaal's Feather Token, Anchor", 'srd52')).toBe('Feather Token, Anchor')
    expect(rename("Quaal's Feather Tokens", 'srd52')).toBe('Feather Tokens')
  })

  it('changes nothing when there is nothing to rename', () => {
    const same = renamer([])
    expect(same('Deck of Many Things', 'srd52')).toBe('Deck of Many Things')
    expect(same.names).toBeUndefined()
  })
})

describe('mapText', () => {
  it('passes every piece of text through, keys included', () => {
    const out = mapText(
      { 'old|phb': 6, list: ['old', 2, null, { name: 'old' }], flag: true },
      (text) => text.replace('old', 'new'),
    )
    expect(out).toEqual({
      'new|phb': 6,
      list: ['new', 2, null, { name: 'new' }],
      flag: true,
    })
  })
})

describe('applyRenames', () => {
  it('renames each entry by its own SRD', () => {
    const base = new Map([
      [
        'items.json',
        {
          item: [
            {
              name: 'Carrion Crawler Mucus',
              source: 'DMG',
              srd: true,
              entries: ['See {@item Carrion Crawler Mucus|XDMG}.'],
            },
            { name: 'Carrion Crawler Mucus', source: 'XDMG', srd52: true },
          ],
        },
      ],
    ])
    const rename = renamer([
      {
        name: 'Carrion Crawler Mucus',
        source: 'DMG',
        flag: 'srd',
        to: 'Crawler Mucus (Contact)',
      },
      {
        name: 'Carrion Crawler Mucus',
        source: 'XDMG',
        flag: 'srd52',
        to: 'Crawler Mucus',
      },
    ])
    applyRenames(base, rename, FLAGS)
    expect(base.get('items.json').item).toEqual([
      {
        name: 'Crawler Mucus (Contact)',
        source: 'DMG',
        srd: true,
        entries: ['See {@item Crawler Mucus|XDMG}.'],
      },
      { name: 'Crawler Mucus', source: 'XDMG', srd52: true },
    ])
  })
})

describe('reduceBooks', () => {
  it('lists the books an SRD covers, without chapter list and cover', () => {
    const books = [
      {
        name: "Player's Handbook (2014)",
        id: 'PHB',
        source: 'PHB',
        group: 'core',
        cover: { type: 'internal', path: 'covers/PHB.webp' },
        coverCredit: 'An artist',
        contents: [{ name: 'Introduction' }],
      },
      { name: "Xanathar's Guide to Everything", id: 'XGE', source: 'XGE' },
    ]
    expect(reduceBooks(books, new Set(['PHB', 'MM']))).toEqual([
      { name: "Player's Handbook (2014)", id: 'PHB', source: 'PHB', group: 'core' },
    ])
  })
})

describe('reduceSpellLookup', () => {
  const base = new Map([
    [
      'spells/spells-phb.json',
      {
        spell: [
          { name: 'Acid Arrow', source: 'PHB' },
          { name: 'Fireball', source: 'PHB' },
          { name: 'Wish', source: 'PHB' },
        ],
      },
    ],
    [
      'class/class-wizard.json',
      {
        class: [
          { name: 'Wizard', source: 'PHB' },
          { name: 'Sorcerer', source: 'PHB' },
        ],
        subclass: [
          {
            name: 'School of Evocation',
            shortName: 'Evocation',
            className: 'Wizard',
            classSource: 'PHB',
            source: 'PHB',
          },
        ],
      },
    ],
  ])
  const rename = renamer([
    { name: "Melf's Acid Arrow", source: 'PHB', flag: 'srd', to: 'Acid Arrow' },
  ])
  const lookup = {
    phb: {
      "melf's acid arrow": {
        class: {
          PHB: { Wizard: true, Sorcerer: { definedInSources: ['TCE'] } },
          TCE: { Artificer: true },
        },
        subclass: {
          PHB: {
            Wizard: { PHB: { Evocation: { name: 'School of Evocation' } } },
            Druid: { PHB: { Land: { name: 'Circle of the Land' } } },
          },
          TCE: { Artificer: { TCE: { Alchemist: { name: 'Alchemist' } } } },
        },
        feat: { AU: { 'Magic Connoisseur': true } },
      },
      fireball: {
        class: { PHB: { Sorcerer: { definedInSources: ['PHB'] }, Wizard: {} } },
      },
      // A kept spell that no kept class has: nothing to say about it.
      wish: { class: { TCE: { Artificer: true } } },
      hex: { class: { PHB: { Wizard: true } } },
    },
    xge: { 'shadow blade': { class: { PHB: { Wizard: true } } } },
  }

  it('keeps the kept spells under their SRD names, with the kept classes and subclasses', () => {
    const reduced = reduceSpellLookup(lookup, {
      has: keptIndex(base),
      rename,
      sources: new Set(['PHB']),
    })
    expect(reduced).toEqual({
      phb: {
        'acid arrow': {
          class: { PHB: { Wizard: true } },
          subclass: {
            PHB: { Wizard: { PHB: { Evocation: { name: 'School of Evocation' } } } },
          },
        },
        fireball: {
          class: { PHB: { Sorcerer: { definedInSources: ['PHB'] }, Wizard: {} } },
        },
      },
    })
  })
})

describe('reduceIndex', () => {
  it('keeps the names of the kept files of its folder', () => {
    const index = { PHB: 'spells-phb.json', XGE: 'spells-xge.json', odd: 3 }
    const kept = new Set(['spells/spells-phb.json', 'spells-xge.json'])
    expect(reduceIndex('spells/index.json', index, kept)).toEqual({
      PHB: 'spells-phb.json',
    })
    expect(reduceIndex('index.json', index, kept)).toEqual({ XGE: 'spells-xge.json' })
  })
})

describe('findProblems', () => {
  const rename = renamer([
    { name: 'Deck of Many Things', source: 'XDMG', flag: 'srd52', to: 'Mysterious Deck' },
    {
      name: "Keoghtom's Ointment",
      source: 'DMG',
      flag: 'srd',
      to: 'Restorative Ointment',
    },
  ])

  it('finds nothing wrong with a clean base', () => {
    const base = new Map([
      [
        'items.json',
        {
          item: [
            // The 5.1 SRD's own name: fine to mention, here and elsewhere.
            { name: 'Deck of Many Things', source: 'DMG' },
            {
              name: 'Mysterious Deck',
              source: 'XDMG',
              entries: ['Unlike a deck of many things.'],
            },
          ],
        },
      ],
    ])
    expect(findProblems(base, rename)).toEqual([])
    expect(findProblems(base, renamer([]))).toEqual([])
  })

  it('reports a replaced name that is still written, in a value or a key', () => {
    const base = new Map([
      [
        'items.json',
        {
          item: [
            {
              name: 'Restorative Ointment',
              source: 'DMG',
              seeAlso: ["Keoghtom's Ointment|XDMG"],
            },
            { name: 'Jar', source: 'DMG', holds: { "keoghtom's ointment|xdmg": 5 } },
          ],
        },
      ],
    ])
    const problems = findProblems(base, rename)
    expect(problems).toHaveLength(2)
    expect(problems[0]).toContain('items.json item Restorative Ointment|DMG')
    expect(problems[0]).toContain('still says "Keoghtom\'s Ointment"')
    expect(problems[1]).toContain('Jar|DMG')
  })

  it('reports an entry built on another entry', () => {
    const base = new Map([
      [
        'items-base.json',
        {
          itemProperty: [
            { abbreviation: 'X', source: 'PHB', _copy: { abbreviation: 'V' } },
          ],
        },
      ],
    ])
    expect(findProblems(base, rename)).toEqual([
      'items-base.json itemProperty X|PHB: is built on another entry (_copy)',
    ])
  })
})

describe('buildBase', () => {
  const full = files({
    'books.json': {
      book: [
        { name: 'PHB', id: 'PHB', source: 'PHB', contents: [], cover: {} },
        { name: 'XGE', id: 'XGE', source: 'XGE' },
      ],
    },
    'spells/index.json': { PHB: 'spells-phb.json', XGE: 'spells-xge.json' },
    'spells/fluff-index.json': { PHB: 'fluff-spells-phb.json' },
    'spells/fluff-spells-phb.json': { spellFluff: [{ name: 'Fireball', source: 'PHB' }] },
    'spells/spells-phb.json': {
      _meta: {},
      spell: [
        { name: "Tasha's Hideous Laughter", source: 'PHB', srd: 'Hideous Laughter' },
        { name: 'Hex', source: 'PHB' },
      ],
    },
    'spells/spells-xge.json': { spell: [{ name: 'Shadow Blade', source: 'XGE' }] },
    'class/index.json': { bard: 'class-bard.json', artificer: 'class-artificer.json' },
    'class/class-artificer.json': { class: [{ name: 'Artificer', source: 'TCE' }] },
    'class/class-bard.json': {
      subclass: [],
      classFeature: [
        {
          name: 'Spellcasting',
          className: 'Bard',
          classSource: 'PHB',
          level: 1,
          source: 'PHB',
          srd: true,
          entries: ["Such as {@spell Tasha's hideous laughter}."],
        },
      ],
      class: [
        {
          name: 'Bard',
          source: 'PHB',
          srd: true,
          classFeatures: ['Spellcasting|Bard||1', 'Magical Inspiration|Bard||2|TCE'],
        },
      ],
    },
    'generated/gendata-spell-source-lookup.json': {
      phb: {
        "tasha's hideous laughter": { class: { PHB: { Bard: true, Wizard: true } } },
        hex: { class: { PHB: { Warlock: true } } },
      },
    },
  })

  it('reduces the full data to the free rules', () => {
    const { files: out, report } = buildBase(full, FLAGS)
    expect([...out.keys()]).toEqual([
      'books.json',
      'class/class-bard.json',
      'class/index.json',
      'generated/gendata-spell-source-lookup.json',
      'spells/index.json',
      'spells/spells-phb.json',
    ])
    expect(out.get('books.json')).toEqual({
      book: [{ name: 'PHB', id: 'PHB', source: 'PHB' }],
    })
    expect(out.get('class/index.json')).toEqual({ bard: 'class-bard.json' })
    expect(out.get('spells/index.json')).toEqual({ PHB: 'spells-phb.json' })
    expect(out.get('spells/spells-phb.json')).toEqual({
      spell: [{ name: 'Hideous Laughter', source: 'PHB', srd: true }],
    })
    // Keys come in the order of the full file.
    const bard = out.get('class/class-bard.json')
    expect(Object.keys(bard)).toEqual(['classFeature', 'class'])
    expect(bard.class[0].classFeatures).toEqual(['Spellcasting|Bard||1'])
    expect(bard.classFeature[0].entries).toEqual(['Such as {@spell Hideous Laughter}.'])
    expect(out.get('generated/gendata-spell-source-lookup.json')).toEqual({
      phb: { 'hideous laughter': { class: { PHB: { Bard: true } } } },
    })
    expect(report).toEqual({
      sources: ['PHB'],
      renamed: ['Tasha\'s Hideous Laughter|PHB is "Hideous Laughter" in the SRD'],
      removed: ['Bard|PHB: Magical Inspiration|Bard||2|TCE'],
      problems: [],
    })
  })

  it('publishes nothing that is not there to publish', () => {
    const { files: out, report } = buildBase(files({ 'feats.json': { feat: [] } }), FLAGS)
    expect(out.size).toBe(0)
    expect(report.problems).toEqual([])
  })
})

describe('licenseNotice', () => {
  it('names each document with its flag and attribution, and the changes made', () => {
    const notice = licenseNotice({
      documents: [
        { flag: 'srd', name: 'Document One', attribution: 'Attribution one.' },
        { flag: 'srd52', name: 'Document Two', attribution: 'Attribution two.' },
      ],
      changes: 'Changes were made.',
    })
    expect(notice).toContain('## Document One (flag: srd)\n\nAttribution one.')
    expect(notice).toContain('## Document Two (flag: srd52)\n\nAttribution two.')
    expect(notice.endsWith('## Changes\n\nChanges were made.\n')).toBe(true)
  })
})
