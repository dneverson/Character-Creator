import { describe, expect, it } from 'vitest'
import type { Line } from '../../derived/types'
import { makeSpell } from '../../test/spellFixtures'
import type { SpellLine } from './SpellLines'
import { describeLines } from './spellLineFacts'

const effect = (label: string, how: string, amount?: number): Line => ({
  id: label,
  label,
  source: { kind: 'option', tag: `option:${label}`, label },
  op: amount === undefined ? 'note' : 'add',
  ...(amount === undefined ? {} : { amount }),
  how,
  status: 'applied',
})

const textOf = (line: SpellLine) =>
  describeLines([line])[0]
    .facts.find((f) => f.key === 'effects')
    ?.text(line)

const change = (
  label: string,
  on: 'damage' | 'range',
  op: Line['op'],
  amount: number,
): Line => ({
  ...effect(label, `${on} change`, amount),
  op,
  on,
})

const textOfFact = (line: SpellLine, key: string) =>
  describeLines([line])
    .flatMap((g) => g.facts)
    .find((f) => f.key === key)
    ?.text(line)

describe('the values of a spell line the class options change', () => {
  const spell = makeSpell({ name: 'Eldritch Blast', damage: '1d10', range: '120 ft.' })
  const line = (effects: Line[]): SpellLine => ({
    id: 'eb',
    spell,
    from: ['Warlock'],
    cast: 'At will',
    effects,
  })

  it('adds the damage and lengthens or sets the range', () => {
    const lines = line([
      change('Agonizing Blast', 'damage', 'add', 4),
      change('Eldritch Spear', 'range', 'add', 270),
    ])
    expect(textOfFact(lines, 'damage')).toBe('1d10 + 4')
    expect(textOfFact(lines, 'range')).toBe('390 ft.')
    const set = line([change('Eldritch Spear', 'range', 'base', 300)])
    expect(textOfFact(set, 'range')).toBe('300 ft.')
  })

  it('shows the spell as it is when nothing changes it', () => {
    expect(textOfFact(line([]), 'damage')).toBe('1d10')
    expect(textOfFact(line([]), 'range')).toBe('120 ft.')
  })
})

describe('the facts of a spell line', () => {
  const base = { id: 'eldritch blast', spell: makeSpell({ name: 'Eldritch Blast' }) }

  it('name what the class options do to the spell, with the number they add', () => {
    const line: SpellLine = {
      ...base,
      from: ['Warlock'],
      cast: 'At will',
      effects: [
        effect('Agonizing Blast', 'Charisma modifier to the damage of this spell', 4),
        effect('Eldritch Spear', 'Range of this spell is 300 feet'),
      ],
    }
    expect(textOf(line)).toBe(
      'Agonizing Blast: +4 Charisma modifier to the damage of this spell; Eldritch Spear: Range of this spell is 300 feet',
    )
  })

  it('have nothing to say for a spell no option changes', () => {
    expect(textOf({ ...base, from: ['Warlock'], cast: 'At will' })).toBe('')
  })
})
