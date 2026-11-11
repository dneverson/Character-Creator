import { describe, expect, it } from 'vitest'
import { inFreeRules, srdNameOf } from './srd'

describe('srdNameOf', () => {
  it('is the name an entry of the full content says the SRD gives it', () => {
    expect(srdNameOf({ name: "Melf's Acid Arrow", srd: 'Acid Arrow' })).toBe('Acid Arrow')
    expect(srdNameOf({ name: 'Orb of Dragonkind', srd52: 'Dragon Orb' })).toBe(
      'Dragon Orb',
    )
  })

  it('is nothing when the SRD uses the entry own name, or leaves the entry out', () => {
    expect(srdNameOf({ name: 'Fireball', srd: true, srd52: true })).toBeUndefined()
    expect(srdNameOf({ name: 'Silvery Barbs' })).toBeUndefined()
  })
})

describe('inFreeRules', () => {
  it('is whether a System Reference Document print the entry', () => {
    expect(inFreeRules({ name: 'Club', srd: true })).toBe(true)
    expect(inFreeRules({ name: 'Orb', srd52: 'Dragon Orb' })).toBe(true)
    expect(inFreeRules({ name: 'Club', basicRules: true })).toBe(false)
    expect(inFreeRules({ name: 'Club', srd: false })).toBe(false)
    expect(inFreeRules({ name: 'Club' })).toBe(false)
  })
})
