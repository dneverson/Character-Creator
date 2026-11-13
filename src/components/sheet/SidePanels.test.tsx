import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ProficienciesPanel, SavesPanel, SensesPanel, SkillsPanel } from './SidePanels'
import { SheetDetailProvider } from './SheetDetail'
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
    const saves = { ...sheet.saves, str: { ...sheet.saves.str, proficient: true } }
    render(<SavesPanel sheet={{ ...sheet, saves }} />)
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

  it('lists each proficiency group as a comma line that opens where each comes from', async () => {
    const user = userEvent.setup()
    const sheet = sheetOf()
    render(
      <SheetDetailProvider>
        <ProficienciesPanel sheet={sheet} />
      </SheetDetailProvider>,
    )
    const armor = screen.getByRole('button', {
      name: /^Armor: where each one comes from/,
    })
    expect(armor).toHaveTextContent('Armor')
    expect(armor).toHaveTextContent(
      sheet.proficiencies.listing.armor.map((r) => r.value).join(', '),
    )
    expect(screen.getByText('Languages').nextElementSibling).toHaveTextContent('None')
    expect(
      screen.queryByRole('button', { name: /^Languages: where each one comes from/ }),
    ).not.toBeInTheDocument()
    expect(armor).toHaveAttribute('aria-pressed', 'false')
    await user.click(armor)
    const dialog = await screen.findByRole('dialog')
    expect(armor).toHaveAttribute('aria-pressed', 'true')
    const table = within(dialog).getByRole('table', { name: 'Armor' })
    expect(within(table).getByText('Heavy armor')).toBeInTheDocument()
    expect(within(table).getAllByText('Fighter').length).toBeGreaterThan(0)
    await user.click(within(dialog).getByRole('button', { name: 'Back' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(armor).toHaveFocus()
  })
})
