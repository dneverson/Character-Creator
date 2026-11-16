import { describe, expect, it } from 'vitest'
import { createCharacter } from '../character/model'
import { editionMix, editionMixReason } from './originMix'

const background = (edition: 'classic' | 'one') => ({ edition })
const race = background

describe('mixed origins', () => {
  it('needs increases from both the race and the background', () => {
    const c = createCharacter('Mix')
    expect(editionMix(c)).toBe(false)
    c.race = {
      name: 'Elf',
      baseName: 'Elf',
      source: 'PHB',
      abilityFixed: { dex: 2 },
      abilityChoices: {},
    }
    c.background = { name: 'Acolyte', source: 'PHB', abilityChoices: {} }
    expect(editionMix(c)).toBe(false)
    c.background = { name: 'Acolyte', source: 'XPHB', abilityChoices: { wis: 2 } }
    expect(editionMix(c)).toBe(true)
  })

  it('names the edition of each origin and why it is not standard', () => {
    expect(editionMixReason(race('classic'), background('one'))).toBe(
      "This character gets ability bonuses from both a 2014 race and a 2024 background. Standard play uses one edition's origin rules, not both.",
    )
    expect(editionMixReason(race('one'), background('one'))).toContain(
      'Standard play takes them from one of the two, not both.',
    )
    expect(editionMixReason(undefined, background('one'))).toContain('from both its race')
  })
})
