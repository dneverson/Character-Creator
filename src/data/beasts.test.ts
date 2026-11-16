import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadBeasts, loadCreatures, crToNumber } from './beasts'
import { fetchData } from './dataClient'

vi.mock('./dataClient', () => ({ fetchData: vi.fn() }))
const mockFetch = vi.mocked(fetchData)

beforeEach(() => {
  mockFetch.mockReset()
})

describe('crToNumber', () => {
  it('parses fractional and whole CR strings', () => {
    expect(crToNumber('0')).toBe(0)
    expect(crToNumber('1/8')).toBe(0.125)
    expect(crToNumber('1/4')).toBe(0.25)
    expect(crToNumber('1/2')).toBe(0.5)
    expect(crToNumber('5')).toBe(5)
  })
  it('returns +Infinity for unparseable CR', () => {
    expect(crToNumber('special')).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('loadBeasts', () => {
  it('keeps only beast-type monsters, normalized and CR-sorted', async () => {
    mockFetch.mockImplementation((path: string) => {
      if (path === 'bestiary/index.json') return Promise.resolve({ MM: 'mm.json' })
      return Promise.resolve({
        monster: [
          {
            name: 'Giant Eagle',
            source: 'MM',
            type: 'beast',
            size: ['L'],
            cr: '1',
            ac: [{ ac: 13 }],
            hp: { average: 26 },
            speed: { walk: 10, fly: 80 },
          },
          {
            name: 'Wolf',
            source: 'MM',
            type: { type: 'beast' },
            size: ['M'],
            cr: '1/4',
            ac: [13],
            hp: { average: 11 },
            speed: { walk: 40 },
          },
          { name: 'Goblin', source: 'MM', type: 'humanoid', cr: '1/4' },
        ],
      })
    })

    const beasts = await loadBeasts(['MM'])
    expect(beasts.map((b) => b.name)).toEqual(['Wolf', 'Giant Eagle']) // 0.25 before 1
    const eagle = beasts.find((b) => b.name === 'Giant Eagle')!
    expect(eagle.ac).toBe(13)
    expect(eagle.hasFly).toBe(true)
    expect(eagle.hasSwim).toBe(false)
    expect(beasts.find((b) => b.name === 'Wolf')!.hasFly).toBe(false)
  })

  it('skips sources not present in the index and tolerates failed fetches', async () => {
    mockFetch.mockImplementation((path: string) => {
      if (path === 'bestiary/index.json') return Promise.resolve({ MM: 'mm.json' })
      return Promise.reject(new Error('boom'))
    })
    const beasts = await loadBeasts(['MM', 'MISSING'])
    expect(beasts).toEqual([])
  })

  it('normalizes object CR, swim speed, missing speed, and breaks CR ties by name', async () => {
    mockFetch.mockImplementation((path: string) =>
      path === 'bestiary/index.json'
        ? Promise.resolve({ MM: 'mm.json' })
        : Promise.resolve({
            monster: [
              {
                name: 'Ant',
                source: 'MM',
                type: 'beast',
                // An object CR exercises the crString `.cr` branch.
                cr: { cr: '1/4' },
                ac: [12],
                hp: { average: 5 },
                speed: { walk: 20, swim: 20 },
              },
              {
                // No speed at all -> the `m.speed ?? 0` fallback.
                name: 'Amoeba',
                source: 'MM',
                type: 'beast',
                cr: '1/4',
              },
              // A type object with no `type` field -> typeName '' -> not a beast.
              { name: 'Ghost', source: 'MM', type: {}, cr: '1/4' },
            ],
          }),
    )
    const beasts = await loadBeasts(['MM'])
    // Equal CR (0.25) -> name tiebreak; the non-beast is dropped.
    expect(beasts.map((b) => b.name)).toEqual(['Amoeba', 'Ant'])
    const ant = beasts.find((b) => b.name === 'Ant')!
    expect(ant.hasSwim).toBe(true)
    expect(ant.cr).toBe('1/4')
    expect(beasts.find((b) => b.name === 'Amoeba')!.speed).toEqual({ walk: 0 })
  })

  it('tolerates a fetched file with no monster array', async () => {
    mockFetch.mockImplementation((path: string) =>
      path === 'bestiary/index.json'
        ? Promise.resolve({ MM: 'mm.json' })
        : Promise.resolve({}),
    )
    expect(await loadBeasts(['MM'])).toEqual([])
  })

  it('defaults speed and ac when a monster omits them', async () => {
    mockFetch.mockImplementation((path: string) =>
      path === 'bestiary/index.json'
        ? Promise.resolve({ MM: 'mm.json' })
        : Promise.resolve({
            monster: [{ name: 'Blob', source: 'MM', type: 'beast', speed: 25 }],
          }),
    )
    const beasts = await loadBeasts(['MM'])
    expect(beasts[0].speed).toEqual({ walk: 25 })
    expect(beasts[0].ac).toBe(0)
    expect(beasts[0].hp).toBe(0)
    expect(beasts[0].cr).toBe('0')
  })

  it('reads swarms, missing CR, object speeds, armor notes and the full stat block', async () => {
    mockFetch.mockImplementation((path: string) =>
      path === 'bestiary/index.json'
        ? Promise.resolve({ MM: 'mm.json' })
        : Promise.resolve({
            monster: [
              {
                name: 'Swarm of Rats',
                source: 'MM',
                type: { type: 'beast', swarmSize: 'M' },
                cr: '1/4',
                speed: { walk: 30, choose: { from: ['climb', 'fly'], amount: 20 } },
              },
              {
                name: 'Bestial Spirit',
                source: 'MM',
                type: 'beast',
                speed: { walk: 30, fly: { number: 60, condition: '(air only)' } },
                ac: [{ special: "11 + the spell's level" }],
                hp: { special: 'by spell level' },
              },
              {
                name: 'Brown Bear',
                source: 'MM',
                type: { type: 'beast', tags: ['bear', { tag: 'big' }, {}] },
                cr: '1',
                ac: [{ ac: 11, from: ['natural armor'] }],
                hp: { average: 34, formula: '4d10 + 12' },
                speed: { walk: 40, climb: 30 },
                str: 19,
                dex: 10,
                wis: 13,
                passive: 13,
                senses: ['darkvision 60 ft.'],
                skill: { perception: '+3' },
                trait: [{ name: 'Keen Smell', entries: ['Advantage on smell checks.'] }],
                action: [{ name: 'Bite', entries: ['Bite.'] }],
              },
            ],
          }),
    )
    const beasts = await loadBeasts(['MM'])
    const rats = beasts.find((b) => b.name === 'Swarm of Rats')!
    expect(rats.swarm).toBe(true)
    expect(rats.hasFly).toBe(true) // the choice of climb or fly
    expect(rats.hasSwim).toBe(false)

    const spirit = beasts.find((b) => b.name === 'Bestial Spirit')!
    expect(spirit.hasCr).toBe(false)
    expect(spirit.hasFly).toBe(true) // fly given as { number, condition }
    expect(spirit.ac).toBe(0)
    expect(spirit.hp).toBe(0)
    expect(spirit.swarm).toBe(false)

    const bear = beasts.find((b) => b.name === 'Brown Bear')!
    expect(bear).toMatchObject({
      hasCr: true,
      tags: ['bear', 'big'],
      ac: 11,
      acFrom: 'natural armor',
      hp: 34,
      hpFormula: '4d10 + 12',
      passive: 13,
      senses: ['darkvision 60 ft.'],
      skills: { perception: '+3' },
    })
    expect(bear.abilities).toEqual({
      str: 19,
      dex: 10,
      con: 10,
      int: 10,
      wis: 13,
      cha: 10,
    })
    expect(bear.traits[0].name).toBe('Keen Smell')
    expect(bear.actions[0].name).toBe('Bite')
  })
})

describe('loadCreatures', () => {
  const dragon = {
    name: 'Adult Test Dragon',
    source: 'MM',
    type: { type: { choose: ['dragon', 'fiend'] }, tags: ['chromatic'] },
    alignment: ['C', 'E'],
    size: ['H'],
    cr: '13',
    ac: [{ ac: 19, from: ['natural armor'] }],
    hp: { average: 225, formula: '18d12 + 108' },
    speed: { walk: 40, fly: 80 },
    save: { dex: '+6', wis: '+7' },
    skill: { perception: '+12', other: [{ x: 1 }] },
    vulnerable: ['cold'],
    resist: [{ resist: ['bludgeoning', 'piercing'], note: 'from nonmagical attacks' }],
    immune: ['fire', { special: 'poison while awake' }],
    conditionImmune: ['charmed'],
    languages: ['Common', 'Draconic'],
    spellcasting: [
      {
        name: 'Innate Spellcasting',
        headerEntries: ['The dragon casts these spells.'],
        will: ['detect magic', { entry: 'ignored' }],
        daily: { '3e': ['fireball'], '1': ['wish'] },
        rest: { '1e': ['gate'] },
        spells: { '0': { spells: ['light'] }, '1': { slots: 4, spells: ['bless'] } },
        footerEntries: ['Done.'],
      },
    ],
    trait: [{ name: 'Amphibious', entries: ['Breathes anything.'] }],
    action: [{ name: 'Bite', entries: ['Bites.'] }],
    bonus: [{ name: 'Dash', entries: ['Runs.'] }],
    reaction: [{ name: 'Parry', entries: ['Parries.'] }],
    legendaryHeader: ['The dragon takes 3 legendary actions.'],
    legendary: [{ name: 'Tail', entries: ['Swipes.'] }],
    mythicHeader: [],
    mythic: [{ name: 'Rise', entries: ['Rises.'] }],
    legendaryGroup: { name: 'Test Dragon', source: 'MM' },
  }
  const files = (monsters: unknown[], groups?: unknown) => {
    mockFetch.mockImplementation((path: string) => {
      if (path === 'bestiary/index.json') return Promise.resolve({ MM: 'mm.json' })
      if (path === 'legendarygroups.json')
        return groups ? Promise.resolve(groups) : Promise.reject(new Error('404'))
      return Promise.resolve({ monster: monsters })
    })
  }

  it('reads the whole stat block of any creature, whatever its type', async () => {
    files([dragon, { name: 'Plain', source: 'MM', type: 'humanoid', alignment: ['U'] }], {
      legendaryGroup: [
        {
          name: 'Test Dragon',
          source: 'MM',
          lairActions: ['The lair acts.'],
          regionalEffects: ['The land shifts.'],
        },
      ],
    })
    const [first, second] = await loadCreatures(['MM'])
    expect(first).toMatchObject({
      type: 'dragon or fiend',
      tags: ['chromatic'],
      alignment: 'chaotic evil',
      saves: { dex: '+6', wis: '+7' },
      skills: { perception: '+12' },
      vulnerable: 'cold',
      resist: 'bludgeoning, piercing from nonmagical attacks',
      immune: 'fire; poison while awake',
      conditionImmune: 'charmed',
      languages: ['Common', 'Draconic'],
    })
    expect(first.spellcasting[0].entries).toEqual([
      'The dragon casts these spells.',
      {
        type: 'list',
        items: [
          'At will: detect magic',
          '1/day: wish',
          '3/day each: fireball',
          '1/rest each: gate',
          'Cantrips (at will): light',
          'Level 1 (4 slots): bless',
        ],
      },
      'Done.',
    ])
    expect(first.legendary.map((e) => e.name)).toEqual(['Legendary Actions', 'Tail'])
    expect(first.mythic.map((e) => e.name)).toEqual(['Rise'])
    expect(first.bonusActions[0].name).toBe('Dash')
    expect(first.reactions[0].name).toBe('Parry')
    expect(first.lair.map((e) => e.name)).toEqual(['Lair Actions', 'Regional Effects'])
    expect(second).toMatchObject({ type: 'humanoid', alignment: 'unaligned' })
    expect(second.lair).toEqual([])
  })

  it('writes the alignments of the data as a stat block does', async () => {
    const alignments = [
      [['A']],
      [['L', 'G']],
      [['N', 'N']],
      [['N', 'G']],
      [['L', 'C', 'G', 'E']],
      [[{ alignment: ['C', 'E'], chance: 75 }, 'U']],
      [[{ special: 'any non-good' }]],
      [['X']],
    ]
    files(
      alignments.map(([alignment], i) => ({ name: `M${i}`, source: 'MM', alignment })),
    )
    const found = (await loadCreatures(['MM'])).map((c) => c.alignment)
    expect(found).toEqual([
      'any alignment',
      'lawful good',
      'neutral',
      'neutral good',
      'lawful or chaotic or good or evil',
      'chaotic evil or unaligned',
      'any non-good',
      'X',
    ])
  })
})
