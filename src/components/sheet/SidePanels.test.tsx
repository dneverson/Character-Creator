import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  DefensesPanel,
  ProficienciesPanel,
  SavesPanel,
  SensesPanel,
  SkillsPanel,
} from './SidePanels'
import { SheetDetailProvider } from './SheetDetail'
import { deriveSheet } from '../../derived'
import { quantity } from '../../derived/types'
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

  it('shows a sense given only under a condition with the condition and its range', () => {
    const sheet = sheetOf()
    const darkvision = {
      key: 'darkvision',
      label: 'Darkvision',
      range: { value: 0, lines: [] },
      conditional: { when: 'While in dim light or darkness', range: 60 },
    }
    render(<SensesPanel sheet={{ ...sheet, senses: [darkvision] }} />)
    const row = within(screen.getByRole('list', { name: 'Senses' }))
      .getByText('Darkvision')
      .closest('li') as HTMLElement
    expect(within(row).getByText('While in dim light or darkness')).toBeInTheDocument()
    expect(row).toHaveTextContent('60 ft., conditional')
  })

  it('lists the defenses, a conditional one with its reason, and opens its sources', async () => {
    const user = userEvent.setup()
    const sheet = sheetOf()
    const source = { kind: 'race' as const, tag: 'race', label: 'Tiefling' }
    const held = quantity([
      {
        id: 'defense|resist|fire|0',
        label: 'Tiefling',
        source,
        op: 'base',
        amount: 1,
        status: 'applied',
        text: 'Resistance to fire damage',
      },
    ])
    const none = quantity([
      {
        id: 'defense|resist|slashing|0',
        label: 'Rage',
        source,
        op: 'note',
        status: 'conditional',
        when: 'Only while your Rage is active.',
        text: 'Resistance to slashing damage',
      },
    ])
    const defenses = [
      { key: 'resist|fire', kind: 'resist' as const, label: 'Fire', held },
      {
        key: 'resist|slashing',
        kind: 'resist' as const,
        label: 'Slashing',
        held: none,
        conditional: 'Only while your Rage is active.',
      },
    ]
    render(
      <SheetDetailProvider>
        <DefensesPanel sheet={{ ...sheet, defenses }} />
      </SheetDetailProvider>,
    )
    const list = screen.getByRole('list', { name: 'Defenses' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    const slashing = within(list).getByText('Slashing').closest('li') as HTMLElement
    expect(slashing).toHaveTextContent('Conditional: Only while your Rage is active.')
    expect(slashing).toHaveTextContent('Resistance')
    await user.click(within(list).getAllByRole('button', { name: /Fire resistance/ })[0])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Fire: resistance')).toBeInTheDocument()
    expect(within(dialog).getAllByText(/Tiefling/).length).toBeGreaterThan(0)
  })

  it('shows no defenses block when there are none', () => {
    const { container } = render(<DefensesPanel sheet={sheetOf()} />)
    expect(container).toBeEmptyDOMElement()
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
