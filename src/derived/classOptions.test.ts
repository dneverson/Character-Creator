import { describe, expect, it } from 'vitest'
import {
  chosenOptions,
  featureNames,
  heldEntries,
  optionCards,
  optionSkillSources,
  optionSlots,
  replacedName,
  typeWords,
  variantChoices,
} from './classOptions'
import { featureRows } from './features'
import { collectSources, heldBy, type DeriveDeps, type HeldFeat } from './sources'
import type { LoadedClass } from '../data/class'
import type { ClassOption } from '../data/classOptions'
import type { Character } from '../character/model'
import { build, deps, featOf, loadedClass } from '../test/derivedFixtures'

const style = (name: string, ...types: string[]): ClassOption => ({
  key: `${name}|PHB`,
  name,
  source: 'PHB',
  types,
  entries: [`${name} text.`],
})

const CATALOG = [
  style('Archery', 'FS:F', 'FS:R'),
  style('Defense', 'FS:F', 'FS:P', 'FS:R'),
  style('Dueling', 'FS:F', 'FS:P'),
  style('Blessed Warrior', 'FS:P'),
]

const progression = (type: string, at: Record<string, number> | number[]) => [
  { name: 'Fighting Style', featureType: [type], progression: at },
]

const fighter = (): LoadedClass => {
  const base = loadedClass('Fighter', [], [])
  return {
    entry: { ...base.entry, optionalfeatureProgression: progression('FS:F', { '1': 1 }) },
    file: {
      subclass: [
        {
          name: 'Champion',
          shortName: 'Champion',
          source: 'PHB',
          className: 'Fighter',
          classSource: 'PHB',
          subclassFeatures: [],
          optionalfeatureProgression: progression('FS:F', { '10': 1 }),
        },
        {
          name: 'Battle Master',
          shortName: 'Battle Master',
          source: 'PHB',
          className: 'Fighter',
          classSource: 'PHB',
          subclassFeatures: [],
          optionalfeatureProgression: [
            {
              name: 'Maneuvers',
              featureType: ['MV:B'],
              progression: { '3': 3, '7': 5, '10': 7, '15': 9 },
            },
          ],
        },
      ],
    },
  }
}

const paladin = (): LoadedClass => {
  const base = loadedClass('Paladin', [], [])
  return {
    entry: { ...base.entry, optionalfeatureProgression: progression('FS:P', { '2': 1 }) },
    file: {},
  }
}

const withDeps = (
  classes: LoadedClass[],
  catalog: ClassOption[] = CATALOG,
): DeriveDeps => ({
  ...deps(classes),
  optionCatalog: catalog,
})

const cardsOf = (
  c: Character,
  classes: LoadedClass[],
  catalog: ClassOption[] = CATALOG,
) => {
  const d = withDeps(classes, catalog)
  return optionCards(collectSources(c, d), d)
}

describe('class option cards', () => {
  it('offers the styles of the class and counts how many it gives at the level', () => {
    const [card] = cardsOf(build('Fighter', 1, {}, []), [fighter()])
    expect(card).toMatchObject({
      tag: 'class:Fighter|PHB|FS:F',
      label: 'Class · Fighter fighting style',
      noun: 'fighting styles',
      count: 1,
      left: 1,
      kinds: ['option'],
    })
    expect(card.chips.map((chip) => chip.label)).toEqual([
      'Archery',
      'Defense',
      'Dueling',
    ])
  })

  it('describes each style with its rules text and what the app applies', () => {
    const [card] = cardsOf(build('Fighter', 1, {}, []), [fighter()])
    const defense = card.chips.find((chip) => chip.label === 'Defense')
    expect(defense?.detail?.entries).toEqual(['Defense text.'])
    expect(defense?.detail?.facts).toEqual([
      { label: 'Prerequisite', value: '' },
      { label: 'Level', value: '' },
      { label: 'Source', value: 'PHB' },
      { label: 'Edition', value: '2014' },
      {
        label: 'In this app',
        value: 'Automatic: +1 to your armor class while you wear armor.',
      },
    ])
  })

  it('gives nothing before the level and a second pick with the Champion at 10', () => {
    expect(cardsOf(build('Paladin', 1, {}, []), [paladin()])).toEqual([])
    const c = build('Fighter', 10, {}, [])
    expect(cardsOf(c, [fighter()])[0].count).toBe(1)
    c.classes = [
      {
        ...c.classes[0],
        subclass: { name: 'Champion', shortName: 'Champion', source: 'PHB' },
      },
    ]
    expect(cardsOf(c, [fighter()])[0].count).toBe(2)
  })

  it('reads a count as the total known from a level on, not a sum', () => {
    const c = build('Fighter', 10, {}, [])
    c.classes = [
      {
        ...c.classes[0],
        subclass: { name: 'Battle Master', shortName: 'Battle Master', source: 'PHB' },
      },
    ]
    const maneuvers = cardsOf(c, [fighter()]).find((card) => card.tag.endsWith('|MV:B'))
    expect(maneuvers).toMatchObject({
      label: 'Class · Fighter maneuvers',
      noun: 'maneuvers',
      count: 7,
    })
  })

  it('marks a pick, fills the card and takes the style away from the other class', () => {
    const c = build('Fighter', 1, {}, [])
    c.classes = [...c.classes, { name: 'Paladin', source: 'PHB', level: 2 }]
    c.classOptions = { 'class:Fighter|PHB|FS:F': ['Defense|PHB'] }
    const [f, p] = cardsOf(c, [fighter(), paladin()])
    expect(f).toMatchObject({ used: 1, left: 0, picks: ['Defense|PHB'] })
    expect(f.chips.map((chip) => chip.state)).toEqual(['full', 'picked', 'full'])
    expect(p.label).toBe('Multiclass · Paladin fighting style')
    expect(p.chips.map((chip) => [chip.label, chip.state, chip.takenBy])).toEqual([
      ['Defense', 'taken', 'Fighter'],
      ['Dueling', 'available', undefined],
      ['Blessed Warrior', 'available', undefined],
    ])
  })

  it('holds the option of a class the character has and not of one it left', () => {
    const c = build('Fighter', 1, {}, [])
    c.classOptions = {
      'class:Fighter|PHB|FS:F': ['Defense|PHB'],
      'class:Paladin|PHB|FS:P': ['Dueling|PHB'],
    }
    expect([...collectSources(c, deps([fighter()])).options]).toEqual(['Defense|PHB'])
  })

  it('offers only the options of the selected books, and keeps a pick from another', () => {
    const c = build('Fighter', 1, {}, [])
    const tce: ClassOption = {
      ...style('Blind Fighting', 'FS:F'),
      key: 'Blind Fighting|TCE',
      source: 'TCE',
    }
    expect(
      cardsOf(c, [fighter()], [...CATALOG, tce])[0].chips.map((x) => x.label),
    ).toEqual(['Archery', 'Defense', 'Dueling'])
    c.classOptions = { 'class:Fighter|PHB|FS:F': ['Blind Fighting|TCE'] }
    expect(
      cardsOf(c, [fighter()], [...CATALOG, tce])[0].chips.find(
        (x) => x.label === 'Blind Fighting',
      )?.state,
    ).toBe('picked')
  })

  it('names the kinds of option in plain words', () => {
    expect(typeWords(['EI'], 'Eldritch Invocations')).toEqual({
      one: 'invocation',
      many: 'invocations',
    })
    expect(typeWords(['XX'], 'Secret Arts')).toEqual({
      one: 'secret arts',
      many: 'secret arts',
    })
    expect(typeWords(['XX'], 'Boon')).toEqual({ one: 'boon', many: 'boons' })
  })
})

// ---- Eldritch Invocations: prerequisites, editions, repeats -------------------------

const warlock = (source: 'PHB' | 'XPHB'): LoadedClass => {
  const base = loadedClass('Warlock', [], [])
  return {
    entry: {
      ...base.entry,
      source,
      edition: source === 'XPHB' ? 'one' : 'classic',
      optionalfeatureProgression: [
        {
          name: 'Eldritch Invocations',
          featureType: ['EI'],
          progression:
            source === 'XPHB'
              ? [1, 3, 3, 3, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10]
              : [0, 2, 2, 2, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8],
        },
        ...(source === 'PHB'
          ? [{ name: 'Pact Boon', featureType: ['PB'], progression: { '3': 1 } }]
          : []),
      ],
    },
    file: {},
  }
}

const invocation = (
  name: string,
  source: string,
  extra: Partial<ClassOption> = {},
): ClassOption => ({
  key: `${name}|${source}`,
  name,
  source,
  types: ['EI'],
  entries: [`${name} text.`],
  ...extra,
})

const INVOCATIONS: ClassOption[] = [
  invocation("Devil's Sight", 'PHB'),
  invocation('Thirsting Blade', 'PHB', {
    prerequisite: [{ level: { level: 5, class: { name: 'Warlock' } }, pact: 'Blade' }],
  }),
  invocation('Agonizing Blast', 'PHB', {
    prerequisite: [{ spell: ['eldritch blast#c'] }],
    reprintedAs: ['Agonizing Blast|XPHB'],
  }),
  invocation('Agonizing Blast', 'XPHB', {
    prerequisite: [
      {
        level: { level: 2, class: { name: 'Warlock', source: 'XPHB' } },
        spell: [
          {
            choose: 'level=0|class=Warlock',
            entrySummary: 'Warlock Cantrip That Deals Damage',
          },
        ],
      },
    ],
    entries: [
      {
        type: 'entries',
        entries: [{ type: 'entries', name: 'Repeatable', entries: ['Again.'] }],
      },
    ],
  }),
  invocation('Maddening Hex', 'XGE', {
    prerequisite: [
      { level: { level: 5, class: { name: 'Warlock' } }, spell: ['hex/curse#x'] },
    ],
  }),
  invocation('Lifedrinker', 'XPHB', {
    prerequisite: [
      {
        level: { level: 9, class: { name: 'Warlock', source: 'XPHB' } },
        optionalfeature: ['pact of the blade|xphb'],
      },
    ],
  }),
  { ...invocation('Pact of the Blade', 'PHB'), types: ['PB'] },
  {
    ...invocation('Superior Technique', 'TCE'),
    types: ['FS:F'],
    optionalfeatureProgression: [
      { name: 'Maneuvers', featureType: ['MV:B'], progression: { '*': 1 } },
    ],
  },
  {
    ...invocation('Trip Attack', 'PHB'),
    types: ['MV:B'],
    consumes: { name: 'Superiority Die' },
    prerequisite: [{ item: ['A weapon'] }, { otherSummary: { entry: 'Renown 3+' } }],
  },
]

const warlockOf = (
  level: number,
  source: 'PHB' | 'XPHB' = 'PHB',
  books = ['PHB', 'XGE'],
) => {
  const c = build('Warlock', level, {}, [])
  c.classes = [{ name: 'Warlock', source, level }]
  c.selectedBooks = books
  return c
}

const invocationCard = (c: Character, source: 'PHB' | 'XPHB' = 'PHB') =>
  cardsOf(c, [warlock(source)], INVOCATIONS).find((card) => card.tag.endsWith('|EI'))

describe('invocations', () => {
  it('counts invocations by the list of the class table and gives a pact boon at 3', () => {
    expect(cardsOf(warlockOf(1), [warlock('PHB')], INVOCATIONS)).toEqual([])
    const cards = cardsOf(warlockOf(5), [warlock('PHB')], INVOCATIONS)
    expect(cards.map((c) => [c.label, c.count, c.noun])).toEqual([
      ['Class · Warlock eldritch invocations', 3, 'invocations'],
      ['Class · Warlock pact boon', 1, 'pact boons'],
    ])
    expect(invocationCard(warlockOf(1, 'XPHB', ['XPHB']), 'XPHB')?.count).toBe(1)
  })

  it('greys an invocation whose prerequisite is not met, with the reason', () => {
    const card = invocationCard(warlockOf(5))
    const blade = card?.chips.find((x) => x.label === 'Thirsting Blade')
    expect(blade).toMatchObject({
      state: 'available',
      unmet: 'Needs Pact of the Blade - allowed with DM approval',
    })
    expect(blade?.detail?.facts).toEqual(
      expect.arrayContaining([
        { label: 'Prerequisite', value: 'Level 5 Warlock, Pact of the Blade' },
        { label: 'Level', value: '5' },
      ]),
    )
    expect(card?.chips.find((x) => x.label === 'Agonizing Blast')?.unmet).toBe(
      'Needs The Eldritch Blast cantrip - allowed with DM approval',
    )
    expect(card?.chips.find((x) => x.label === 'Maddening Hex')?.unmet).toBe(
      'Needs The Hex spell or a warlock feature that curses - allowed with DM approval',
    )
  })

  it('meets a prerequisite once the pact, the cantrip or the spell is had', () => {
    const c = warlockOf(5)
    c.classOptions = { 'class:Warlock|PHB|PB': ['Pact of the Blade|PHB'] }
    c.spells = {
      'Warlock|PHB': {
        cantrips: [{ name: 'Eldritch Blast', source: 'PHB', level: 0 }],
        spells: [{ name: 'Hex', source: 'PHB', level: 1 }],
      },
    }
    const card = invocationCard(c)
    expect(card?.chips.filter((x) => x.unmet).map((x) => x.label)).toEqual([])
    c.spells = {}
    c.spellGrants = {
      g: { picks: [{ name: 'Eldritch Blast', source: 'PHB', level: 0 }] },
    }
    expect(
      invocationCard(c)?.chips.find((x) => x.label === 'Agonizing Blast')?.unmet,
    ).toBe(undefined)
  })

  it('flags the 2014 version of a 2024 invocation for a 2024 warlock, and the other way', () => {
    const c = warlockOf(5, 'XPHB', ['PHB', 'XPHB'])
    c.spells = {
      'Warlock|XPHB': {
        cantrips: [{ name: 'Eldritch Blast', source: 'XPHB', level: 0 }],
        spells: [],
      },
    }
    const one = invocationCard(c, 'XPHB')
    const old = one?.chips.find((x) => x.value === 'Agonizing Blast|PHB')
    expect(old?.unmet).toBe('Replaced by its 2024 version - allowed with DM approval')
    const lifedrinker = one?.chips.find((x) => x.label === 'Lifedrinker')
    expect(lifedrinker?.unmet).toBe(
      'Needs Level 9 Warlock, Pact of the Blade - allowed with DM approval',
    )
    const classic = invocationCard(warlockOf(5, 'PHB', ['PHB', 'XPHB']))
    expect(classic?.chips.find((x) => x.value === 'Agonizing Blast|XPHB')?.unmet).toBe(
      'A 2024 option, and Warlock uses the 2014 rules - allowed with DM approval',
    )
  })

  it('names the edition of two printings that share a name, and only those', () => {
    const both = invocationCard(warlockOf(5, 'PHB', ['PHB', 'XPHB']))
    const blasts = both?.chips.filter((x) => x.label.startsWith('Agonizing Blast'))
    expect(blasts?.map((x) => [x.value, x.label])).toEqual(
      expect.arrayContaining([
        ['Agonizing Blast|PHB', 'Agonizing Blast (2014)'],
        ['Agonizing Blast|XPHB', 'Agonizing Blast (2024)'],
      ]),
    )
    const single = invocationCard(warlockOf(5))
    expect(single?.chips.find((x) => x.value === 'Agonizing Blast|PHB')?.label).toBe(
      'Agonizing Blast',
    )
  })

  it('leaves a prerequisite it cannot check ungreyed and says what it is', () => {
    const one = invocationCard(warlockOf(5, 'XPHB', ['XPHB']), 'XPHB')
    const blast = one?.chips.find((x) => x.value === 'Agonizing Blast|XPHB')
    expect(blast?.unmet).toBeUndefined()
    expect(blast?.detail?.facts).toEqual(
      expect.arrayContaining([
        {
          label: 'Prerequisite',
          value: 'Level 2 Warlock, Warlock Cantrip That Deals Damage',
        },
        { label: 'Repeatable', value: 'Yes' },
      ]),
    )
  })

  it('offers a repeatable invocation again once taken, and nothing else twice', () => {
    const c = warlockOf(5, 'XPHB', ['XPHB'])
    c.classOptions = { 'class:Warlock|XPHB|EI': ['Agonizing Blast|XPHB'] }
    const chips = invocationCard(c, 'XPHB')?.chips.filter((x) =>
      x.label.startsWith('Agonizing'),
    )
    expect(chips?.map((x) => [x.value, x.label, x.state])).toEqual([
      ['Agonizing Blast|XPHB', 'Agonizing Blast', 'picked'],
      ['Agonizing Blast|XPHB#2', 'Agonizing Blast (again)', 'available'],
    ])
  })

  it("applies the sense of Devil's Sight and lists the invocation with its text", () => {
    const c = warlockOf(2)
    c.classOptions = { 'class:Warlock|PHB|EI': ["Devil's Sight|PHB"] }
    const d = withDeps([warlock('PHB')], INVOCATIONS)
    const sources = collectSources(c, d)
    expect(heldBy(sources, { option: "Devil's Sight|PHB" })?.source.label).toBe(
      "Devil's Sight",
    )
    expect(featureRows(sources, INVOCATIONS)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Devil's Sight",
          from: 'Warlock - Eldritch Invocations',
          kind: 'Class',
          entries: ["Devil's Sight text."],
        }),
      ]),
    )
    const card = invocationCard(c)
    expect(card?.chips.find((x) => x.label === "Devil's Sight")?.detail?.facts).toEqual(
      expect.arrayContaining([
        {
          label: 'In this app',
          value: 'Automatic: the sense it gives is listed with your senses.',
        },
      ]),
    )
  })

  it('gives the spells of a held option to the spell grants', () => {
    const tome: ClassOption = {
      ...invocation('Pact of the Tome', 'PHB'),
      types: ['PB'],
      additionalSpells: [{ known: { _: [{ choose: 'level=0', count: 3 }] } }],
    }
    const c = warlockOf(3)
    c.classOptions = { 'class:Warlock|PHB|PB': ['Pact of the Tome|PHB'] }
    const d = withDeps([warlock('PHB')], [...INVOCATIONS, tome])
    expect(chosenOptions(collectSources(c, d), d)).toEqual([
      {
        key: 'Pact of the Tome|PHB',
        name: 'Pact of the Tome',
        edition: 'classic',
        additionalSpells: tome.additionalSpells,
      },
    ])
    const card = cardsOf(c, [warlock('PHB')], [...INVOCATIONS, tome]).find((x) =>
      x.tag.endsWith('|PB'),
    )
    expect(
      card?.chips.find((x) => x.label === 'Pact of the Tome')?.detail?.facts,
    ).toEqual(
      expect.arrayContaining([
        {
          label: 'In this app',
          value:
            'Automatic: the spells it gives are listed in your spell grants, in Spells.',
        },
      ]),
    )
  })
})

describe('skills of options', () => {
  it('gives the skills of an option held, once, as a skill source', () => {
    const beguiling: ClassOption = {
      ...invocation('Beguiling Influence', 'PHB'),
      skillProficiencies: [{ deception: true, persuasion: true }],
    }
    const catalog = [...INVOCATIONS, beguiling]
    const c = warlockOf(2)
    const d = withDeps([warlock('PHB')], catalog)
    expect(optionSkillSources(collectSources(c, d), catalog)).toEqual([])
    c.classOptions = {
      'class:Warlock|PHB|EI': ['Beguiling Influence|PHB', "Devil's Sight|PHB"],
    }
    expect(optionSkillSources(collectSources(c, d), catalog)).toEqual([
      {
        tag: 'option:Beguiling Influence|PHB',
        label: 'Class · Beguiling Influence',
        kind: 'class',
        fixed: ['deception', 'persuasion'],
        choices: [],
      },
    ])
    expect(optionSkillSources(collectSources(c, d))).toEqual([])
    const empty = { ...beguiling, skillProficiencies: [{}] }
    expect(optionSkillSources(collectSources(c, d), [empty])).toEqual([])
  })
})

describe('options from feats and from options', () => {
  it('gives a feat its own card, and an option that teaches one adds to the slot', () => {
    const c = build('Fighter', 4, {}, [])
    c.selectedBooks = ['PHB', 'TCE']
    c.classOptions = { 'class:Fighter|PHB|FS:F': ['Superior Technique|TCE'] }
    const martial: HeldFeat = {
      feat: {
        ...featOf('Martial Adept', 'PHB'),
        optionalfeatureProgression: [
          { name: 'Maneuvers', featureType: ['MV:B'], progression: { '*': 2 } },
        ],
      },
      source: { kind: 'feat', tag: 'feat:asi-4', label: 'Martial Adept' },
    }
    const d = withDeps([fighter()], INVOCATIONS)
    const sources = collectSources(c, d)
    const slots = optionSlots(c, sources.classes, [martial], INVOCATIONS)
    const cards = optionCards({ ...sources, optionSlots: slots }, d)
    expect(cards.map((x) => [x.label, x.count])).toEqual(
      expect.arrayContaining([
        ['Class · Fighter maneuvers', 1],
        ['Feat · Martial Adept maneuvers', 2],
      ]),
    )
    const maneuver = cards
      .find((x) => x.label === 'Class · Fighter maneuvers')
      ?.chips.find((x) => x.label === 'Trip Attack')
    expect(maneuver?.unmet).toBeUndefined()
    expect(maneuver?.detail?.facts).toEqual(
      expect.arrayContaining([
        { label: 'Uses', value: '1 Superiority Die' },
        { label: 'Item', value: 'A weapon' },
        { label: 'Prerequisite', value: 'Renown 3+' },
      ]),
    )
  })

  it('knows a required option outright and counts it inside the progression', () => {
    const monk = loadedClass('Monk', [], [])
    monk.file = {
      subclass: [
        {
          name: 'Way of the Four Elements',
          shortName: 'Four Elements',
          source: 'PHB',
          className: 'Monk',
          classSource: 'PHB',
          subclassFeatures: [],
          optionalfeatureProgression: [
            {
              name: 'Elemental Disciplines',
              featureType: ['ED'],
              progression: { '3': 2, '6': 3 },
              required: { '3': ['Elemental Attunement|PHB'] },
            },
          ],
        },
      ],
    }
    const disciplines: ClassOption[] = [
      { ...invocation('Elemental Attunement', 'PHB'), types: ['ED'] },
      {
        ...invocation('Fist of Four Thunders', 'PHB'),
        types: ['ED'],
        prerequisite: [
          {
            level: {
              level: 6,
              class: { name: 'Monk' },
              subclass: { name: 'Four Elements' },
            },
          },
        ],
      },
    ]
    const c = build('Monk', 3, {}, [])
    c.classes = [
      {
        ...c.classes[0],
        subclass: {
          name: 'Way of the Four Elements',
          shortName: 'Four Elements',
          source: 'PHB',
        },
      },
    ]
    const [card] = cardsOf(c, [monk], disciplines)
    expect(card).toMatchObject({ count: 1, label: 'Class · Monk elemental disciplines' })
    expect(card.note).toContain('Elemental Attunement: known outright')
    expect(card.chips.map((x) => [x.label, x.unmet])).toEqual([
      [
        'Fist of Four Thunders',
        'Needs Level 6 Monk (Four Elements) - allowed with DM approval',
      ],
    ])
    const d = withDeps([monk], disciplines)
    expect([...collectSources(c, d).options]).toEqual(['Elemental Attunement|PHB'])
  })
})

// ---- Features that list features to choose from ------------------------------------

const ref = (name: string, level: number) => ({
  type: 'refSubclassFeature',
  subclassFeature: `${name}|Barbarian||Totem Warrior||${level}`,
})

const sub = (name: string, level: number, entries: unknown[]) => ({
  name,
  source: 'PHB',
  className: 'Barbarian',
  classSource: 'PHB',
  subclassShortName: 'Totem Warrior',
  subclassSource: 'PHB',
  level,
  entries: entries as string[],
})

const barbarian = (): LoadedClass => {
  const base = loadedClass('Barbarian', [], [])
  return {
    entry: base.entry,
    file: {
      subclass: [
        {
          name: 'Path of the Totem Warrior',
          shortName: 'Totem Warrior',
          source: 'PHB',
          className: 'Barbarian',
          classSource: 'PHB',
          subclassFeatures: ['Path of the Totem Warrior|Barbarian||Totem Warrior||3'],
        },
      ],
      subclassFeature: [
        sub('Path of the Totem Warrior', 3, ['A path.', ref('Totem Spirit', 3)]),
        sub('Totem Spirit', 3, [
          'Choose a totem.',
          { type: 'options', count: 1, entries: [ref('Bear', 3), ref('Eagle', 3)] },
        ]),
        sub('Bear', 3, ['Resistance to all damage but psychic.']),
        sub('Eagle', 3, ['Dash as a bonus action.']),
      ],
    },
  }
}

const totemOf = (level: number) => {
  const c = build('Barbarian', level, {}, [])
  c.classes = [
    {
      ...c.classes[0],
      subclass: {
        name: 'Path of the Totem Warrior',
        shortName: 'Totem Warrior',
        source: 'PHB',
      },
    },
  ]
  return c
}

describe('features to choose from', () => {
  it('offers the totems of Totem Spirit as a card of their own, each with its text', () => {
    const [card] = cardsOf(totemOf(3), [barbarian()], [])
    expect(card).toMatchObject({
      tag: 'class:Barbarian|PHB|feature:Totem Spirit|3',
      label: 'Class · Barbarian Totem Spirit',
      noun: 'Totem Spirit options',
      count: 1,
      left: 1,
    })
    expect(card.chips.map((x) => [x.value, x.label, x.detail?.entries])).toEqual([
      [
        'Bear|Barbarian||Totem Warrior||3',
        'Bear',
        ['Resistance to all damage but psychic.'],
      ],
      ['Eagle|Barbarian||Totem Warrior||3', 'Eagle', ['Dash as a bonus action.']],
    ])
    expect(cardsOf(build('Barbarian', 3, {}, []), [barbarian()], [])).toEqual([])
  })

  it('holds only the totem taken, and lists it with the features', () => {
    const bear = {
      subclassFeature: {
        className: 'Barbarian',
        shortName: 'Totem Warrior',
        source: 'PHB',
        name: 'Bear',
      },
    }
    const c = totemOf(3)
    const d = withDeps([barbarian()], [])
    expect(heldBy(collectSources(c, d), bear)).toBeUndefined()
    c.classOptions = {
      'class:Barbarian|PHB|feature:Totem Spirit|3': ['Bear|Barbarian||Totem Warrior||3'],
    }
    const sources = collectSources(c, d)
    expect(heldBy(sources, bear)).toBeDefined()
    expect(featureRows(sources)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Bear (Totem Spirit)',
          from: 'Barbarian',
          level: 3,
        }),
      ]),
    )
    const [card] = optionCards(sources, d)
    expect(card.chips.map((x) => x.state)).toEqual(['picked', 'full'])
    expect(featureNames(sources.classes)).toEqual(new Set(['path of the totem warrior']))
  })
})

// ---- Optional class features -----------------------------------------------------------

const rangerFeature = (
  name: string,
  source: string,
  level: number,
  entries: unknown[],
) => ({
  name,
  source,
  className: 'Ranger',
  classSource: 'PHB',
  level,
  entries: entries as string[],
  ...(source === 'TCE' && { isClassFeatureVariant: true }),
})

const ranger = (): LoadedClass =>
  loadedClass('Ranger', [], [], {
    classFeature: [
      rangerFeature('Favored Enemy', 'PHB', 1, ['Choose a type of favored enemy.']),
      rangerFeature('Favored Foe', 'TCE', 1, [
        '{@i 1st-level ranger {@variantrule optional class features|tce|optional feature}, which replaces the Favored Enemy feature}',
        'Mark a foe.',
      ]),
      rangerFeature('Natural Explorer', 'PHB', 1, ['Choose a favored terrain.']),
      rangerFeature('Deft Explorer', 'TCE', 1, [
        '{@i optional feature, which replaces the Natural Explorer feature}',
        'Canny.',
      ]),
      rangerFeature('Spellcasting Focus', 'TCE', 2, [
        '{@i optional feature}',
        'A focus.',
      ]),
      rangerFeature('Deft Explorer Improvement', 'TCE', 6, ['Roving.']),
      rangerFeature('Favored Enemy improvement', 'PHB', 6, ['Another enemy.']),
    ],
  })

const FOE = { classFeature: { className: 'Ranger', source: 'TCE', name: 'Favored Foe' } }
const ENEMY = {
  classFeature: { className: 'Ranger', source: 'PHB', name: 'Favored Enemy' },
}
const FOCUS = {
  classFeature: { className: 'Ranger', source: 'TCE', name: 'Spellcasting Focus' },
}
const IMPROVEMENT = {
  classFeature: { className: 'Ranger', source: 'TCE', name: 'Deft Explorer Improvement' },
}
const ENEMY_MORE = {
  classFeature: { className: 'Ranger', source: 'PHB', name: 'Favored Enemy improvement' },
}

const rangerOf = (level: number, books: string[]) => {
  const c = build('Ranger', level, {}, [])
  c.selectedBooks = books
  return c
}

const FOE_TAG = 'class:Ranger|PHB|feature:Favored Foe|1'
const ENEMY_PICK = 'class:Ranger|PHB|pick:Favored Enemy'
const TERRAIN_PICK = 'class:Ranger|PHB|pick:Natural Explorer'

describe('optional class features', () => {
  it('gives no optional feature without its book, and keeps the feature it would replace', () => {
    const c = rangerOf(6, ['PHB'])
    const d = withDeps([ranger()], [])
    const sources = collectSources(c, d)
    // Only the lists of the features had: favored enemies and terrains.
    expect(optionCards(sources, d).map((x) => x.tag)).toEqual([ENEMY_PICK, TERRAIN_PICK])
    expect(heldBy(sources, FOE)).toBeUndefined()
    expect(heldBy(sources, FOCUS)).toBeUndefined()
    expect(heldBy(sources, IMPROVEMENT)).toBeUndefined()
    expect(heldBy(sources, ENEMY)).toBeDefined()
    expect(heldBy(sources, ENEMY_MORE)).toBeDefined()
    expect(featureRows(sources).map((f) => f.name)).toEqual([
      'Favored Enemy',
      'Natural Explorer',
      'Favored Enemy improvement',
    ])
  })

  it('offers each replacing feature as a choice, the replaced one had until it is taken', () => {
    const c = rangerOf(6, ['PHB', 'TCE'])
    const d = withDeps([ranger()], [])
    const sources = collectSources(c, d)
    const cards = optionCards(sources, d)
    expect(cards.map((x) => x.tag)).toEqual([
      FOE_TAG,
      'class:Ranger|PHB|feature:Deft Explorer|1',
      ENEMY_PICK,
      TERRAIN_PICK,
    ])
    expect(cards[0]).toMatchObject({ count: 1, left: 1 })
    expect(cards[0].note).toBe(
      "Favored Foe (level 1) is an optional class feature that replaces Favored Enemy: take one or the other, with your DM's approval. Until you choose, you have Favored Enemy.",
    )
    expect(
      cards[0].chips.map((x) => [x.label, x.state, x.detail?.facts[1].value]),
    ).toEqual([
      ['Favored Enemy', 'available', 'PHB'],
      ['Favored Foe', 'available', 'TCE'],
    ])
    expect(heldBy(sources, ENEMY)).toBeDefined()
    expect(heldBy(sources, FOE)).toBeUndefined()
    // One that replaces nothing is simply had with its book.
    expect(heldBy(sources, FOCUS)).toBeDefined()
    expect(heldBy(sources, IMPROVEMENT)).toBeUndefined()
    expect(featureRows(sources).map((f) => f.name)).toEqual([
      'Favored Enemy',
      'Natural Explorer',
      'Spellcasting Focus',
      'Favored Enemy improvement',
    ])
  })

  it('has the optional feature once taken, without the one it replaces or what goes with it', () => {
    const c = rangerOf(6, ['PHB', 'TCE'])
    c.classOptions = {
      [FOE_TAG]: ['Favored Foe|Ranger|PHB|1'],
      'class:Ranger|PHB|feature:Deft Explorer|1': ['Deft Explorer|Ranger|PHB|1'],
    }
    const d = withDeps([ranger()], [])
    const sources = collectSources(c, d)
    expect(heldBy(sources, FOE)).toBeDefined()
    expect(heldBy(sources, ENEMY)).toBeUndefined()
    expect(heldBy(sources, ENEMY_MORE)).toBeUndefined()
    expect(heldBy(sources, IMPROVEMENT)).toBeDefined()
    expect(featureRows(sources).map((f) => f.name)).toEqual([
      'Favored Foe',
      'Deft Explorer',
      'Spellcasting Focus',
      'Deft Explorer Improvement',
    ])
    const [card, ...rest] = optionCards(sources, d)
    expect(card.chips.map((x) => x.state)).toEqual(['full', 'picked'])
    // No favored enemies or terrains once both features are given up.
    expect(rest.map((x) => x.tag)).toEqual(['class:Ranger|PHB|feature:Deft Explorer|1'])
    // Keeping the original is a choice made: the card is done.
    c.classOptions = { [FOE_TAG]: ['Favored Enemy|Ranger|PHB|1'] }
    const kept = collectSources(c, d)
    expect(heldBy(kept, ENEMY)).toBeDefined()
    expect(heldBy(kept, FOE)).toBeUndefined()
    expect(optionCards(kept, d)[0]).toMatchObject({ left: 0, used: 1 })
  })

  it('reads the feature replaced from the first line, a tag read as its name', () => {
    expect(replacedName(['{@i which replaces the Divine Strike feature}'])).toBe(
      'Divine Strike',
    )
    expect(
      replacedName([
        'This feature replaces the {@classFeature Roving|Ranger|XPHB|6} feature for a Hunter.',
      ]),
    ).toBe('Roving')
    expect(
      replacedName([{ type: 'entries', entries: [] }, '{@i optional}']),
    ).toBeUndefined()
  })

  it('shows in a text only the features it takes in by reference that are had', () => {
    const kept = {
      type: 'refSubclassFeature',
      subclassFeature: "Ranger's Companion|Ranger||Beast Master||3",
    }
    const entries = [
      'Your companion.',
      {
        type: 'entries',
        entries: [
          kept,
          {
            type: 'refSubclassFeature',
            subclassFeature: 'Primal Companion|Ranger||Beast Master||3|TCE',
          },
          { type: 'refClassFeature', classFeature: 'Harness|Paladin||3|TCE' },
        ],
      },
    ]
    const withheld = new Set([
      'subclassFeature|Primal Companion|TCE|Ranger|Beast Master',
      'classFeature|Harness|TCE|Paladin',
    ])
    expect(heldEntries(entries, (id) => withheld.has(id))).toEqual([
      'Your companion.',
      { type: 'entries', entries: [kept] },
    ])
  })

  it('gives a feature of one build to that build only, in place of the one it replaces', () => {
    const roving = rangerFeature('Roving', 'XPHB', 6, ['Speed.'])
    const pet = {
      ...rangerFeature('Pet Specialization', 'WoW', 6, [
        'This feature replaces the {@classFeature Roving|Ranger|XPHB|6} feature for a Hunter.',
      ]),
      isClassFeatureVariant: true,
    }
    const loaded = loadedClass('Hunter', [], [], { classFeature: [roving, pet] })
    const row = { name: 'Hunter', source: 'PHB', level: 6 }
    const fixedOf = (shortName?: string) =>
      variantChoices(
        [
          {
            row: shortName
              ? { ...row, subclass: { name: shortName, shortName, source: 'WoW' } }
              : row,
            loaded,
            level: 6,
          },
        ],
        ['WoW'],
      ).fixed
    expect(fixedOf()).toEqual([
      { id: 'classFeature|Pet Specialization|WoW|Ranger', held: false },
    ])
    expect(fixedOf('Beast Master')).toEqual([
      { id: 'classFeature|Pet Specialization|WoW|Ranger', held: true },
      { id: 'classFeature|Roving|XPHB|Ranger', held: false },
    ])
  })
})
