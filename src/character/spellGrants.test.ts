import { describe, expect, it } from 'vitest'
import type { LoadedClass, SubclassEntry } from '../data/class'
import type { PlayableBackground } from '../data/background'
import type { PlayableRace } from '../data/race'
import { makeFeat } from '../test/featFixtures'
import { createCharacter, type Character } from './model'
import type { FeatSlot } from './feats'
import { makeSpell } from '../test/spellFixtures'
import {
  grantedSpell,
  resolveSpellGrants,
  spellsByName,
  type SpellGrantContext,
} from './spellGrants'

const slot = (id: string): FeatSlot => ({
  id,
  label: id,
  origin: 'bonus',
  allowsAsi: false,
  categories: 'any',
  named: [],
  preferred: [],
  level: 0,
})

const domain: SubclassEntry = {
  name: 'Life Domain',
  shortName: 'Life',
  source: 'PHB',
  className: 'Cleric',
  classSource: 'PHB',
  edition: 'classic',
  subclassFeatures: [],
  additionalSpells: [
    {
      prepared: {
        '1': ['bless', 'cure wounds'],
        '3': ['lesser restoration', 'spiritual weapon'],
      },
    },
  ],
}

const cleric: LoadedClass = {
  entry: {
    name: 'Cleric',
    source: 'PHB',
    edition: 'classic',
    classFeatures: [],
    additionalSpells: [{ expanded: { '10': [{ all: 'level=1|class=Wizard' }] } }],
  },
  file: { subclass: [domain] },
}

const characterOf = (level: number, extra: Partial<Character> = {}): Character => ({
  ...createCharacter(),
  classes: [
    {
      name: 'Cleric',
      source: 'PHB',
      level,
      subclass: { name: 'Life Domain', shortName: 'Life', source: 'PHB' },
    },
  ],
  ...extra,
})

const race = (additionalSpells: unknown[]): PlayableRace => ({
  key: 'tiefling|phb',
  name: 'Tiefling',
  baseName: 'Tiefling',
  source: 'PHB',
  edition: 'classic',
  abilityOptions: [],
  featGrants: [],
  additionalSpells,
})

const context = (extra: Partial<SpellGrantContext> = {}): SpellGrantContext => ({
  featSlots: [],
  classByKey: new Map([['Cleric|PHB', cleric]]),
  ...extra,
})

describe('resolveSpellGrants', () => {
  it('reads a subclass: always prepared by class level, locked above it', () => {
    const { grants } = resolveSpellGrants(characterOf(1), context())
    const prepared = grants.filter((g) => g.origin === 'subclass')
    expect(prepared.map((g) => g.spell?.name)).toEqual([
      'bless',
      'cure wounds',
      'lesser restoration',
      'spiritual weapon',
    ])
    expect(prepared.map((g) => g.locked)).toEqual([false, false, true, true])
    expect(prepared[0]).toMatchObject({
      from: 'Life Domain',
      classKey: 'Cleric|PHB',
      mode: 'prepared',
      gate: 1,
      uses: '',
    })
    const later = resolveSpellGrants(characterOf(3), context()).grants
    expect(later.filter((g) => g.origin === 'subclass' && g.locked)).toEqual([])
  })

  it('reads a class: a whole list added at a level', () => {
    const { grants } = resolveSpellGrants(characterOf(10), context())
    const added = grants.find((g) => g.origin === 'class')
    expect(added).toMatchObject({ mode: 'expanded', gate: 10, locked: false })
    expect(added?.all?.classes).toEqual(['Wizard'])
    expect(
      resolveSpellGrants(characterOf(5), context()).grants.find(
        (g) => g.origin === 'class',
      )?.locked,
    ).toBe(true)
  })

  it('reads a species: cantrips, daily and ability choices', () => {
    const tiefling = race([
      {
        ability: { choose: ['int', 'wis', 'cha'] },
        known: { '1': ['thaumaturgy#c'] },
        innate: {
          '3': { daily: { '1': ['hellish rebuke|phb'] } },
          '5': { daily: { '1': ['darkness'] } },
        },
      },
    ])
    const { grants } = resolveSpellGrants(characterOf(3), context({ race: tiefling }))
    const own = grants.filter((g) => g.origin === 'race')
    expect(own.map((g) => [g.spell?.name, g.uses, g.locked, g.spell?.cantrip])).toEqual([
      ['hellish rebuke', '1 per long rest', false, false],
      ['darkness', '1 per long rest', true, false],
      ['thaumaturgy', '', false, true],
    ])
    expect(own[2].ability).toEqual({ kind: 'choose', keys: ['int', 'wis', 'cha'] })
    expect(own[0].spell?.source).toBe('phb')
    expect(own[0].edition).toBe('classic')
  })

  it('offers named sets as variants and hides the others', () => {
    const legacy = race([
      { name: 'Infernal', ability: 'cha', known: { '1': ['thaumaturgy#c'] } },
      { name: 'Abyssal', ability: 'cha', known: { '1': ['poison spray#c'] } },
    ])
    const none = resolveSpellGrants(characterOf(1), context({ race: legacy }))
    expect(none.variants).toEqual([
      {
        id: 'race:variant',
        from: 'Tiefling',
        names: ['Infernal', 'Abyssal'],
        selected: undefined,
        // What each set gives is known before one is taken, so they can be compared.
        options: [
          { name: 'Infernal', grants: [expect.objectContaining({ gate: 1 })] },
          { name: 'Abyssal', grants: [expect.objectContaining({ gate: 1 })] },
        ],
      },
    ])
    expect(none.variants[0].options.map((o) => o.grants[0].spell?.name)).toEqual([
      'thaumaturgy',
      'poison spray',
    ])
    expect(none.grants.filter((g) => g.origin === 'race')).toEqual([])
    expect([...none.knownIds].filter((id) => id.startsWith('race:'))).toHaveLength(3)

    const taken = resolveSpellGrants(
      characterOf(1, {
        spellGrants: { 'race:variant': { picks: [], variant: 'Abyssal' } },
      }),
      context({ race: legacy }),
    )
    expect(taken.variants[0].selected).toBe('Abyssal')
    expect(
      taken.grants
        .filter((g) => g.origin === 'race')
        .map((g) => [g.spell?.name, g.variant]),
    ).toEqual([['poison spray', 'Abyssal']])
    // A stored name the data no longer has is no choice.
    const stale = resolveSpellGrants(
      characterOf(1, { spellGrants: { 'race:variant': { picks: [], variant: 'Gone' } } }),
      context({ race: legacy }),
    )
    expect(stale.variants[0].selected).toBeUndefined()
  })

  it('reads a feat: choices from a filter, a count, and how it is cast', () => {
    const initiate = makeFeat({
      name: 'Magic Initiate',
      additionalSpells: [
        {
          name: 'Cleric Spells',
          ability: { choose: ['int', 'wis', 'cha'] },
          innate: { _: { daily: { '1': [{ choose: 'level=1|class=Cleric' }] } } },
          known: { _: [{ choose: 'level=0|class=Cleric', count: 2 }] },
        },
      ],
    })
    const touched = makeFeat({
      name: 'Fey Touched',
      additionalSpells: [
        {
          ability: 'inherit',
          innate: {
            _: { daily: { '1e': ['misty step', { choose: 'level=1|school=E;D' }] } },
          },
        },
      ],
    })
    const { grants } = resolveSpellGrants(
      characterOf(1),
      context({
        featSlots: [
          { slot: slot('a'), feat: initiate },
          { slot: slot('b'), feat: touched },
          { slot: slot('empty'), feat: undefined },
        ],
      }),
    )
    const feats = grants.filter((g) => g.origin === 'feat')
    expect(feats).toHaveLength(4)
    const cantrips = feats.find((g) => g.mode === 'known')
    expect(cantrips?.pick?.count).toBe(2)
    expect(cantrips?.pick?.filter.levels).toEqual([0])
    expect(cantrips?.id).toBe('feat:a:0:known:_:0:0')
    expect(feats.find((g) => g.mode === 'innate')?.uses).toBe('1 per long rest')
    expect(feats.filter((g) => g.from === 'Fey Touched').map((g) => g.uses)).toEqual([
      '1 per long rest each',
      '1 per long rest each',
    ])
    expect(feats.find((g) => g.spell?.name === 'misty step')?.ability).toEqual({
      kind: 'inherit',
    })
  })

  it('reads a background and an optional feature', () => {
    const background: PlayableBackground = {
      key: 'x|y',
      name: 'Acolyte',
      source: 'GGR',
      edition: 'classic',
      abilityOptions: [],
      featGrants: [],
      storyTables: [],
      entries: [],
      additionalSpells: [{ expanded: { s1: ['command'], s2: ['hold person'] } }],
    }
    const { grants } = resolveSpellGrants(
      characterOf(1),
      context({
        background,
        options: [
          {
            key: 'devil|phb',
            name: 'Devil’s Sight',
            additionalSpells: [{ innate: { _: ['darkness'] } }],
          },
        ],
      }),
    )
    const expanded = grants.filter((g) => g.origin === 'background')
    expect(expanded.map((g) => [g.mode, g.spell?.name, g.spellLevel])).toEqual([
      ['expanded', 'command', 1],
      ['expanded', 'hold person', 2],
    ])
    expect(grants.find((g) => g.origin === 'option')).toMatchObject({
      from: 'Devil’s Sight',
      uses: 'At will',
    })
  })

  it('reads every way a spell is cast', () => {
    const blocks = [
      {
        resourceName: 'Sorcery Points',
        innate: {
          '1': {
            will: ['light'],
            ritual: ['detect magic'],
            rest: { '1': ['misty step'] },
            resource: { '3': ['summon beast'] },
            daily: { pb: ['bless'], int: ['shield'] },
          },
        },
      },
    ]
    const { grants } = resolveSpellGrants(
      { ...characterOf(1), classes: [] },
      context({ race: race(blocks) }),
    )
    expect(grants.map((g) => [g.spell?.name, g.uses])).toEqual([
      ['light', 'At will'],
      ['detect magic', 'Ritual only'],
      ['bless', 'Proficiency bonus times per long rest'],
      ['shield', 'INT modifier times per long rest'],
      ['misty step', '1 per short or long rest'],
      ['summon beast', 'Costs 3 Sorcery Points'],
    ])
  })

  it('skips what it cannot read and sources it does not have', () => {
    const odd = race([
      null,
      { known: { _: [{}, 3, ''] }, ability: 'luck' },
      { known: 'x' },
    ])
    const { grants } = resolveSpellGrants(
      {
        ...characterOf(1),
        classes: [{ name: 'Nobody', source: 'X', level: 1 }],
      },
      context({ race: odd }),
    )
    expect(grants).toEqual([])
  })
})

describe('level of a character with no class', () => {
  it('counts as level 1 for what a species gives', () => {
    const blocks = [{ known: { '1': ['light#c'] }, innate: { '3': ['fire bolt'] } }]
    const { grants } = resolveSpellGrants(
      { ...characterOf(1), classes: [] },
      context({ race: race(blocks) }),
    )
    expect(grants.map((g) => g.locked)).toEqual([true, false])
  })
})

describe('grantedSpell', () => {
  const light2014 = makeSpell({ name: 'Light', source: 'PHB', level: 0 })
  const light2024 = makeSpell({ name: 'Light', source: 'XPHB', edition: 'one', level: 0 })
  const byName = spellsByName([light2014, light2024])
  const grant = (edition: 'classic' | 'one' | undefined, source = '') => {
    const { grants } = resolveSpellGrants(
      { ...characterOf(1), classes: [] },
      context({
        race: {
          ...race([{ known: { '1': [source ? `light|${source}#c` : 'light#c'] } }]),
          edition,
        },
      }),
    )
    return grants[0]
  }

  it('takes the book the data names', () => {
    expect(grantedSpell(grant('classic', 'xphb'), byName)).toBe(light2024)
  })

  it('takes the spell of the giving source’s edition when no book is named', () => {
    expect(grantedSpell(grant('one'), byName)).toBe(light2024)
    expect(grantedSpell(grant('classic'), byName)).toBe(light2014)
    expect(grantedSpell(grant(undefined), byName)).toBe(light2014)
  })

  it('finds nothing for a spell the data does not have, or a grant that names none', () => {
    expect(grantedSpell(grant('classic'), new Map())).toBeUndefined()
    const { grants } = resolveSpellGrants(characterOf(10), context())
    expect(
      grantedSpell(
        grants.find((g) => g.all)!,
        byName,
      ),
    ).toBeUndefined()
  })
})
