import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { ClassFile, LoadedClass } from '../../data/class'
import { castingLabel, CASTER_LABEL } from './classRows'

const loaded = (casterProgression?: string): LoadedClass => ({
  entry: { name: 'Test', source: 'TST', casterProgression },
  file: {},
})

describe('castingLabel', () => {
  it('names the slot progression, never a class', () => {
    expect(castingLabel(loaded('full'))).toBe('Full caster')
    expect(castingLabel(loaded('1/2'))).toBe('Half caster')
    expect(castingLabel(loaded('artificer'))).toBe('Half caster')
    expect(castingLabel(loaded('1/3'))).toBe('Third caster')
    expect(castingLabel(loaded('pact'))).toBe('Pact magic')
    expect(castingLabel(loaded())).toBe('Non-caster')
  })
})

// The full data when it is there, else the books the app ships; both carry both editions.
const dir = existsSync('.local/data/class') ? '.local/data/class' : 'public/data/class'
const classes = readdirSync(dir)
  .filter((f) => /^class-.*\.json$/.test(f))
  .flatMap((f) => {
    const file = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as ClassFile
    return (file.class ?? []).map((entry): LoadedClass => ({ entry, file }))
  })

describe('castingLabel against the class data', () => {
  it.each(classes.map((l) => [`${l.entry.name} (${l.entry.source})`, l] as const))(
    '%s: a known progression with a label that is not a class name',
    (_, l) => {
      const prog = l.entry.casterProgression
      if (prog) expect(Object.keys(CASTER_LABEL)).toContain(prog)
      const label = castingLabel(l)
      expect(classes.map((c) => c.entry.name)).not.toContain(label)
    },
  )

  it('labels the Paladin and the Ranger half casters in both editions', () => {
    const named = classes.filter((l) => ['Paladin', 'Ranger'].includes(l.entry.name))
    const books = named.map((l) => l.entry.source)
    expect(books).toEqual(expect.arrayContaining(['PHB', 'XPHB']))
    for (const l of named.filter((c) => ['PHB', 'XPHB'].includes(c.entry.source))) {
      expect(castingLabel(l), `${l.entry.name} ${l.entry.source}`).toBe('Half caster')
    }
  })
})
