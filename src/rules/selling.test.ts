import { describe, expect, it } from 'vitest'
import { makeItem } from '../test/itemFixtures'
import { sellPrice } from './selling'

describe('what an item sells for', () => {
  it('gives half the listed price for mundane gear in both editions', () => {
    const sword = makeItem({ name: 'Longsword', kind: 'weapon', value: 1500 })
    expect(sellPrice(sword, 'classic').copper).toBe(750)
    expect(sellPrice(sword, 'one').copper).toBe(750)
    expect(sellPrice(makeItem({ name: 'Nail', value: 5 }), 'classic').copper).toBe(2)
  })

  it('keeps the full value of trade goods and treasure', () => {
    const goods = makeItem({ name: 'Wheat', kind: 'trade', value: 10 })
    const gem = makeItem({ name: 'Ruby', kind: 'treasure', value: 50000 })
    expect(sellPrice(goods, 'classic').copper).toBe(10)
    expect(sellPrice(gem, 'one').copper).toBe(50000)
  })

  it('leaves the price of a magic item or an unpriced item to the player', () => {
    const magic = makeItem({ name: '+1 Sword', kind: 'weapon', magic: true, value: 100 })
    expect(sellPrice(magic, 'classic').copper).toBeUndefined()
    expect(sellPrice(magic, 'classic').note).toMatch(/Enter the price/)
    const unpriced = makeItem({ name: 'Odd Thing' })
    expect(sellPrice(unpriced, 'one').copper).toBeUndefined()
  })
})
