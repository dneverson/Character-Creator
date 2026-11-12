import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isOnClassList,
  listStanding,
  loadSpells,
  _clearSpellCache,
  schoolName,
  spellLevelLabel,
  standingProblem,
  type Spell,
} from './spells'
import { listsOf, makeSpell } from '../test/spellFixtures'
import { fetchData } from './dataClient'

vi.mock('./dataClient', () => ({ fetchData: vi.fn() }))
const mockFetch = vi.mocked(fetchData)

beforeEach(() => {
  _clearSpellCache()
  mockFetch.mockReset()
})

describe('schoolName', () => {
  it('maps school codes and passes through unknown codes', () => {
    expect(schoolName('V')).toBe('Evocation')
    expect(schoolName('A')).toBe('Abjuration')
    expect(schoolName('Z')).toBe('Z')
  })
})

describe('spellLevelLabel', () => {
  it('labels cantrips and ordinal levels', () => {
    expect(spellLevelLabel(0)).toBe('Cantrip')
    expect(spellLevelLabel(1)).toBe('1st level')
    expect(spellLevelLabel(2)).toBe('2nd level')
    expect(spellLevelLabel(3)).toBe('3rd level')
    expect(spellLevelLabel(4)).toBe('4th level')
    expect(spellLevelLabel(9)).toBe('9th level')
  })
})

describe('loadSpells', () => {
  it('normalizes spells, attaches class lists, and sorts by level then name', async () => {
    mockFetch.mockImplementation((path: string) => {
      if (path === 'spells/index.json') return Promise.resolve({ PHB: 'phb.json' })
      if (path === 'generated/gendata-spell-source-lookup.json') {
        return Promise.resolve({
          phb: {
            fireball: { class: { PHB: { Wizard: true, Sorcerer: true } } },
          },
        })
      }
      return Promise.resolve({
        spell: [
          {
            name: 'Fireball',
            source: 'PHB',
            level: 3,
            school: 'V',
            meta: { ritual: false },
            duration: [{ concentration: false }],
            components: { v: true, s: true, m: 'bat guano' },
          },
          {
            name: 'Light',
            source: 'PHB',
            level: 0,
            school: 'V',
            duration: [{ concentration: true }],
          },
        ],
      })
    })

    const spells = await loadSpells()
    expect(spells.map((s) => s.name)).toEqual(['Light', 'Fireball']) // cantrip first
    const fireball = spells.find((s) => s.name === 'Fireball')!
    expect(fireball.lists.classes).toEqual(['Sorcerer|PHB', 'Wizard|PHB']) // sorted
    expect(fireball.concentration).toBe(false)
    expect(spells.find((s) => s.name === 'Light')!.concentration).toBe(true)
    expect(spells.find((s) => s.name === 'Light')!.lists.classes).toEqual([])
  })

  it('keeps the class lists of each class source apart (2014 against 2024)', async () => {
    mockFetch.mockImplementation((path: string) => {
      if (path === 'spells/index.json') return Promise.resolve({ PHB: 'phb.json' })
      if (path === 'generated/gendata-spell-source-lookup.json') {
        return Promise.resolve({
          phb: {
            fireball: {
              class: { PHB: { Sorcerer: true, Wizard: true } },
              classVariant: { PHB: { Ranger: { definedInSources: ['FTD'] } } },
              subclass: {
                PHB: {
                  Fighter: { PHB: { 'Eldritch Knight': { name: 'Eldritch Knight' } } },
                },
              },
            },
            'acid splash': {
              class: {
                PHB: { Wizard: true },
                XPHB: { Wizard: true, Sorcerer: true },
                WoW: { Mage: { definedInSources: ['WoW'] } },
              },
            },
          },
        })
      }
      return Promise.resolve({
        spell: [
          { name: 'Fireball', source: 'PHB', level: 3, school: 'V' },
          { name: 'Acid Splash', source: 'PHB', level: 0, school: 'C' },
        ],
      })
    })

    const spells = await loadSpells()
    const acid = spells.find((s) => s.name === 'Acid Splash')!
    expect(acid.lists.classes).toEqual([
      'Mage|WoW',
      'Sorcerer|XPHB',
      'Wizard|PHB',
      'Wizard|XPHB',
    ])
    const fireball = spells.find((s) => s.name === 'Fireball')!
    expect(fireball.lists.classes).toEqual(['Sorcerer|PHB', 'Wizard|PHB'])
    expect(fireball.lists.classes).not.toContain('Wizard|XPHB')
    expect(fireball.lists.variants).toEqual({ 'Ranger|PHB': ['FTD'] })
    expect(fireball.lists.subclasses).toEqual(['Fighter|PHB|Eldritch Knight'])
    expect(fireball.key).toBe('fireball|phb')
    // A class list the lookup holds only where a book defines it keeps that book.
    expect(acid.lists.definedIn).toEqual({ 'Mage|WoW': ['WoW'] })
    expect(fireball.lists.definedIn).toEqual({})
  })

  it('takes the edition from the date the book was published', async () => {
    mockFetch.mockImplementation((path: string) => {
      if (path === 'spells/index.json') return Promise.resolve({ PHB: 'phb.json' })
      if (path === 'generated/gendata-spell-source-lookup.json')
        return Promise.resolve({})
      if (path === 'books.json')
        return Promise.resolve({
          book: [
            { source: 'PHB', published: '2014-08-19' },
            { source: 'XPHB', published: '2024-09-17' },
            { source: 'AU', published: '2026-09-15' },
          ],
        })
      return Promise.resolve({
        spell: [
          { name: 'A', source: 'PHB', level: 1, school: 'V' },
          { name: 'B', source: 'XPHB', level: 1, school: 'V' },
          { name: 'C', source: 'AU', level: 1, school: 'V' },
          { name: 'D', source: 'UNDATED', level: 1, school: 'V' },
        ],
      })
    })
    const spells = await loadSpells()
    expect(spells.map((s) => [s.name, s.edition])).toEqual([
      ['A', 'classic'],
      ['B', 'one'],
      ['C', 'one'],
      ['D', 'classic'],
    ])
  })

  it('reads the facts of real spell shapes into text', async () => {
    mockFetch.mockImplementation((path: string) => {
      if (path === 'spells/index.json') return Promise.resolve({ PHB: 'phb.json' })
      if (path === 'generated/gendata-spell-source-lookup.json')
        return Promise.resolve({})
      if (path === 'books.json') return Promise.resolve({ book: [] })
      return Promise.resolve({
        spell: [
          {
            name: 'Fireball',
            source: 'PHB',
            level: 3,
            school: 'V',
            time: [{ number: 1, unit: 'action' }],
            range: { type: 'point', distance: { type: 'feet', amount: 150 } },
            components: { v: true, s: true, m: 'a tiny ball of bat guano and sulfur' },
            duration: [{ type: 'instant' }],
            entries: ['takes {@damage 8d6} fire damage on a failed save'],
            entriesHigherLevel: [
              {
                type: 'entries',
                name: 'At Higher Levels',
                entries: [
                  'increases by {@scaledamage 8d6|3-9|1d6} for each slot level above 3rd.',
                ],
              },
            ],
            damageInflict: ['fire'],
            savingThrow: ['dexterity'],
            areaTags: ['S'],
            miscTags: ['BO', 'OBJ'],
          },
          {
            name: 'Acid Splash',
            source: 'PHB',
            level: 0,
            school: 'C',
            alias: ['Acid Spit'],
            time: [{ number: 1, unit: 'action' }],
            range: { type: 'point', distance: { type: 'feet', amount: 60 } },
            duration: [{ type: 'instant' }],
            entries: [
              'take {@damage 1d6} acid damage. Increases by {@damage 1d6} ({@damage 2d6}).',
            ],
            scalingLevelDice: {
              label: 'acid damage',
              scaling: { '1': '1d6', '5': '2d6', '11': '3d6', '17': '4d6' },
            },
            damageInflict: ['acid'],
            savingThrow: ['dexterity'],
          },
          {
            name: 'Cure Wounds',
            source: 'PHB',
            level: 1,
            school: 'V',
            range: { type: 'point', distance: { type: 'touch' } },
            time: [{ number: 1, unit: 'action' }],
            duration: [{ type: 'instant' }],
            entries: [
              'regains hit points equal to {@dice 2d8} + your spellcasting ability modifier.',
            ],
            affectsCreatureType: ['beast'],
            miscTags: ['HL'],
          },
          {
            name: 'Dream',
            source: 'PHB',
            level: 5,
            school: 'I',
            time: [{ number: 1, unit: 'minute' }],
            range: { type: 'special' },
            duration: [{ type: 'timed', duration: { type: 'hour', amount: 8 } }],
            entries: [],
            damageInflict: ['psychic'],
          },
          {
            name: 'Eldritch Blast',
            source: 'PHB',
            level: 0,
            school: 'V',
            time: [{ number: 1, unit: 'action' }],
            range: { type: 'point', distance: { type: 'feet', amount: 120 } },
            duration: [{ type: 'instant' }],
            entries: ['takes {@damage 1d10} force damage.'],
            spellAttack: ['R'],
            damageInflict: ['force'],
          },
          {
            name: 'Burning Hands',
            source: 'PHB',
            level: 1,
            school: 'V',
            time: [{ number: 1, unit: 'action' }],
            range: { type: 'cone', distance: { type: 'feet', amount: 15 } },
            duration: [{ type: 'instant' }],
            entries: [],
            conditionInflict: ['frightened'],
          },
          {
            name: 'Sending Stone',
            source: 'PHB',
            level: 3,
            school: 'D',
            meta: { ritual: true },
            components: {
              v: true,
              s: true,
              m: { text: 'a gem worth 500 gp', cost: 50000, consume: true },
            },
            duration: [
              {
                type: 'timed',
                duration: { type: 'minute', amount: 1 },
                concentration: true,
              },
            ],
            entries: [],
          },
        ],
      })
    })

    const byName = new Map((await loadSpells()).map((s) => [s.name, s]))
    const fireball = byName.get('Fireball')!
    expect(fireball).toMatchObject({
      casting: '1 action',
      castingUnit: 'Action',
      range: '150 ft.',
      rangeFeet: 150,
      duration: 'Instantaneous',
      durationKind: 'Instantaneous',
      damage: '8d6',
      damageAverage: 28,
      damageTypes: ['Fire'],
      save: ['Dexterity'],
      area: 'Sphere',
      tags: ['Ignites flammable objects', 'Affects objects'],
      upcast: '+1d6 per slot level above 3rd',
      components: { v: true, s: true, m: true, royalty: false },
    })
    const acid = byName.get('Acid Splash')!
    expect(acid).toMatchObject({
      damage: '1d6',
      damageAverage: 3.5,
      damageTypes: ['Acid'],
      aliases: ['Acid Spit'],
      cantripScaling: '1d6, 2d6 at 5, 3d6 at 11, 4d6 at 17',
    })
    expect(byName.get('Cure Wounds')).toMatchObject({
      healing: '2d8 + spellcasting modifier',
      creatureTypes: ['Beast'],
      range: 'Touch',
    })
    expect(byName.get('Dream')).toMatchObject({
      range: 'Special',
      casting: '1 minute',
      duration: '8 hours',
      durationKind: 'Timed',
      damage: '',
      damageAverage: 0,
      damageTypes: ['Psychic'],
    })
    expect(byName.get('Eldritch Blast')).toMatchObject({
      attack: 'Ranged',
      damage: '1d10',
      damageTypes: ['Force'],
    })
    expect(byName.get('Burning Hands')).toMatchObject({
      range: 'Self (15-ft. cone)',
      area: '15-ft. cone',
      conditions: ['Frightened'],
    })
    const stone = byName.get('Sending Stone')!
    expect(stone.ritual).toBe(true)
    expect(stone.concentration).toBe(true)
    expect(stone.material).toEqual({
      text: 'a gem worth 500 gp',
      costGp: 500,
      consumed: true,
    })
  })

  it('carries the name the SRD gives a spell when the book names it differently', async () => {
    mockFetch.mockImplementation((path: string) => {
      if (path === 'spells/index.json') return Promise.resolve({ PHB: 'phb.json' })
      if (path === 'generated/gendata-spell-source-lookup.json')
        return Promise.resolve({})
      return Promise.resolve({
        spell: [
          {
            name: "Melf's Acid Arrow",
            source: 'PHB',
            level: 2,
            school: 'V',
            srd: 'Acid Arrow',
          },
          { name: 'Fireball', source: 'PHB', level: 3, school: 'V', srd: true },
        ],
      })
    })

    const spells = await loadSpells()
    expect(spells.map((s) => [s.name, s.srdName])).toEqual([
      ["Melf's Acid Arrow", 'Acid Arrow'],
      ['Fireball', undefined],
    ])
  })

  it('tolerates a file with no spells and sorts same-level spells by name', async () => {
    mockFetch.mockImplementation((path: string) => {
      if (path === 'spells/index.json') {
        return Promise.resolve({ EMPTY: 'empty.json', PHB: 'phb.json' })
      }
      if (path === 'generated/gendata-spell-source-lookup.json') {
        return Promise.resolve({})
      }
      // A file with no `spell` array exercises the `?? []` fallback.
      if (path === 'spells/empty.json') return Promise.resolve({})
      return Promise.resolve({
        spell: [
          // No duration -> the `?? []` guard; equal level forces a name compare.
          { name: 'Zephyr', source: 'PHB', level: 1, school: 'T' },
          // A null duration entry exercises the optional-chained concentration read.
          {
            name: 'Alarm',
            source: 'PHB',
            level: 1,
            school: 'A',
            duration: [null],
          },
        ],
      })
    })

    const spells = await loadSpells()
    // Same level -> alphabetical; neither is a concentration spell.
    expect(spells.map((s) => s.name)).toEqual(['Alarm', 'Zephyr'])
    expect(spells.every((s) => s.concentration === false)).toBe(true)
  })

  it('caches spells across calls', async () => {
    mockFetch.mockImplementation((path: string) =>
      path === 'spells/index.json' ? Promise.resolve({}) : Promise.resolve({}),
    )
    await loadSpells()
    const callsAfterFirst = mockFetch.mock.calls.length
    await loadSpells()
    expect(mockFetch.mock.calls.length).toBe(callsAfterFirst)
  })
})

describe('isOnClassList', () => {
  const spell = makeSpell({
    name: 'Shield',
    lists: {
      classes: ['Wizard|XPHB'],
      variants: { 'Ranger|PHB': ['TCE'] },
      subclasses: ['Fighter|PHB|Eldritch Knight'],
    },
  })

  it('keeps each edition of a class to its own list', () => {
    expect(isOnClassList(spell, { classKey: 'Wizard|XPHB' }, [])).toBe(true)
    expect(isOnClassList(spell, { classKey: 'Wizard|PHB' }, [])).toBe(false)
  })

  it('counts an optional list only while its defining book is selected', () => {
    const ranger = { classKey: 'Ranger|PHB' }
    expect(isOnClassList(spell, ranger, ['PHB'])).toBe(false)
    expect(isOnClassList(spell, ranger, ['PHB', 'TCE'])).toBe(true)
  })

  it('counts a class list a book defines only while that book is selected', () => {
    const blade = makeSpell({
      name: 'Booming Blade',
      source: 'TCE',
      lists: {
        classes: ['Artificer|TCE', 'Wizard|PHB'],
        definedIn: { 'Wizard|PHB': ['SCAG'] },
        variants: {},
        subclasses: [],
      },
    })
    const wizard = { classKey: 'Wizard|PHB' }
    expect(isOnClassList(blade, wizard, ['PHB', 'TCE'])).toBe(false)
    expect(isOnClassList(blade, wizard, ['PHB', 'TCE', 'SCAG'])).toBe(true)
    expect(isOnClassList(blade, { classKey: 'Artificer|TCE' }, ['TCE'])).toBe(true)
  })

  it('reads a third caster from its subclass list alone', () => {
    const knight = { classKey: 'Fighter|PHB', subclassKey: 'Fighter|PHB|Eldritch Knight' }
    expect(isOnClassList(spell, knight, [])).toBe(true)
    expect(
      isOnClassList(spell, { ...knight, subclassKey: 'Fighter|PHB|Other' }, []),
    ).toBe(false)
  })

  it('keeps a third caster to spells of its own edition', () => {
    const knight = {
      classKey: 'Fighter|PHB',
      subclassKey: 'Fighter|PHB|Eldritch Knight',
      edition: 'one' as const,
    }
    expect(isOnClassList(spell, knight, [])).toBe(false)
    expect(isOnClassList(makeSpell({ ...spell, edition: 'one' }), knight, [])).toBe(true)
  })
})

describe('listStanding', () => {
  // The 2014 and 2024 printings of spells a Druid of each edition may or may not have.
  const bolt14 = makeSpell({ name: 'Guiding Bolt', lists: listsOf('Cleric|PHB') })
  const bolt24 = makeSpell({
    name: 'Guiding Bolt',
    source: 'XPHB',
    edition: 'one',
    lists: listsOf('Cleric|XPHB'),
  })
  const knife14 = makeSpell({
    name: 'Ice Knife',
    source: 'XGE',
    lists: { classes: [], variants: { 'Druid|PHB': ['XGE'] }, subclasses: [] },
  })
  const knife24 = makeSpell({
    name: 'Ice Knife',
    source: 'XPHB',
    edition: 'one',
    lists: listsOf('Druid|XPHB'),
  })
  const cure14 = makeSpell({ name: 'Cure Wounds', lists: listsOf('Druid|PHB') })
  const cure24 = makeSpell({
    name: 'Cure Wounds',
    source: 'XPHB',
    edition: 'one',
    lists: listsOf('Druid|XPHB'),
  })
  const byName = new Map<string, Spell[]>()
  for (const s of [bolt14, bolt24, knife14, knife24, cure14, cure24])
    byName.set(s.name.toLowerCase(), [...(byName.get(s.name.toLowerCase()) ?? []), s])
  const all = ['PHB', 'XPHB', 'XGE', 'TCE']
  const druid14 = { classKey: 'Druid|PHB', edition: 'classic' as const }
  const druid24 = { classKey: 'Druid|XPHB', edition: 'one' as const }

  it('finds a spell on the class list, and the printing of a twin on it', () => {
    const ctx = { selectedBooks: all, byName }
    expect(listStanding(cure14, druid14, ctx)).toEqual({
      kind: 'listed',
      access: 'class list',
    })
    expect(listStanding(cure24, druid14, ctx)).toEqual({
      kind: 'printing',
      twin: cure14,
      access: 'class list',
    })
    expect(listStanding(cure14, druid24, ctx)).toEqual({
      kind: 'printing',
      twin: cure24,
      access: 'class list',
    })
  })

  it('counts a twin on an optional list only while its book is selected', () => {
    expect(listStanding(knife24, druid14, { selectedBooks: all, byName })).toEqual({
      kind: 'printing',
      twin: knife14,
      access: 'optional list',
    })
    expect(listStanding(knife14, druid14, { selectedBooks: all, byName }).kind).toBe(
      'listed',
    )
    // Without Xanathar's the 2014 Ice Knife is not on the list, and is not a row either.
    expect(
      listStanding(knife24, druid14, { selectedBooks: ['PHB', 'XPHB'], byName }),
    ).toEqual({ kind: 'off' })
    expect(listStanding(knife14, druid24, { selectedBooks: all, byName })).toEqual({
      kind: 'printing',
      twin: knife24,
      access: 'class list',
    })
  })

  it('reads a Circle spell always prepared as had, and its twin as that printing', () => {
    const granted = (s: Spell) => (s.key === bolt14.key ? 'always prepared' : undefined)
    const ctx = { selectedBooks: all, byName, granted } as const
    expect(listStanding(bolt14, druid14, ctx)).toEqual({
      kind: 'granted',
      access: 'always prepared',
    })
    expect(listStanding(bolt24, druid14, ctx)).toEqual({
      kind: 'printing',
      twin: bolt14,
      access: 'always prepared',
    })
  })

  it('reads a spell a source adds to the list as listed', () => {
    const granted = (s: Spell) => (s.key === bolt24.key ? 'expanded list' : undefined)
    expect(
      listStanding(bolt24, druid24, { selectedBooks: all, byName, granted }),
    ).toEqual({ kind: 'listed', access: 'expanded list' })
  })

  it('leaves a terrain spell off while no terrain is chosen', () => {
    // Circle of the Land: no terrain taken, so its source gives nothing yet.
    const granted = () => undefined
    const ctx = { selectedBooks: all, byName, granted }
    expect(listStanding(bolt14, druid14, ctx)).toEqual({ kind: 'off' })
    expect(listStanding(bolt24, druid14, ctx)).toEqual({ kind: 'off' })
  })

  it('reads a third caster from the twin on its subclass list', () => {
    const shield14 = makeSpell({
      name: 'Shield',
      lists: {
        classes: ['Wizard|PHB'],
        variants: {},
        subclasses: ['Fighter|PHB|Eldritch Knight'],
      },
    })
    const shield24 = makeSpell({
      name: 'Shield',
      source: 'XPHB',
      edition: 'one',
      lists: {
        classes: ['Wizard|XPHB'],
        variants: {},
        subclasses: ['Fighter|PHB|Eldritch Knight'],
      },
    })
    const knight = {
      classKey: 'Fighter|PHB',
      subclassKey: 'Fighter|PHB|Eldritch Knight',
      edition: 'classic' as const,
    }
    const shields = new Map([['shield', [shield14, shield24]]])
    expect(
      listStanding(shield24, knight, { selectedBooks: all, byName: shields }),
    ).toEqual({ kind: 'printing', twin: shield14, access: 'subclass list' })
  })
})

describe('standingProblem', () => {
  const bolt24 = makeSpell({ name: 'Guiding Bolt', source: 'XPHB', edition: 'one' })
  const bolt14 = makeSpell({ name: 'Guiding Bolt' })
  const druid = { name: 'Druid', edition: 'classic' as const }

  it('names the printing, the class edition and how the class has the twin', () => {
    expect(
      standingProblem(
        { kind: 'printing', twin: bolt14, access: 'always prepared' },
        bolt24,
        druid,
      ),
    ).toBe('2024 printing - your 2014 Druid has the 2014 one (always prepared)')
    expect(standingProblem({ kind: 'off' }, bolt24, druid)).toBe(
      'Not on the 2014 Druid list',
    )
    expect(
      standingProblem({ kind: 'off' }, bolt14, { name: 'Druid', edition: 'one' }),
    ).toBe('Not on the 2024 Druid list')
  })

  it('says nothing for a spell the class has', () => {
    expect(
      standingProblem({ kind: 'listed', access: 'class list' }, bolt14, druid),
    ).toBeUndefined()
    expect(
      standingProblem({ kind: 'granted', access: 'always known' }, bolt14, druid),
    ).toBeUndefined()
  })
})
