import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SavesPanel, SensesPanel, SkillsPanel } from './SidePanels'
import { deriveSheet } from '../../derived'
import { build, deps, FIGHTER } from '../../test/derivedFixtures'

function sheetOf() {
  const c = build('Fighter', 1, { str: 16, wis: 14 }, [])
  c.grantPicks = { skill: { athletics: 'manual', stealth: 'manual' } }
  return deriveSheet(c, deps([FIGHTER]))
}

describe('sheet side panels', () => {
  it('marks a skill as proficient or with expertise, and shows its modifier', () => {
    const sheet = sheetOf()
    const skills = sheet.skills.map((s) =>
      s.key === 'stealth' ? { ...s, expertise: 'class:Rogue|PHB' } : s,
    )
    render(<SkillsPanel sheet={{ ...sheet, skills }} />)
    const list = screen.getByRole('list', { name: 'Skills' })
    const row = (name: string) =>
      within(list).getByText(name).closest('li') as HTMLElement
    expect(within(row('Athletics')).getByLabelText('Proficient')).toHaveTextContent('P')
    expect(within(row('Athletics')).getByText('+5')).toBeInTheDocument()
    expect(within(row('Stealth')).getByLabelText('Expertise')).toHaveTextContent('E')
    expect(within(row('Arcana')).queryByLabelText('Proficient')).not.toBeInTheDocument()
    expect(within(list).getAllByRole('listitem')).toHaveLength(18)
  })

  it('lists the six saving throws and marks the ones the character is proficient in', () => {
    const sheet = sheetOf()
    const source = { kind: 'class', tag: 'class:Fighter|PHB', label: 'Fighter' } as const
    const save = [{ value: 'Strength', sources: [source] }]
    render(
      <SavesPanel
        sheet={{
          ...sheet,
          proficiencies: {
            ...sheet.proficiencies,
            listing: { ...sheet.proficiencies.listing, save },
          },
        }}
      />,
    )
    const list = screen.getByRole('list', { name: 'Saving throws' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(6)
    const strength = within(list).getByText('Strength').closest('li') as HTMLElement
    expect(within(strength).getByLabelText('Proficient')).toBeInTheDocument()
    const dex = within(list).getByText('Dexterity').closest('li') as HTMLElement
    expect(within(dex).queryByLabelText('Proficient')).not.toBeInTheDocument()
  })

  it('shows each passive score', () => {
    render(<SensesPanel sheet={sheetOf()} />)
    const list = screen.getByRole('list', { name: 'Senses' })
    expect(within(list).getByText('Passive Perception')).toBeInTheDocument()
    expect(within(list).getByText('Passive Investigation')).toBeInTheDocument()
    expect(within(list).getByText('Passive Insight')).toBeInTheDocument()
  })
})
