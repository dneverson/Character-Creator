import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadBeasts, crToNumber } from './beasts'
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
