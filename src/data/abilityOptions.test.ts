import { describe, expect, it } from 'vitest'
import {
  amountGroups,
  describeAbilityOption,
  increasesLeft,
  optionIncreases,
  parseAbilityOptions,
  summarizeAbilityOptions,
  toggleIncrease,
  validChoices,
  ABILITY_SCORE_MAX,
  type AbilityOption,
} from './abilityOptions'
import { ABILITIES } from '../dice/dice'

const ALL = [...ABILITIES]

const dwarf: AbilityOption = { fixed: { con: 2, wis: 1 }, amounts: [], from: [] }
const halfElf: AbilityOption = {
  fixed: { cha: 2 },
  amounts: [1, 1],
  from: ['str', 'dex', 'con', 'int', 'wis'],
}
const twoAndOne: AbilityOption = { fixed: {}, amounts: [2, 1], from: ALL }
const threeOnes: AbilityOption = { fixed: {}, amounts: [1, 1, 1], from: ALL }

describe('parseAbilityOptions', () => {
  it('reads increases given outright', () => {
    expect(parseAbilityOptions([{ con: 2, wis: 1 }])).toEqual([dwarf])
  })

  it('reads "the same amount to several", from a list or from any ability', () => {
    expect(
      parseAbilityOptions([
        { cha: 2, choose: { from: ['wis', 'str', 'dex', 'con', 'int'], count: 2 } },
      ]),
    ).toEqual([halfElf])
    expect(parseAbilityOptions([{ choose: { amount: 2 } }])).toEqual([
      { fixed: {}, amounts: [2], from: ALL },
    ])
  })

  it('reads listed amounts, each block being one way to take the increases', () => {
    expect(
      parseAbilityOptions([
        { choose: { weighted: { from: ALL, weights: [1, 2] } } },
        { choose: { weighted: { from: ALL, weights: [1, 1, 1] } } },
      ]),
    ).toEqual([twoAndOne, threeOnes])
  })

  it('ignores what is not an ability, and never places more than there are abilities', () => {
    expect(
      parseAbilityOptions([
        { str: 1, notAnAbility: 5, choose: { from: ['dex', 'bogus'], count: 3 } },
      ]),
    ).toEqual([{ fixed: { str: 1 }, amounts: [1], from: ['dex'] }])
  })

  it('drops a block that grants nothing, and anything that is not a block', () => {
    expect(
      parseAbilityOptions([
        {},
        null,
        'str',
        { choose: 'any' },
        { choose: { weighted: { from: ALL } } },
        { choose: { from: 'str' } },
      ]),
    ).toEqual([])
    expect(parseAbilityOptions(undefined)).toEqual([])
  })

  it('drops listed amounts with no ability to place them on, or none to place', () => {
    expect(
      parseAbilityOptions([
        { choose: { weighted: { from: ['bogus'], weights: [1] } } },
        { choose: { weighted: { from: ['str'], weights: [] } } },
        { choose: { weighted: { weights: [1] } } },
        { choose: { weighted: { from: ['str'], weights: ['2'] } } },
        { choose: { weighted: { from: ['str', 'dex'], weights: [2] } } },
      ]),
    ).toEqual([{ fixed: {}, amounts: [2], from: ['str', 'dex'] }])
  })

  it('reads a bare choice as +1 to any one ability', () => {
    expect(parseAbilityOptions([{ choose: {} }])).toEqual([
      { fixed: {}, amounts: [1], from: ALL },
    ])
  })
})

describe('amountGroups', () => {
  it('runs equal amounts together', () => {
    expect(amountGroups({ fixed: {}, amounts: [2, 1, 1], from: ALL })).toEqual([
      { amount: 2, count: 1 },
      { amount: 1, count: 2 },
    ])
    expect(amountGroups(dwarf)).toEqual([])
  })
})

describe('describeAbilityOption', () => {
  it('names increases given outright', () => {
    expect(describeAbilityOption(dwarf)).toBe('+2 Constitution, +1 Wisdom')
  })

  it('says so when every ability is raised alike', () => {
    const human: AbilityOption = {
      fixed: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
      amounts: [],
      from: [],
    }
    expect(describeAbilityOption(human)).toBe('+1 to every ability score')
  })

  it('says where placed increases may go', () => {
    expect(describeAbilityOption(twoAndOne)).toBe(
      '+2 to one ability score and +1 to another',
    )
    expect(describeAbilityOption(threeOnes)).toBe('+1 to three ability scores')
    expect(describeAbilityOption({ fixed: {}, amounts: [2, 1, 1], from: ALL })).toBe(
      '+2 to one ability score and +1 to two others',
    )
    expect(describeAbilityOption(halfElf)).toBe(
      '+2 Charisma, +1 to two other ability scores',
    )
    expect(
      describeAbilityOption({ fixed: { wis: 2 }, amounts: [1], from: ALL.slice(0, 3) }),
    ).toBe('+2 Wisdom, +1 to Strength or Dexterity or Constitution')
    expect(
      describeAbilityOption({
        fixed: { cha: 2 },
        amounts: [1],
        from: ['str', 'dex', 'con', 'int', 'wis'],
      }),
    ).toBe('+2 Charisma, +1 to one other ability score')
    expect(
      describeAbilityOption({ fixed: {}, amounts: [1, 1], from: ['str', 'dex', 'con'] }),
    ).toBe('+1 to two of Strength, Dexterity, Constitution')
    expect(
      describeAbilityOption({ fixed: {}, amounts: [1, 1, 1, 1, 1, 1, 1], from: ALL }),
    )
      // Seven cannot be placed on six abilities, but the wording still holds.
      .toBe('+1 to 7 ability scores')
  })
})

describe('summarizeAbilityOptions', () => {
  it('is short enough for a table cell', () => {
    expect(summarizeAbilityOptions([dwarf])).toBe('CON +2, WIS +1')
    expect(summarizeAbilityOptions([halfElf])).toBe('CHA +2; +1, +1 to others')
    expect(summarizeAbilityOptions([twoAndOne, threeOnes])).toBe(
      'any: +2, +1 or +1, +1, +1',
    )
    expect(
      summarizeAbilityOptions([
        { fixed: { int: 1 }, amounts: [2], from: ['dex', 'cha'] },
      ]),
    ).toBe('INT +1; +2 to DEX or CHA')
    expect(
      summarizeAbilityOptions([
        { fixed: {}, amounts: [1, 1], from: ['str', 'dex', 'con'] },
      ]),
    ).toBe('+1, +1 to STR, DEX, CON')
    expect(
      summarizeAbilityOptions([
        {
          fixed: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
          amounts: [],
          from: [],
        },
      ]),
    ).toBe('All +1')
    expect(
      summarizeAbilityOptions([
        { fixed: {}, amounts: [2, 1], from: ['int', 'wis', 'cha'] },
        { fixed: {}, amounts: [1, 1, 1], from: ['int', 'wis', 'cha'] },
      ]),
    ).toBe('INT, WIS, CHA: +2, +1 or +1, +1, +1')
    // Options on different abilities keep each option's own wording.
    expect(
      summarizeAbilityOptions([
        { fixed: {}, amounts: [2], from: ['int', 'wis'] },
        { fixed: {}, amounts: [1], from: ['str', 'dex'] },
      ]),
    ).toBe('+2 to INT or WIS / +1 to STR or DEX')
    expect(summarizeAbilityOptions([])).toBe('')
  })
})

describe('validChoices', () => {
  it('keeps what the option allows and drops the rest', () => {
    expect(validChoices(twoAndOne, { str: 2, dex: 1 })).toEqual({ str: 2, dex: 1 })
    // One +2 only; +3 is not offered; Charisma is not on the Half-Elf's list.
    expect(validChoices(twoAndOne, { str: 2, dex: 2, con: 3 })).toEqual({ str: 2 })
    expect(validChoices(halfElf, { cha: 1, str: 1 })).toEqual({ str: 1 })
  })
})

describe('increasesLeft', () => {
  it('counts what is still to be placed', () => {
    expect(increasesLeft(twoAndOne, {})).toBe(2)
    expect(increasesLeft(twoAndOne, { str: 2 })).toBe(1)
    expect(increasesLeft(twoAndOne, { str: 2, dex: 1 })).toBe(0)
    expect(increasesLeft(dwarf, {})).toBe(0)
  })
})

describe('toggleIncrease', () => {
  it('places an increase, and takes it back off', () => {
    expect(toggleIncrease(twoAndOne, {}, 2, 'str')).toEqual({ str: 2 })
    expect(toggleIncrease(twoAndOne, { str: 2 }, 2, 'str')).toEqual({})
  })

  it('moves a single increase to the ability clicked', () => {
    expect(toggleIncrease(twoAndOne, { str: 2, dex: 1 }, 2, 'con')).toEqual({
      con: 2,
      dex: 1,
    })
  })

  it('moves an ability from one amount to another', () => {
    expect(toggleIncrease(twoAndOne, { str: 2, dex: 1 }, 2, 'dex')).toEqual({ dex: 2 })
  })

  it('needs one taken off first when several of the same amount are all placed', () => {
    const full = { str: 1, dex: 1, con: 1 }
    expect(toggleIncrease(threeOnes, full, 1, 'int')).toEqual(full)
    expect(toggleIncrease(threeOnes, { str: 1, dex: 1 }, 1, 'int')).toEqual({
      str: 1,
      dex: 1,
      int: 1,
    })
  })

  it('places nothing the option does not offer', () => {
    expect(toggleIncrease(halfElf, {}, 1, 'cha')).toEqual({})
    expect(toggleIncrease(halfElf, {}, 2, 'str')).toEqual({})
  })
})

describe('a score that may pass the usual most', () => {
  const boon = parseAbilityOptions([{ choose: { from: ALL, amount: 1 }, max: 30 }])
  const terror = parseAbilityOptions([{ cha: 1, max: 30 }])

  it('reads the most from the block, and a printed restriction as a note', () => {
    expect(boon).toEqual([{ fixed: {}, amounts: [1], from: ALL, max: 30 }])
    expect(ABILITY_SCORE_MAX).toBe(20)
    expect(
      parseAbilityOptions([{ choose: { from: ['str', 'dex'], entry: 'Not Wisdom' } }])[0]
        .note,
    ).toBe('Not Wisdom')
    expect(parseAbilityOptions([{ str: 1 }])[0]).not.toHaveProperty('max')
    expect(parseAbilityOptions([{ str: 1 }])[0]).not.toHaveProperty('note')
  })

  it('says so in every wording, and not for the usual 20', () => {
    expect(describeAbilityOption(boon[0])).toBe('+1 to one ability score (up to 30)')
    expect(describeAbilityOption(terror[0])).toBe('+1 Charisma (up to 30)')
    expect(summarizeAbilityOptions(boon)).toBe('+1 to any (up to 30)')
    expect(summarizeAbilityOptions(terror)).toBe('CHA +1 (up to 30)')
    expect(summarizeAbilityOptions([{ ...boon[0], max: 20 }])).toBe('+1 to any')
    expect(
      summarizeAbilityOptions([
        { ...boon[0], amounts: [2], max: 30 },
        { ...boon[0], amounts: [1, 1], max: 30 },
      ]),
    ).toBe('any: +2 (up to 30) or +1, +1 (up to 30)')
  })
})

describe('optionIncreases', () => {
  it('adds the placed increases to the fixed ones', () => {
    expect(optionIncreases(dwarf, {})).toEqual({ con: 2, wis: 1 })
    expect(optionIncreases(halfElf, { str: 1, dex: 1, cha: 1 })).toEqual({
      cha: 2,
      str: 1,
      dex: 1,
    })
    expect(optionIncreases(twoAndOne, { str: 2, dex: 2 })).toEqual({ str: 2 })
  })
})

// Cases that were pinned on the feats' own copy of these functions.
describe('options as feats print them', () => {
  const grant = (block: Record<string, unknown>) => parseAbilityOptions([block])[0]

  it('adds fixed and placed increases, ignoring placements outside the choice', () => {
    const o = grant({ con: 1, choose: { from: ['str', 'con'], amount: 1 } })
    expect(optionIncreases(o, { dex: 1, con: 1 })).toEqual({ con: 2 })
    // Surplus placements are cut in ability order (Strength first).
    expect(optionIncreases(o, { con: 1, str: 1 })).toEqual({ str: 1, con: 1 })
    expect(optionIncreases(o, {})).toEqual({ con: 1 })
    expect(optionIncreases(grant({ wis: 1 }), { str: 1 })).toEqual({ wis: 1 })
  })

  it('counts the placements an option needs', () => {
    expect(grant({ wis: 1 })).toMatchObject({ amounts: [] })
    expect(grant({ choose: { count: 2 } }).amounts).toHaveLength(2)
    // A list of one ability cannot take two increases.
    expect(grant({ choose: { from: ['str'], count: 2 } }).amounts).toHaveLength(1)
    expect(increasesLeft(grant({ choose: { count: 2 } }), { str: 1 })).toBe(1)
  })

  it('describes options in plain language', () => {
    const wording = (block: Record<string, unknown>) =>
      describeAbilityOption(grant(block))
    expect(wording({ choose: { amount: 2 } })).toBe('+2 to one ability score')
    expect(wording({ choose: { count: 2 } })).toBe('+1 to two ability scores')
    expect(wording({ choose: { count: 4 } })).toBe('+1 to four ability scores')
    expect(wording({ choose: { from: ['str', 'dex'] } })).toBe(
      '+1 to Strength or Dexterity',
    )
    expect(wording({ choose: { from: ['str', 'dex', 'con'], count: 2 } })).toBe(
      '+1 to two of Strength, Dexterity, Constitution',
    )
    expect(
      wording({ choose: { from: ['str', 'dex', 'con', 'int', 'wis'], count: 5 } }),
    ).toBe('+1 to five of Strength, Dexterity, Constitution, Intelligence, Wisdom')
    expect(wording({ con: 1 })).toBe('+1 Constitution')
    expect(wording({ str: 1, max: 30 })).toBe('+1 Strength (up to 30)')
    // An option that gives nothing is not an option; the facts cell shows "-".
    expect(parseAbilityOptions([{}])).toEqual([])
  })
})
