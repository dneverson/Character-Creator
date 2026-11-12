import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PickCard as PickCardModel, PickChip } from '../../character/picks'
import { PickCard } from './PickCard'

const chip = (label: string, state: PickChip['state'], text: string): PickChip => ({
  kind: 'option',
  value: `${label}|PHB`,
  label,
  state,
  detail: {
    facts: [
      { label: 'Source', value: 'PHB' },
      { label: 'In this app', value: `Automatic: ${label}` },
    ],
    entries: [text],
  },
})

const card = (chips: PickChip[], used = 0): PickCardModel => ({
  tag: 'class:Fighter|PHB|FS:F',
  label: 'Class · Fighter fighting style',
  name: 'Fighter',
  kind: 'class',
  noun: 'fighting styles',
  kinds: ['option'],
  count: 1,
  used,
  left: 1 - used,
  over: false,
  picks: chips.filter((c) => c.state === 'picked').map((c) => c.value),
  chips,
})

describe('PickCard with described options', () => {
  it('lists each option with its rules text and picks from the row', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    render(
      <PickCard
        card={card([
          chip('Dueling', 'available', 'A +2 bonus to damage with one weapon.'),
          chip('Archery', 'available', 'A +2 bonus to ranged attack rolls.'),
        ])}
        onPick={onPick}
      />,
    )
    expect(screen.getByText('A +2 bonus to damage with one weapon.')).toBeInTheDocument()
    expect(screen.getByText('A +2 bonus to ranged attack rolls.')).toBeInTheDocument()
    const row = screen.getByText('Dueling').closest('tr') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Choose' }))
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ label: 'Dueling' }))
  })

  it('compares two options side by side', async () => {
    const user = userEvent.setup()
    render(
      <PickCard
        card={card([
          chip('Dueling', 'available', 'Damage text.'),
          chip('Archery', 'available', 'Attack text.'),
        ])}
        onPick={vi.fn()}
      />,
    )
    for (const box of screen.getAllByRole('checkbox').slice(-2)) await user.click(box)
    await user.click(screen.getByRole('button', { name: /^Compare \(2\)/ }))
    expect(await screen.findByText('Compare fighting styles')).toBeInTheDocument()
  })

  it('collapses to the chosen option and shows its details on request', async () => {
    const user = userEvent.setup()
    render(
      <PickCard
        card={card(
          [
            chip('Dueling', 'picked', 'Damage text.'),
            chip('Archery', 'full', 'Attack text.'),
          ],
          1,
        )}
        onPick={vi.fn()}
      />,
    )
    expect(screen.getByText('1 of 1 done')).toBeInTheDocument()
    expect(screen.queryByText('Damage text.')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show details' }))
    expect(screen.getByText('Damage text.')).toBeInTheDocument()
    expect(screen.getByText('In this app: Automatic: Dueling')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Change' }))
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
  })
})
