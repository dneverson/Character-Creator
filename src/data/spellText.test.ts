import { describe, expect, it } from 'vitest'
import {
  areaOf,
  attackOf,
  cantripScalingOf,
  castingMinutesOf,
  castingUnitOf,
  componentsOf,
  componentsText,
  damageOf,
  durationKindOf,
  durationText,
  healingOf,
  materialOf,
  materialText,
  ordinal,
  rangeFeetOf,
  rangeText,
  tagsOf,
  timeText,
  upcastOf,
} from './spellText'

const feet = (amount: number) => ({ type: 'point', distance: { type: 'feet', amount } })

describe('ordinal', () => {
  it('writes ordinals', () => {
    expect([1, 2, 3, 4, 9, 11, 12, 13, 21].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '9th',
      '11th',
      '12th',
      '13th',
      '21st',
    ])
  })
})

describe('casting time', () => {
  it('writes actions, bonus actions, minutes and hours', () => {
    expect(timeText([{ number: 1, unit: 'action' }])).toBe('1 action')
    expect(timeText([{ number: 1, unit: 'bonus' }])).toBe('1 bonus action')
    expect(timeText([{ number: 10, unit: 'minute' }])).toBe('10 minutes')
    expect(timeText([{ number: 1, unit: 'hour' }])).toBe('1 hour')
    expect(timeText(undefined)).toBe('')
  })

  it('keeps the condition of a reaction, without its tags', () => {
    expect(
      timeText([
        {
          number: 1,
          unit: 'reaction',
          condition: 'which you take when you are hit by {@spell magic missile}',
        },
      ]),
    ).toBe('1 reaction, which you take when you are hit by magic missile')
  })

  it('writes both times of Plant Growth, with the 2024 notes', () => {
    expect(
      timeText([
        { number: 1, unit: 'action' },
        { number: 8, unit: 'hour' },
      ]),
    ).toBe('1 action or 8 hours')
    expect(
      timeText([
        { number: 1, unit: 'action', note: 'Overgrowth' },
        { number: 8, unit: 'hour', note: 'Enrichment' },
      ]),
    ).toBe('1 action (Overgrowth) or 8 hours (Enrichment)')
  })

  it('gives a unit to filter by and a number to sort by', () => {
    const of = (unit: string, number = 1) => [{ number, unit }]
    expect(
      ['action', 'bonus', 'reaction', 'minute', 'hour', 'day'].map((u) =>
        castingUnitOf(of(u)),
      ),
    ).toEqual(['Action', 'Bonus action', 'Reaction', 'Minute', 'Hour', 'Other'])
    expect(castingUnitOf(undefined)).toBe('Other')
    const sorted = ['action', 'bonus', 'reaction', 'minute', 'hour'].map((u) =>
      castingMinutesOf(of(u, 2)),
    )
    expect(sorted).toEqual([0, 0.01, 0.02, 2, 120])
    expect(castingMinutesOf(of('day'))).toBe(0)
    expect(castingMinutesOf(undefined)).toBe(0)
  })
})

describe('range and area', () => {
  it('writes the kinds of range', () => {
    expect(rangeText(feet(150))).toBe('150 ft.')
    expect(rangeText({ type: 'point', distance: { type: 'self' } })).toBe('Self')
    expect(rangeText({ type: 'point', distance: { type: 'touch' } })).toBe('Touch')
    expect(rangeText({ type: 'point', distance: { type: 'sight' } })).toBe('Sight')
    expect(rangeText({ type: 'point', distance: { type: 'unlimited' } })).toBe(
      'Unlimited',
    )
    expect(rangeText({ type: 'point', distance: { type: 'miles', amount: 1 } })).toBe(
      '1 mile',
    )
    expect(rangeText({ type: 'point', distance: { type: 'miles', amount: 500 } })).toBe(
      '500 miles',
    )
    expect(rangeText({ type: 'special' })).toBe('Special')
    expect(rangeText(undefined)).toBe('Special')
    expect(rangeText({ type: 'point', distance: { type: 'odd' } })).toBe('Special')
  })

  it('writes a self range with its shape', () => {
    expect(rangeText({ type: 'cone', distance: { type: 'feet', amount: 30 } })).toBe(
      'Self (30-ft. cone)',
    )
    expect(rangeText({ type: 'sphere', distance: { type: 'miles', amount: 1 } })).toBe(
      'Self (1-mile sphere)',
    )
    expect(
      areaOf({ type: 'cone', distance: { type: 'feet', amount: 30 } }, undefined),
    ).toBe('30-ft. cone')
  })

  it('sorts self, touch, distances, then sight, unlimited and special', () => {
    const order = [
      rangeFeetOf({ type: 'point', distance: { type: 'self' } }),
      rangeFeetOf({ type: 'point', distance: { type: 'touch' } }),
      rangeFeetOf(feet(150)),
      rangeFeetOf({ type: 'point', distance: { type: 'miles', amount: 1 } }),
      rangeFeetOf({ type: 'point', distance: { type: 'sight' } }),
      rangeFeetOf({ type: 'point', distance: { type: 'unlimited' } }),
      rangeFeetOf({ type: 'special' }),
    ]
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(rangeFeetOf({ type: 'cube', distance: { type: 'feet', amount: 15 } })).toBe(0)
    expect(rangeFeetOf(undefined)).toBe(rangeFeetOf({ type: 'special' }))
    expect(rangeFeetOf({ type: 'point', distance: { type: 'odd' } })).toBe(
      rangeFeetOf({ type: 'special' }),
    )
  })

  it('reads the area of a ranged spell from its decoded area tags', () => {
    expect(areaOf(feet(150), ['S'])).toBe('Sphere')
    expect(areaOf(feet(60), ['MT', 'ST'])).toBe('Multiple targets, Single target')
    expect(areaOf(feet(60), ['ZZ'])).toBe('')
    expect(areaOf(undefined, undefined)).toBe('')
  })
})

describe('components', () => {
  it('reads which components a spell needs', () => {
    expect(componentsOf({ v: true, s: true, m: 'bat guano' })).toEqual({
      v: true,
      s: true,
      m: true,
      royalty: false,
    })
    expect(componentsOf({ v: true, s: true, r: true }).royalty).toBe(true)
    expect(componentsOf(undefined)).toEqual({
      v: false,
      s: false,
      m: false,
      royalty: false,
    })
  })

  it('summarizes components, with a dash when there are none (was componentsLabel)', () => {
    expect(componentsText(componentsOf({ v: true, s: true, m: 'a bit of fleece' }))).toBe(
      'V, S, M',
    )
    expect(componentsText(componentsOf({ v: true }))).toBe('V')
    expect(componentsText(componentsOf({ v: true, s: true, r: true }))).toBe(
      'V, S, Royalty',
    )
    expect(componentsText(componentsOf({}))).toBe('-')
    expect(componentsText(componentsOf(undefined))).toBe('-')
  })

  it('reads the material, its cost in gp and whether it is consumed', () => {
    expect(materialOf({ v: true })).toBeUndefined()
    expect(materialOf({ m: 'a tiny ball of bat guano' })).toEqual({
      text: 'a tiny ball of bat guano',
      consumed: false,
    })
    const rod = materialOf({
      m: { text: 'a crystal rod worth at least 5,000 gp', cost: 500000, consume: true },
    })
    expect(rod).toEqual({
      text: 'a crystal rod worth at least 5,000 gp',
      costGp: 5000,
      consumed: true,
    })
    expect(materialText(rod)).toBe(
      'a crystal rod worth at least 5,000 gp (worth 5,000 gp, consumed)',
    )
    const gem = materialOf({ m: { text: 'a gem', cost: 5000, consume: 'optional' } })
    expect(gem?.consumed).toBe(false)
    expect(materialText(gem)).toBe('a gem (worth 50 gp)')
    expect(materialText(materialOf({ m: { text: 'a pinch of salt' } }))).toBe(
      'a pinch of salt',
    )
    expect(materialText(undefined)).toBe('')
  })
})

describe('duration', () => {
  it('writes instant, timed, concentration, permanent and special durations', () => {
    expect(durationText([{ type: 'instant' }])).toBe('Instantaneous')
    expect(durationText([{ type: 'timed', duration: { type: 'hour', amount: 1 } }])).toBe(
      '1 hour',
    )
    expect(
      durationText([
        { type: 'timed', duration: { type: 'minute', amount: 1 }, concentration: true },
      ]),
    ).toBe('Concentration, up to 1 minute')
    expect(
      durationText([
        { type: 'timed', duration: { type: 'round', amount: 2, upTo: true } },
      ]),
    ).toBe('Up to 2 rounds')
    expect(durationText([{ type: 'timed' }])).toBe('Special')
    expect(durationText([{ type: 'permanent', ends: ['dispel'] }])).toBe(
      'Until dispelled',
    )
    expect(durationText([{ type: 'permanent', ends: ['dispel', 'trigger'] }])).toBe(
      'Until dispelled or triggered',
    )
    expect(durationText([{ type: 'permanent', ends: ['trigger'] }])).toBe(
      'Until triggered',
    )
    expect(durationText([{ type: 'special' }])).toBe('Special')
    expect(durationText(undefined)).toBe('')
  })

  it('writes the two durations of Control Flames', () => {
    expect(
      durationText([
        { type: 'instant' },
        { type: 'timed', duration: { type: 'hour', amount: 1 } },
      ]),
    ).toBe('Instantaneous or 1 hour')
  })

  it('sorts a duration into a kind, concentration first', () => {
    expect(durationKindOf([{ type: 'instant' }])).toBe('Instantaneous')
    expect(durationKindOf([{ type: 'timed' }])).toBe('Timed')
    expect(durationKindOf([{ type: 'timed', concentration: true }])).toBe('Concentration')
    expect(durationKindOf([{ type: 'permanent' }])).toBe('Permanent')
    expect(durationKindOf([{ type: 'special' }])).toBe('Special')
    expect(durationKindOf(undefined)).toBe('Special')
  })
})

describe('damage', () => {
  it('pairs the dice with the type written after them (Fireball)', () => {
    const entries = [
      'Each creature must make a Dexterity saving throw. A target takes {@damage 8d6} fire damage on a failed save, or half as much damage on a successful one.',
    ]
    expect(damageOf(entries, ['fire'])).toEqual({ text: '8d6 Fire', types: ['Fire'] })
  })

  it('pairs untyped dice with the only damage type the spell inflicts', () => {
    expect(damageOf(['takes {@damage 2d6} damage.'], ['cold'])).toEqual({
      text: '2d6 Cold',
      types: ['Cold'],
    })
  })

  it("reads a capitalized 2024 type word, even with no damageInflict (Hunter's Mark)", () => {
    expect(damageOf(['an extra {@damage 1d6} Force damage'], undefined)).toEqual({
      text: '1d6 Force',
      types: ['Force'],
    })
  })

  it("shows dice alone when nothing names the type (Hunter's Mark, 2014)", () => {
    expect(damageOf(['an extra {@damage 1d6} damage to the target'], undefined)).toEqual({
      text: '1d6',
      types: [],
    })
  })

  it('lists the distinct damage of a spell that deals several, in reading order', () => {
    const entries = [
      'takes {@damage 3d10} lightning damage.',
      {
        type: 'entries',
        entries: [
          'then {@damage 1d10} lightning damage, then {@damage 3d10} lightning damage',
        ],
      },
    ]
    expect(damageOf(entries, ['lightning']).text).toBe('3d10 Lightning; 1d10 Lightning')
  })

  it('does not take the dice of a word that is no damage type', () => {
    expect(
      damageOf(['{@damage 1d4} piercing damage; {@damage 1d6} extra damage'], undefined)
        .text,
    ).toBe('1d4 Piercing; 1d6')
  })

  it('shows the inflicted types when the text carries no damage tag (Armor of Agathys)', () => {
    expect(damageOf(['the creature takes 5 cold damage.'], ['cold'])).toEqual({
      text: 'Cold',
      types: ['Cold'],
    })
    expect(damageOf([], ['cold', 'necrotic']).text).toBe('Cold, Necrotic')
    expect(damageOf(undefined, undefined)).toEqual({ text: '', types: [] })
  })

  it('shows only the first dice of a scaling cantrip (Acid Splash)', () => {
    const entries = [
      'take {@damage 1d6} acid damage.',
      "This spell's damage increases by {@damage 1d6} when you reach 5th level ({@damage 2d6}), 11th level ({@damage 3d6}).",
    ]
    expect(damageOf(entries, ['acid'], true).text).toBe('1d6 Acid')
    expect(damageOf(entries, ['acid']).text).toBe('1d6 Acid; 2d6 Acid; 3d6 Acid')
  })

  it('reads the dice of an eldritch blast beam', () => {
    expect(
      damageOf(['the target takes {@damage 1d10} force damage.'], ['force']).text,
    ).toBe('1d10 Force')
  })
})

describe('healing', () => {
  it('reads the dice of a heal that states them (Cure Wounds)', () => {
    expect(
      healingOf(
        [
          'A creature regains a number of hit points equal to {@dice 2d8} + your spellcasting ability modifier.',
        ],
        ['HL'],
      ),
    ).toBe('2d8 + spellcasting modifier')
    expect(healingOf(['The target regains {@dice 4d4} hit points.'], ['HL'])).toBe('4d4')
  })

  it('says Yes when the healing is not dice (Heal)', () => {
    expect(
      healingOf(
        [
          'A surge of positive energy causes it to regain 70 hit points. It also ends blinded.',
        ],
        ['HL'],
      ),
    ).toBe('Yes')
  })

  it('shows nothing for a spell that does not heal', () => {
    expect(healingOf(['regains {@dice 2d8} hit points'], ['SGT'])).toBe('')
    expect(healingOf(['regains {@dice 2d8} hit points'], undefined)).toBe('')
  })
})

describe('upcast', () => {
  const named = (text: string, name = 'At Higher Levels') => [
    { type: 'entries', name, entries: [text] },
  ]

  it('reads the increment and where it starts', () => {
    expect(
      upcastOf(
        named(
          'the damage increases by {@scaledamage 8d6|3-9|1d6} for each slot level above 3rd.',
        ),
      ),
    ).toBe('+1d6 per slot level above 3rd')
    expect(upcastOf(named('increases by {@scaledice 1d8|1-9|1d8}'))).toBe(
      '+1d8 per slot level above 1st',
    )
  })

  it('reads a two-dice increment and fixed levels', () => {
    expect(upcastOf(named('{@scaledamage 2d8;2d6|3-9|1d8;1d6}'))).toBe(
      '+1d8 and 1d6 per slot level above 3rd',
    )
    expect(upcastOf(named('{@scaledamage 4d6|5,6,7|1d6}'))).toBe('+1d6 at levels 5, 6, 7')
  })

  it('reads the older wording that tags no scaling', () => {
    expect(
      upcastOf(named('it increases by {@damage 1d8} for each slot level above 5th')),
    ).toBe('+1d8 per slot level above 5th')
  })

  it('says Yes for higher-level text with no dice to state', () => {
    expect(upcastOf(named('you can target one additional creature.'))).toBe('Yes')
    expect(upcastOf(named('{@scaledamage 1d6}'))).toBe('Yes')
  })

  it('shows nothing without higher-level text, or with only a cantrip upgrade', () => {
    expect(upcastOf(undefined)).toBe('')
    expect(upcastOf(named('{@scaledamage 8d6|3-9|1d6}', 'Cantrip Upgrade'))).toBe('')
    expect(upcastOf(['plain text'])).toBe('Yes')
  })
})

describe('cantrip scaling', () => {
  it('writes the dice at each tier', () => {
    expect(
      cantripScalingOf({
        label: 'acid damage',
        scaling: { '1': '1d6', '5': '2d6', '11': '3d6', '17': '4d6' },
      }),
    ).toBe('1d6, 2d6 at 5, 3d6 at 11, 4d6 at 17')
  })

  it('labels each of the two scalings of a cantrip that has two', () => {
    expect(
      cantripScalingOf([
        { label: 'thunder damage on moving', scaling: { '1': '1d8', '5': '2d8' } },
        { label: 'thunder damage on hit', scaling: { '5': '1d8', '11': '2d8' } },
      ]),
    ).toBe(
      'thunder damage on moving: 1d8, 2d8 at 5; thunder damage on hit: 1d8, 2d8 at 11',
    )
    expect(cantripScalingOf(undefined)).toBe('')
  })
})

describe('small decodes', () => {
  it('decodes miscellaneous tags and drops codes it cannot decode', () => {
    expect(tagsOf(['TP', 'SMN', 'ZZZ'])).toEqual(['Teleportation', 'Summons'])
    expect(tagsOf(undefined)).toEqual([])
  })

  it('reads the kind of spell attack', () => {
    expect(attackOf(['R'])).toBe('Ranged')
    expect(attackOf(['M'])).toBe('Melee')
    expect(attackOf(undefined)).toBe('')
  })
})
