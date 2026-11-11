import { describe, expect, it } from 'vitest'
import { beastFit, crLabel, wildShapeLimits, wildShapeRuleLines } from './wildshape'
import { makeBeast } from '../test/beastFixtures'
import { crToNumber } from '../data/beasts'

describe('wildShapeLimits (base druid)', () => {
  it('is unavailable before level 2', () => {
    expect(wildShapeLimits(1, false).available).toBe(false)
  })
  it('caps CR at 1/4 with no fly/swim at level 2', () => {
    const l = wildShapeLimits(2, false)
    expect(l).toMatchObject({
      available: true,
      maxCr: 0.25,
      allowSwim: false,
      allowFly: false,
    })
  })
  it('allows swim and CR 1/2 at level 4', () => {
    const l = wildShapeLimits(4, false)
    expect(l).toMatchObject({ maxCr: 0.5, allowSwim: true, allowFly: false })
  })
  it('allows fly and CR 1 at level 8', () => {
    const l = wildShapeLimits(8, false)
    expect(l).toMatchObject({ maxCr: 1, allowSwim: true, allowFly: true })
  })
})

describe('wildShapeLimits (Circle of the Moon)', () => {
  it('raises the CR cap to max(1, level/3)', () => {
    expect(wildShapeLimits(2, true).maxCr).toBe(1)
    expect(wildShapeLimits(6, true).maxCr).toBe(2)
    expect(wildShapeLimits(9, true).maxCr).toBe(3)
  })
})

describe('crToNumber', () => {
  it('parses fractions and integers', () => {
    expect(crToNumber('1/8')).toBe(0.125)
    expect(crToNumber('1/2')).toBe(0.5)
    expect(crToNumber('3')).toBe(3)
  })
})

describe('wildShapeLimits (2024)', () => {
  it('knows 4, 6 and 8 forms by level and none before level 2', () => {
    expect(wildShapeLimits(1, false, 'one').knownForms).toBeUndefined()
    expect(wildShapeLimits(2, false, 'one').knownForms).toBe(4)
    expect(wildShapeLimits(3, false, 'one').knownForms).toBe(4)
    expect(wildShapeLimits(4, false, 'one').knownForms).toBe(6)
    expect(wildShapeLimits(8, false, 'one').knownForms).toBe(8)
  })

  it('has no swimming limit and the same CR and flying limits as 2014', () => {
    expect(wildShapeLimits(2, false, 'one')).toMatchObject({
      maxCr: 0.25,
      allowSwim: true,
      allowFly: false,
    })
    expect(wildShapeLimits(8, false, 'one')).toMatchObject({ maxCr: 1, allowFly: true })
  })

  it('counts uses, hours and temporary hit points from the class table', () => {
    expect(wildShapeLimits(5, false, 'one')).toMatchObject({
      uses: 2,
      hours: 2,
      tempHp: 5,
    })
    expect(wildShapeLimits(6, false, 'one').uses).toBe(3)
    expect(wildShapeLimits(17, false, 'one').uses).toBe(4)
  })

  it('gives the Moon a third of the druid level, triple temporary hit points', () => {
    expect(wildShapeLimits(3, true, 'one')).toMatchObject({ maxCr: 1, tempHp: 9 })
    expect(wildShapeLimits(9, true, 'one')).toMatchObject({ maxCr: 3, tempHp: 27 })
    // Before the subclass the base table applies.
    expect(wildShapeLimits(2, true, 'one')).toMatchObject({ maxCr: 0.25, tempHp: 2 })
  })

  it('leaves the 2014 rule without a count of forms', () => {
    expect(wildShapeLimits(8, false)).toMatchObject({ edition: 'classic' })
    expect(wildShapeLimits(8, false).knownForms).toBeUndefined()
  })
})

describe('crLabel', () => {
  it('writes fractions and whole numbers', () => {
    expect(crLabel(0.125)).toBe('1/8')
    expect(crLabel(0.5)).toBe('1/2')
    expect(crLabel(0)).toBe('0')
    expect(crLabel(2)).toBe('2')
  })
})

describe('beastFit', () => {
  const l4 = wildShapeLimits(4, false)
  it('accepts a beast inside the limits', () => {
    expect(beastFit(makeBeast({ name: 'Wolf', cr: '1/4', crValue: 0.25 }), l4)).toEqual({
      standard: true,
    })
  })
  it('rejects swarms and creatures without a challenge rating', () => {
    expect(beastFit(makeBeast({ name: 'Rats', swarm: true }), l4).reason).toMatch(
      /swarm/i,
    )
    expect(beastFit(makeBeast({ name: 'Spirit', hasCr: false }), l4).reason).toMatch(
      /No challenge rating/,
    )
  })
  it('gives the reason for a CR, flying or swimming limit', () => {
    expect(beastFit(makeBeast({ name: 'Bear', cr: '1', crValue: 1 }), l4).reason).toBe(
      'CR 1 is above your limit of 1/2',
    )
    expect(beastFit(makeBeast({ name: 'Bat', hasFly: true }), l4).reason).toMatch(
      /flying/,
    )
    const l2 = wildShapeLimits(2, false)
    expect(beastFit(makeBeast({ name: 'Frog', hasSwim: true }), l2).reason).toMatch(
      /Swimming/,
    )
    // The 2024 rule has no swimming limit.
    expect(
      beastFit(
        makeBeast({ name: 'Frog', hasSwim: true }),
        wildShapeLimits(2, false, 'one'),
      ),
    ).toEqual({ standard: true })
  })
})

describe('wildShapeRuleLines', () => {
  it('states the 2014 rule: no count of forms, movement limits by level', () => {
    const lines = wildShapeRuleLines(wildShapeLimits(4, false))
    expect(lines[0]).toBe('Druid 4: Beasts up to CR 1/2 that have no flying speed.')
    expect(lines.join(' ')).toMatch(/no limit on how many forms/)
    expect(wildShapeRuleLines(wildShapeLimits(2, false))[0]).toMatch(
      /neither a flying nor a swimming/,
    )
    expect(wildShapeRuleLines(wildShapeLimits(8, false))[0]).toMatch(
      /^Druid 8: Beasts up to CR 1, flying and swimming included/,
    )
    expect(wildShapeRuleLines(wildShapeLimits(6, true)).join(' ')).toMatch(
      /Circle of the Moon.*bonus action/,
    )
  })

  it('states the 2024 rule: known forms, uses and temporary hit points', () => {
    const text = wildShapeRuleLines(wildShapeLimits(5, false, 'one')).join(' ')
    expect(text).toMatch(/You know 6 forms/)
    expect(text).toMatch(/2 uses/)
    expect(text).toMatch(/5 temporary hit points/)
    expect(text).not.toMatch(/no limit on how many/)
    expect(wildShapeRuleLines(wildShapeLimits(9, true, 'one')).join(' ')).toMatch(
      /27 temporary hit points.*AC is 13 plus your Wisdom/,
    )
  })
})
