import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isOnClassList,
  loadSpells,
  _clearSpellCache,
  schoolName,
  spellLevelLabel,
} from './spells'
import { makeSpell } from '../test/spellFixtures'
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
      damage: '8d6 Fire',
      damageTypes: ['Fire'],
      save: ['Dexterity'],
      area: 'Sphere',
      tags: ['Ignites flammable objects', 'Affects objects'],
      upcast: '+1d6 per slot level above 3rd',
      components: { v: true, s: true, m: true, royalty: false },
    })
    const acid = byName.get('Acid Splash')!
    expect(acid).toMatchObject({
      damage: '1d6 Acid',
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
      damage: 'Psychic',
    })
    expect(byName.get('Eldritch Blast')).toMatchObject({
      attack: 'Ranged',
      damage: '1d10 Force',
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
