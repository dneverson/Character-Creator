import { describe, expect, it } from 'vitest'
import { SHEET_TABS, visibleTabs } from './tabs'
import { deriveSheet } from '../derived'
import { createCharacter } from '../character/model'
import { build, deps, loadedClass, FIGHTER } from '../test/derivedFixtures'

function wizardSheet() {
  const wizard = loadedClass('Wizard', [], [])
  wizard.entry.spellcastingAbility = 'int'
  wizard.entry.casterProgression = 'full'
  wizard.entry.cantripProgression = [3]
  return deriveSheet(build('Wizard', 3, { int: 16 }, []), deps([wizard]))
}

const ids = (tabs: { id: string }[]) => tabs.map((t) => t.id)

describe('sheet tabs', () => {
  it('has a tab for each id once', () => {
    const all = ids([...SHEET_TABS])
    expect(new Set(all).size).toBe(all.length)
  })

  it('hides the Spells tab for a character who casts nothing', () => {
    const sheet = deriveSheet(createCharacter('Plain'), deps([FIGHTER]))
    expect(ids(visibleTabs(sheet, false))).not.toContain('spells')
  })

  it('shows the Spells tab for a caster', () => {
    expect(ids(visibleTabs(wizardSheet(), false))).toContain('spells')
  })

  it('keeps Core and Skills for a phone, where the left column is gone', () => {
    const sheet = deriveSheet(createCharacter('Plain'), deps([FIGHTER]))
    expect(ids(visibleTabs(sheet, true)).slice(0, 3)).toEqual([
      'core',
      'skills',
      'actions',
    ])
    expect(ids(visibleTabs(sheet, false))).not.toContain('core')
    expect(ids(visibleTabs(sheet, false))).not.toContain('skills')
  })
})
