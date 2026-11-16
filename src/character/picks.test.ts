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

  it('takes the choices an option asked for with it when its last one is taken away', () => {
    const feTag = 'class:Ranger|PHB|pick:Favored Enemy'
    const held = {
      [feTag]: ['humanoids', 'undead'],
      [`${feTag}|humanoids`]: ['gnoll', 'orc'],
      [tag]: ['Agonizing Blast|XPHB'],
      'option:Agonizing Blast|XPHB|pick:Cantrip': ['eldritch blast|xphb'],
      'option:Agonizing Blast|XPHB|pick:Cantrip|x': ['deeper'],
      'option:Lifedrinker|XPHB|pick:Cantrip': ['kept'],
    }
    const noHumanoids = pickClassOption(held, feTag, 'humanoids', true)
    expect(noHumanoids[feTag]).toEqual(['undead'])
    expect(noHumanoids).not.toHaveProperty([`${feTag}|humanoids`])
    const noBlast = pickClassOption(held, tag, 'Agonizing Blast|XPHB', true)
    expect(Object.keys(noBlast).sort()).toEqual(
      [feTag, `${feTag}|humanoids`, tag, 'option:Lifedrinker|XPHB|pick:Cantrip'].sort(),
    )
  })

  it('keeps the choices of an option while another of it remains or another slot has it', () => {
    const feTag = 'class:Ranger|PHB|pick:Favored Enemy'
    const twice = {
      [feTag]: ['humanoids', 'humanoids'],
      [`${feTag}|humanoids`]: ['gnoll', 'orc', 'ogre', 'goblin'],
    }
    expect(pickClassOption(twice, feTag, 'humanoids#2', true)).toHaveProperty([
      `${feTag}|humanoids`,
    ])
    const shared = {
      [tag]: ['Agonizing Blast|XPHB'],
      other: ['Agonizing Blast|XPHB'],
      'option:Agonizing Blast|XPHB|pick:Cantrip': ['x'],
    }
    expect(pickClassOption(shared, tag, 'Agonizing Blast|XPHB', true)).toHaveProperty([
      'option:Agonizing Blast|XPHB|pick:Cantrip',
    ])
  })
})
