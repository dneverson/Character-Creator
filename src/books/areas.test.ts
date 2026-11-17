import { describe, expect, it } from 'vitest'
import { sortAreas } from './areas'

const area = (key: string, name: string) => ({
  key,
  target: { chapter: 0, anchor: key, name },
})
const names = (list: ReturnType<typeof sortAreas>) => list.map((a) => a.target.name)

describe('sortAreas', () => {
  it('numbers areas as the book does, not as text', () => {
    const list = [11, 10, 9, 2, 1].map((n) => area(`0${n}`, `${n}. Room`))
    expect(names(sortAreas(list))).toEqual([
      '1. Room',
      '2. Room',
      '9. Room',
      '10. Room',
      '11. Room',
    ])
  })

  it('orders lettered areas by letter, then number', () => {
    const list = [area('1', 'K10. Vault'), area('2', 'K2. Hall'), area('3', 'A1. Gate')]
    expect(names(sortAreas(list))).toEqual(['A1. Gate', 'K2. Hall', 'K10. Vault'])
  })

  it('puts unnumbered areas after the numbered, in the order of the text', () => {
    const list = [area('0b', 'The Pit'), area('0a', 'Entrance'), area('0c', '3. Cellar')]
    expect(names(sortAreas(list))).toEqual(['3. Cellar', 'Entrance', 'The Pit'])
  })

  it('lists an area drawn twice once', () => {
    const list = [area('1a2', '4. Study'), area('1a2', '4. Study')]
    expect(sortAreas(list)).toHaveLength(1)
  })
})
