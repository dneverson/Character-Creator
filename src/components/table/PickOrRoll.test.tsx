import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DieTable } from '../../data/dieTables'
import { PickOrRoll } from './PickOrRoll'

const traits: DieTable = {
  title: 'Personality Trait',
  label: 'Personality Trait',
  die: 4,
  rows: [
    { min: 1, max: 1, text: 'I am polite.' },
    { min: 2, max: 2, text: 'I am brave.' },
    { min: 3, max: 3, text: 'I am loud.' },
    { min: 4, max: 4, text: 'I am calm.' },
  ],
}

const objects: DieTable = {
  title: 'Object',
  label: 'Object',
  die: 4,
  rows: [
    { min: 1, max: 1, text: 'A deed' },
    { min: 2, max: 3, text: 'A key' },
    { min: 4, max: 4, text: 'A coin' },
  ],
}

/** Each die in turn shows the next of these values. */
function dice(...values: number[]) {
  let at = 0
  vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((array) => {
    // randomInt(1, N) reads one byte and shows 1 + byte % N.
    ;(array as Uint8Array)[0] = values[at++] - 1
    return array
  })
}

afterEach(() => vi.restoreAllMocks())

const onChoose = vi.fn<(rows: number[], roll?: { values: number[] }) => void>()

/** The chooser holding its rows the way a story field would. */
function Harness({
  table = traits,
  count = 2,
  initial = [],
  ownText = false,
}: {
  table?: DieTable
  count?: number
  initial?: number[]
  ownText?: boolean
}) {
  const [chosen, setChosen] = useState(initial)
  return (
    <PickOrRoll
      id="trait"
      table={table}
      count={count}
      chosen={chosen}
      ownText={ownText}
      onChoose={(rows, roll) => {
        onChoose(rows, roll)
        setChosen(rows)
      }}
    />
  )
}

const rowButton = (text: string) => screen.getByRole('button', { name: new RegExp(text) })

describe('PickOrRoll', () => {
  it('takes rows by clicking them, and folds once all are taken', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    expect(screen.getByText('Choose 2 or roll - 0 of 2 chosen')).toBeInTheDocument()
    await user.click(rowButton('I am loud.'))
    expect(onChoose).toHaveBeenLastCalledWith([2], undefined)
    expect(rowButton('I am loud.')).toHaveAttribute('aria-pressed', 'true')

    // A click on a taken row gives it back.
    await user.click(rowButton('I am loud.'))
    expect(onChoose).toHaveBeenLastCalledWith([], undefined)

    await user.click(rowButton('I am brave.'))
    await user.click(rowButton('I am calm.'))
    expect(onChoose).toHaveBeenLastCalledWith([1, 3], undefined)

    // Folded: one line with the count, Reroll and Change - no row text.
    expect(screen.queryByRole('button', { name: /I am polite/ })).not.toBeInTheDocument()
    expect(screen.getByText('2 of 2 from the table')).toBeInTheDocument()
    expect(screen.queryByText('I am brave.')).not.toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()

    // Changing shows which rows are taken, marked as chosen.
    await user.click(screen.getByRole('button', { name: 'Change' }))
    expect(rowButton('I am brave.')).toHaveAttribute('aria-pressed', 'true')
    expect(rowButton('I am calm.')).toHaveAttribute('aria-pressed', 'true')
    expect(rowButton('I am loud.')).toHaveAttribute('aria-pressed', 'false')
  })

  it('rolls every row still free in one click, never one already taken', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[0]} />)

    // The first die lands on the taken row and is rolled again.
    dice(1, 3)
    await user.click(screen.getByRole('button', { name: 'Roll d4' }))
    expect(onChoose).toHaveBeenLastCalledWith([0, 2], { values: [1, 3] })
    expect(screen.getByText('2 of 2 from the table')).toBeInTheDocument()
  })

  it('rerolls every row taken afresh', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[0, 1]} />)

    dice(4, 4, 3)
    await user.click(screen.getByRole('button', { name: 'Reroll' }))
    expect(onChoose).toHaveBeenLastCalledWith([3, 2], { values: [4, 4, 3] })
  })

  it('reopens on Change, closes on Done, and holds back rows once all are taken', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[0, 1]} />)

    await user.click(screen.getByRole('button', { name: 'Change' }))
    expect(rowButton('I am polite.')).toHaveAttribute('aria-pressed', 'true')
    expect(rowButton('I am loud.')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: 'Roll d4' })).toBeDisabled()

    // Give one back, take another: the table closes again.
    await user.click(rowButton('I am polite.'))
    expect(rowButton('I am loud.')).not.toHaveAttribute('aria-disabled')
    await user.click(rowButton('I am loud.'))
    expect(onChoose).toHaveBeenLastCalledWith([1, 2], undefined)
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Change' }))
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument()
  })

  it('moves a single row to the one clicked, and shows a range row as its range', async () => {
    const user = userEvent.setup()
    render(<Harness table={objects} count={1} />)

    expect(screen.getByText('2-3')).toBeInTheDocument()
    await user.click(rowButton('A key'))
    expect(screen.getByText('1 of 1 from the table')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Change' }))
    await user.click(rowButton('A coin'))
    expect(onChoose).toHaveBeenLastCalledWith([2], undefined)
    expect(screen.getByText('1 of 1 from the table')).toBeInTheDocument()
  })

  it('stays folded on the player’s own text, and rolls the whole count from there', async () => {
    const user = userEvent.setup()
    render(<Harness ownText count={1} />)

    expect(screen.getByText('Your own text')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    dice(2)
    await user.click(screen.getByRole('button', { name: 'Reroll' }))
    expect(onChoose).toHaveBeenLastCalledWith([1], { values: [2] })
  })

  it('takes no more rows than the table has, under the heading given', () => {
    render(
      <PickOrRoll
        id="few"
        table={{ ...objects, rows: objects.rows.slice(0, 1), die: 1 }}
        count={2}
        chosen={[0]}
        ownText={false}
        heading="Object - from Soldier"
        onChoose={onChoose}
      />,
    )
    expect(screen.getByText('Object - from Soldier')).toBeInTheDocument()
    expect(screen.getByText('1 of 1 from the table')).toBeInTheDocument()
  })
})
