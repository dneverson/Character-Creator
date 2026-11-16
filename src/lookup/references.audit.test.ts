// Every {@tag} kind the free rules use is either a reference to an entry of the lookup or
// plain text with a reason, and the references find their entries.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { PLAIN_TAGS, REFERENCE_TAGS, loadResolver, referenceOf } from './references'
import { LOOKUP_KINDS } from './types'

vi.mock('../data/dataClient', async () => {
  const { readFileSync: read } = await import('node:fs')
  return {
    fetchData: async (path: string): Promise<unknown> => {
      try {
        return JSON.parse(read(`public/data/${path}`, 'utf8'))
      } catch {
        throw new Error(`Failed to load data "${path}": HTTP 404`)
      }
    },
  }
})

const tags = new Map<string, string[]>()
function scan(dir: string) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) scan(path)
    else if (path.endsWith('.json'))
      for (const m of readFileSync(path, 'utf8').matchAll(/\{@(\w+)\s*([^{}"]*)\}/g)) {
        const list = tags.get(m[1])
        if (list) list.push(m[2])
        else tags.set(m[1], [m[2]])
      }
  }
}
scan('public/data')

describe('the tags of the data', () => {
  it('uses only tags that are a reference or plain by design', () => {
    const unknown = [...tags.keys()].filter(
      (t) => !(t in REFERENCE_TAGS || t in PLAIN_TAGS),
    )
    expect(unknown).toEqual([])
  })

  it('lists no tag twice, and no tag without a reason', () => {
    expect(Object.keys(REFERENCE_TAGS).filter((t) => t in PLAIN_TAGS)).toEqual([])
    expect(Object.values(PLAIN_TAGS).every((reason) => reason.length > 0)).toBe(true)
    expect(
      Object.values(REFERENCE_TAGS).every((t) => LOOKUP_KINDS.includes(t.kind)),
    ).toBe(true)
  })

  it('reads the name and book of each reference form', () => {
    expect(referenceOf('spell', 'fireball|phb|fire ball')).toMatchObject({
      kind: 'spell',
      name: 'fireball',
      source: 'phb',
    })
    expect(referenceOf('classFeature', 'Rage|Barbarian|XPHB|1|XPHB')).toMatchObject({
      name: 'Rage',
      source: 'XPHB',
      context: 'Barbarian 1',
    })
    expect(
      referenceOf('subclassFeature', 'Holy Bolt|Cleric|XPHB|Discipline|WoW|3|WoW'),
    ).toMatchObject({ source: 'WoW', context: 'Cleric, Discipline 3' })
    expect(referenceOf('subclass', 'Moon|Druid|XPHB|XPHB')).toMatchObject({
      name: 'Moon',
      context: 'Druid',
      source: 'XPHB',
    })
    expect(referenceOf('deity', 'Bhaal|Faerunian|FRHoF')?.source).toBe('FRHoF')
    expect(referenceOf('dice', '1d6')).toBeUndefined()
    expect(referenceOf('spell', '')).toBeUndefined()
  })
})

describe('the references of the data', () => {
  const resolved = new Map<string, { found: number; total: number }>()
  beforeAll(async () => {
    const resolver = await loadResolver()
    for (const [tag, contents] of tags) {
      for (const content of contents) {
        const ref = referenceOf(tag, content)
        if (!ref) continue
        const count = resolved.get(tag) ?? { found: 0, total: 0 }
        count.total++
        if (resolver.find(ref)) count.found++
        resolved.set(tag, count)
      }
    }
    console.log(
      `REFERENCES ${[...resolved].map(([t, c]) => `${t} ${c.found}/${c.total}`).join(', ')}`,
    )
  }, 60_000)

  it('finds the entry of most references of every kind it holds', () => {
    for (const tag of ['spell', 'condition', 'skill', 'action', 'sense', 'variantrule']) {
      const count = resolved.get(tag)
      expect(count, tag).toBeDefined()
      expect((count?.found ?? 0) / (count?.total ?? 1), tag).toBeGreaterThan(0.8)
    }
  })
})
