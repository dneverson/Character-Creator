import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AbilityOptionPicker } from './AbilityOptionPicker'
import {
  describeAbilityOption,
  type AbilityIncreases,
  type AbilityOption,
} from '../../data/abilityOptions'

const dwarf: AbilityOption = { fixed: { con: 2, wis: 1 }, amounts: [], from: [] }
const halfElf: AbilityOption = {
  fixed: { cha: 2 },
  amounts: [1, 1],
  from: ['str', 'dex', 'con', 'int', 'wis'],
}
const oneOfTwo: AbilityOption = { fixed: {}, amounts: [2], from: ['str', 'dex'] }
const spread: AbilityOption = {
  fixed: {},
  amounts: [2, 1],
  from: ['str', 'dex', 'con', 'int', 'wis', 'cha'],
}

function renderPicker({
  options,
  optionIndex = 0,
  choices = {},
}: {
  options: AbilityOption[]
  optionIndex?: number
  choices?: AbilityIncreases
}) {
  const onOption = vi.fn()
  const onChoices = vi.fn()
  const view = render(
    <AbilityOptionPicker
      id="test"
      options={options}
      optionIndex={optionIndex}
      choices={choices}
      onOption={onOption}
      onChoices={onChoices}
    />,
  )
  return { ...view, onOption, onChoices }
}

const group = (amount: string) => screen.getByRole('group', { name: `Add ${amount} to` })
const button = (amount: string, name: string) =>
  within(group(amount)).getByRole('button', { name })

describe('AbilityOptionPicker', () => {
  it('draws nothing for a grant with no increases', () => {
    const { container } = renderPicker({ options: [] })
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the increases given outright with the full ability names', () => {
    renderPicker({ options: [dwarf] })
    expect(screen.getByText('Constitution +2')).toBeInTheDocument()
    expect(screen.getByText('Wisdom +1')).toBeInTheDocument()
    // One way to take them: nothing to pick between, nothing to place.
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
  })

  it('offers each way to take the increases when there are several', async () => {
    const user = userEvent.setup()
    const { onOption } = renderPicker({ options: [dwarf, spread], optionIndex: 1 })
    const ways = within(
      screen.getByRole('radiogroup', { name: 'How to take the increases' }),
    ).getAllByRole('radio')
    expect(ways).toHaveLength(2)
    expect(
      screen.getByRole('radio', { name: describeAbilityOption(dwarf) }),
    ).not.toBeChecked()
    expect(
      screen.getByRole('radio', { name: describeAbilityOption(spread) }),
    ).toBeChecked()
    // The option in use is the one shown below.
    expect(screen.queryByText('Constitution +2')).not.toBeInTheDocument()
    expect(group('+2')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: describeAbilityOption(dwarf) }))
    expect(onOption).toHaveBeenCalledWith(0)
  })

  it('falls back to the first way when the one recorded is out of range', () => {
    renderPicker({ options: [dwarf, spread], optionIndex: 5 })
    expect(
      screen.getByRole('radio', { name: describeAbilityOption(dwarf) }),
    ).toBeChecked()
    expect(screen.getByText('Constitution +2')).toBeInTheDocument()
  })

  it('offers one button per ability an increase may go to, per amount', () => {
    renderPicker({ options: [spread], choices: { dex: 2, wis: 1 } })
    for (const amount of ['+2', '+1'])
      expect(within(group(amount)).getAllByRole('button')).toHaveLength(6)
    expect(button('+2', 'Dexterity')).toHaveAttribute('aria-pressed', 'true')
    expect(button('+2', 'Strength')).toHaveAttribute('aria-pressed', 'false')
    expect(button('+1', 'Wisdom')).toHaveAttribute('aria-pressed', 'true')
    expect(button('+1', 'Dexterity')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getAllByText('1 of 1 chosen')).toHaveLength(2)
  })

  it('places an increase on the ability clicked, and takes a placed one back off', async () => {
    const user = userEvent.setup()
    const { onChoices, unmount } = renderPicker({ options: [oneOfTwo] })
    expect(screen.getByText('0 of 1 chosen')).toBeInTheDocument()
    await user.click(button('+2', 'Strength'))
    expect(onChoices).toHaveBeenLastCalledWith({ str: 2 })
    unmount()

    const placed = renderPicker({ options: [oneOfTwo], choices: { str: 2 } })
    await user.click(button('+2', 'Strength'))
    expect(placed.onChoices).toHaveBeenLastCalledWith({})
  })

  it('moves a single increase to another ability', async () => {
    const user = userEvent.setup()
    const { onChoices } = renderPicker({ options: [oneOfTwo], choices: { str: 2 } })
    const dex = button('+2', 'Dexterity')
    expect(dex).toBeEnabled()
    await user.click(dex)
    expect(onChoices).toHaveBeenLastCalledWith({ dex: 2 })
  })

  it('holds the rest back once every one of several increases is placed', async () => {
    const user = userEvent.setup()
    const { onChoices } = renderPicker({
      options: [halfElf],
      choices: { str: 1, con: 1 },
    })
    expect(screen.getByText('Charisma +2')).toBeInTheDocument()
    expect(screen.getByText('2 of 2 chosen')).toBeInTheDocument()
    expect(button('+1', 'Dexterity')).toBeDisabled()
    expect(button('+1', 'Wisdom')).toBeDisabled()
    // A placed one can still come off.
    expect(button('+1', 'Strength')).toBeEnabled()
    await user.click(button('+1', 'Strength'))
    expect(onChoices).toHaveBeenLastCalledWith({ con: 1 })
  })

  it('leaves the rest open while increases are still to be placed', () => {
    renderPicker({ options: [halfElf], choices: { str: 1 } })
    expect(screen.getByText('1 of 2 chosen')).toBeInTheDocument()
    expect(button('+1', 'Dexterity')).toBeEnabled()
  })

  it('ignores placed increases the option does not allow', async () => {
    const user = userEvent.setup()
    // Charisma is not offered, +3 is not an amount it gives, and Strength's +2 is
    // a second +2 where the option gives one.
    const { onChoices } = renderPicker({
      options: [spread],
      choices: { cha: 3, dex: 2, str: 2 },
    })
    expect(button('+2', 'Strength')).toHaveAttribute('aria-pressed', 'true')
    expect(button('+2', 'Dexterity')).toHaveAttribute('aria-pressed', 'false')
    expect(button('+2', 'Charisma')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('0 of 1 chosen')).toBeInTheDocument()

    await user.click(button('+1', 'Wisdom'))
    expect(onChoices).toHaveBeenLastCalledWith({ str: 2, wis: 1 })
  })

  it('shows the restriction the book prints under the buttons', () => {
    renderPicker({ options: [{ ...oneOfTwo, note: 'Not Wisdom' }] })
    expect(screen.getByText('Not Wisdom')).toBeInTheDocument()
  })

  it('shows no note when the option has none', () => {
    renderPicker({ options: [oneOfTwo] })
    expect(screen.queryByText('Not Wisdom')).not.toBeInTheDocument()
  })
})
