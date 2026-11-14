import { describe, expect, it } from 'vitest'
import { pickClassOption } from './picks'

describe('pickClassOption', () => {
  const tag = 'class:Warlock|XPHB|EI'

  it('adds an option to its slot and keeps the other slots', () => {
    const other = { 'class:Fighter|PHB|FS:F': ['Defense|PHB'] }
    expect(pickClassOption(other, tag, "Devil's Sight|XPHB", false)).toEqual({
      ...other,
      [tag]: ["Devil's Sight|XPHB"],
    })
  })

  it('stores a repeat of a repeatable option as the same key again', () => {
    const once = { [tag]: ['Agonizing Blast|XPHB'] }
    expect(pickClassOption(once, tag, 'Agonizing Blast|XPHB#2', false)).toEqual({
      [tag]: ['Agonizing Blast|XPHB', 'Agonizing Blast|XPHB'],
    })
  })

  it('takes away the last of an option, and nothing when it is not there', () => {
    const twice = {
      [tag]: ['Agonizing Blast|XPHB', 'Mire the Mind|XPHB', 'Agonizing Blast|XPHB'],
    }
    expect(pickClassOption(twice, tag, 'Agonizing Blast|XPHB#2', true)).toEqual({
      [tag]: ['Agonizing Blast|XPHB', 'Mire the Mind|XPHB'],
    })
    expect(pickClassOption(twice, tag, 'Lifedrinker|XPHB', true)).toEqual(twice)
    expect(pickClassOption({}, tag, 'Lifedrinker|XPHB', true)).toEqual({ [tag]: [] })
  })
})
