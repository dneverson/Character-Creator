import { describe, expect, it } from 'vitest'
import { createCharacter, type Character } from '../character/model'
import { optionPrereqs, type OptionPrereqContext } from './optionPrereqs'

const warlock = (level: number, mutate: (c: Character) => void = () => {}) => {
  const c = createCharacter('Test')
  c.classes = [
    {
      name: 'Warlock',
      source: 'PHB',
      level,
      subclass: { name: 'The Fiend', shortName: 'Fiend', source: 'PHB' },
    },
  ]
  mutate(c)
  return c
}

const ctx = (
  character: Character,
  held: string[] = [],
  features: string[] = [],
): OptionPrereqContext => ({
  character,
  held: new Set(held),
  features: new Set(features),
})

describe('optionPrereqs', () => {
  it('is met with no prerequisite', () => {
    expect(optionPrereqs(undefined, ctx(warlock(1)))).toEqual({ status: 'met', text: '' })
    expect(optionPrereqs([{ item: ['A weapon'] }], ctx(warlock(1)))).toEqual({
      status: 'met',
      text: '',
    })
  })

  it('checks a character level, a class level and a subclass', () => {
    expect(optionPrereqs([{ level: 3 }], ctx(warlock(2)))).toMatchObject({
      status: 'unmet',
      text: 'Level 3',
      missing: 'Level 3',
      level: 3,
    })
    expect(optionPrereqs([{ level: { level: 2 } }], ctx(warlock(2))).status).toBe('met')
    const fiend = [
      { level: { level: 5, class: { name: 'Warlock' }, subclass: { name: 'Fiend' } } },
    ]
    expect(optionPrereqs(fiend, ctx(warlock(5)))).toMatchObject({
      status: 'met',
      text: 'Level 5 Warlock (Fiend)',
    })
    expect(optionPrereqs(fiend, ctx(warlock(4))).status).toBe('unmet')
    const named = [
      {
        level: { level: 5, class: { name: 'Warlock' }, subclass: { name: 'The Fiend' } },
      },
    ]
    expect(optionPrereqs(named, ctx(warlock(5))).status).toBe('met')
    const other = [{ level: { level: 1, class: { name: 'Wizard' } } }]
    expect(optionPrereqs(other, ctx(warlock(5))).status).toBe('unmet')
  })

  it('checks a pact boon and another option by the options held', () => {
    const blade = [{ pact: 'Blade' }]
    expect(optionPrereqs(blade, ctx(warlock(3))).missing).toBe('Pact of the Blade')
    expect(optionPrereqs(blade, ctx(warlock(3), ['Pact of the Blade|PHB'])).status).toBe(
      'met',
    )
    const lifedrinker = [{ optionalfeature: ['pact of the blade|xphb'] }]
    expect(optionPrereqs(lifedrinker, ctx(warlock(9)))).toMatchObject({
      status: 'unmet',
      missing: 'Pact of the Blade',
    })
    expect(
      optionPrereqs(lifedrinker, ctx(warlock(9), ['Pact of the Blade|XPHB'])).status,
    ).toBe('met')
  })

  it('checks a spell known, and a curse feature in place of the hex spell', () => {
    const blast = [{ spell: ['eldritch blast#c'] }]
    expect(optionPrereqs(blast, ctx(warlock(2))).missing).toBe(
      'The Eldritch Blast cantrip',
    )
    const knows = warlock(2, (c) => {
      c.spells = {
        'Warlock|PHB': {
          cantrips: [{ name: 'Eldritch Blast', source: 'PHB', level: 0 }],
          spells: [],
          spellbook: [{ name: 'Hex', source: 'PHB', level: 1 }],
        },
      }
    })
    expect(optionPrereqs(blast, ctx(knows)).status).toBe('met')
    expect(optionPrereqs([{ spell: ['hex'] }], ctx(knows)).text).toBe('The Hex spell')
    const hex = [{ spell: ['hex/curse#x'] }]
    expect(optionPrereqs(hex, ctx(warlock(5))).status).toBe('unmet')
    expect(optionPrereqs(hex, ctx(knows)).status).toBe('met')
    expect(optionPrereqs(hex, ctx(warlock(5), [], ["hexblade's curse"])).status).toBe(
      'met',
    )
  })

  it('cannot check a choice of spells or a requirement in words, and says what it is', () => {
    const choice = [
      { spell: [{ choose: 'level=0|class=Warlock', entrySummary: 'A Warlock cantrip' }] },
    ]
    expect(optionPrereqs(choice, ctx(warlock(2)))).toEqual({
      status: 'unknown',
      text: 'A Warlock cantrip',
      level: undefined,
    })
    expect(
      optionPrereqs([{ spell: [{ choose: 'level=0' }] }], ctx(warlock(2))).text,
    ).toBe('level=0')
    const renown = [{ otherSummary: { entry: '{@b Renown} 3' } }]
    expect(optionPrereqs(renown, ctx(warlock(2)))).toMatchObject({
      status: 'unknown',
      text: 'Renown 3',
    })
  })

  it('takes any one of several prerequisites, and names the first that is missing', () => {
    const either = [{ pact: 'Tome' }, { level: 7 }]
    expect(optionPrereqs(either, ctx(warlock(7)))).toMatchObject({
      status: 'met',
      text: 'Pact of the Tome; or Level 7',
    })
    expect(optionPrereqs(either, ctx(warlock(3))).missing).toBe('Pact of the Tome')
    const unknown = [{ pact: 'Tome' }, { otherSummary: { entry: 'A DM ruling' } }]
    expect(optionPrereqs(unknown, ctx(warlock(3))).status).toBe('unknown')
  })
})
