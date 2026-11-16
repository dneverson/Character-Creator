import { describe, expect, it } from 'vitest'
import { holderId, type Holder } from './holder'

const subrace = (baseName: string): Holder => ({
  race: { baseName, source: 'PSZ', subraceName: 'Ixalan' },
})

describe('holderId', () => {
  it('tells two subraces of one name and book apart by their race', () => {
    expect(holderId(subrace('Goblin'))).not.toBe(holderId(subrace('Vampire')))
    expect(holderId(subrace('Goblin'))).toBe('subrace|Ixalan|PSZ|Goblin')
  })

  it('names a race by its name and book', () => {
    expect(holderId({ race: { baseName: 'Goblin', source: 'MPMM' } })).toBe(
      'race|Goblin|MPMM',
    )
  })
})
