import { describe, expect, it } from 'vitest'
import { stripTags } from './tags'

describe('stripTags', () => {
  it('shows the display override or primary text for reference tags', () => {
    expect(stripTags('Cast {@spell fireball}')).toBe('Cast fireball')
    expect(stripTags('{@spell fireball|phb|fire ball}')).toBe('fire ball')
    expect(stripTags('a {@item longsword|phb}')).toBe('a longsword')
    expect(stripTags('{@condition prone}')).toBe('prone')
    expect(stripTags('{@skill Stealth}')).toBe('Stealth')
  })

  it('handles dice and damage', () => {
    expect(stripTags('deals {@damage 2d6} fire')).toBe('deals 2d6 fire')
    expect(stripTags('roll {@dice 1d20+5}')).toBe('roll 1d20+5')
  })

  it('handles combat shorthands', () => {
    expect(stripTags('{@atk mw} {@hit 5} to hit')).toBe('Melee Weapon Attack +5 to hit')
    expect(stripTags('{@h}7 damage')).toBe('Hit: 7 damage')
    expect(stripTags('save {@dc 15}')).toBe('save DC 15')
  })

  it('resolves nested tags', () => {
    expect(stripTags('{@b {@i strong}}')).toBe('strong')
  })

  it('passes through plain text', () => {
    expect(stripTags('no tags here')).toBe('no tags here')
  })

  it('formats chance, recharge, and negative hit bonuses', () => {
    expect(stripTags('{@chance 25} to escape')).toBe('25% to escape')
    expect(stripTags('{@recharge 5}')).toBe('(Recharge 5–6)')
    expect(stripTags('{@recharge}')).toBe('(Recharge 6)')
    expect(stripTags('{@hit -2} to hit')).toBe('-2 to hit')
  })

  it('shows the first part for book/adventure references', () => {
    expect(stripTags('see {@book Player Handbook|PHB}')).toBe('see Player Handbook')
    expect(stripTags('{@footnote note text|extra}')).toBe('note text')
  })

  it('falls back to the raw kind for an unknown attack code', () => {
    expect(stripTags('{@atk weird}')).toBe('weird')
  })

  it('uses the dice expression when a display override is present', () => {
    expect(stripTags('{@scaledamage 1d6|1-9|2d6}')).toBe('1-9')
  })

  it('coerces non-string input to a string', () => {
    expect(stripTags(42 as unknown as string)).toBe('42')
  })
})
