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
