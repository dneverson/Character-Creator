import { describe, expect, it } from 'vitest'
import {
  editionYear,
  feet,
  senseText,
  sizeLabel,
  speedDistance,
  speedLabel,
  walkingSpeed,
} from './labels'

describe('feet', () => {
  it('writes a distance as the books do', () => {
    expect(feet(60)).toBe('60 ft.')
  })
})

describe('sizeLabel', () => {
  it('spells out size codes', () => {
    expect(sizeLabel(['M'])).toBe('Medium')
    expect(sizeLabel(['S', 'M'])).toBe('Small or Medium')
  })

  it('reads the "player chooses" code, and shows an unknown code as it is', () => {
    expect(sizeLabel(['V'])).toBe('Varies')
    expect(sizeLabel(['Z'])).toBe('Z')
  })

  it('is empty when no size is given', () => {
    expect(sizeLabel(undefined)).toBe('')
    expect(sizeLabel([])).toBe('')
  })
})

describe('speedLabel', () => {
  it('writes a single walking speed', () => {
    expect(speedLabel(25)).toBe('25 ft.')
  })

  it('leads with walking and names the other ways of moving', () => {
    expect(speedLabel({ walk: 30, swim: 40 })).toBe('30 ft., swim 40 ft.')
    expect(speedLabel({ fly: 50, walk: 30 })).toBe('30 ft., fly 50 ft.')
  })

  it('gives a way marked true the walking speed', () => {
    expect(speedLabel({ walk: 30, fly: true })).toBe('30 ft., fly 30 ft.')
  })

  it('names a way marked true when there is no walking speed, and skips false', () => {
    expect(speedLabel({ hover: true, climb: false })).toBe('hover')
  })

  it('is empty when no speed is given', () => {
    expect(speedLabel(undefined)).toBe('')
  })

  // Moved from beasts.test: its cases, written for the one shared function.
  it('lists the ways of moving that have a positive distance', () => {
    expect(speedLabel({ walk: 40, fly: 60, swim: 0 })).toBe('40 ft., fly 60 ft.')
    expect(speedLabel({ walk: true })).toBe('')
    expect(speedLabel({})).toBe('')
  })

  it('writes a way of moving that carries a condition', () => {
    expect(speedLabel({ walk: 10, fly: { number: 60, condition: '(air only)' } })).toBe(
      '10 ft., fly 60 ft. (air only)',
    )
    expect(speedLabel({ fly: { number: 50 } })).toBe('fly 50 ft.')
  })

  it('writes a choice of ways of moving and ignores the hover flag', () => {
    expect(
      speedLabel({
        walk: 20,
        choose: { from: ['climb', 'fly'], amount: 20, note: "(DM's choice)" },
        canHover: true,
      }),
    ).toBe("20 ft., climb or fly 20 ft. (DM's choice)")
    expect(speedLabel({ walk: 20, choose: { from: ['fly'], amount: 10 } })).toBe(
      '20 ft., fly 10 ft.',
    )
  })
})

describe('speedDistance', () => {
  it('reads a number, a number with a condition, and nothing else', () => {
    expect(speedDistance(30)).toBe(30)
    expect(speedDistance({ number: 60, condition: '(hover)' })).toBe(60)
    expect(speedDistance(true)).toBeUndefined()
    expect(speedDistance(undefined)).toBeUndefined()
  })
})

describe('walkingSpeed', () => {
  it('is the walking speed, or 0 without one', () => {
    expect(walkingSpeed(35)).toBe(35)
    expect(walkingSpeed({ walk: 30, fly: 60 })).toBe(30)
    expect(walkingSpeed({ swim: 30 })).toBe(0)
    expect(walkingSpeed(undefined)).toBe(0)
  })
})

describe('editionYear', () => {
  it('names the edition by its year, the 2014 rules unless marked otherwise', () => {
    expect(editionYear('one')).toBe('2024')
    expect(editionYear('classic')).toBe('2014')
    expect(editionYear(undefined)).toBe('2014')
  })
})

describe('senseText', () => {
  it('writes each sense with its range, and a bonus as an addition', () => {
    expect(senseText([{ blindsight: 10 }])).toBe('Blindsight 10 ft.')
    expect(senseText([{ darkvision: 60 }], true)).toBe('Darkvision +60 ft.')
    expect(senseText([{ blindsight: 10, truesight: 60 }])).toBe(
      'Blindsight 10 ft., Truesight 60 ft.',
    )
  })

  it('is empty without readable senses', () => {
    expect(senseText(undefined)).toBe('')
    expect(senseText([null, { darkvision: true }])).toBe('')
  })
})
