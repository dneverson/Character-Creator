import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CodeInput } from './CodeInput'

function setup() {
  const onComplete = vi.fn()
  render(
    <>
      <p id="label">Code</p>
      <CodeInput length={6} labelledBy="label" onComplete={onComplete} />
    </>,
  )
  const box = (n: number) => screen.getByRole('textbox', { name: `Digit ${n} of 6` })
  return { onComplete, box }
}

describe('CodeInput', () => {
  it('is a labelled group of six numeric one-time-code boxes, the first focused', () => {
    const { box } = setup()
    expect(screen.getByRole('group', { name: 'Code' })).toBeInTheDocument()
    expect(screen.getAllByRole('textbox')).toHaveLength(6)
    expect(box(1)).toHaveAttribute('autocomplete', 'one-time-code')
    expect(box(1)).toHaveAttribute('inputmode', 'numeric')
    expect(box(1)).toHaveFocus()
  })

  it('moves on to the next box with each digit and submits after the sixth', async () => {
    const { box, onComplete } = setup()
    await userEvent.keyboard('12345')
    expect(box(6)).toHaveFocus()
    expect(onComplete).not.toHaveBeenCalled()
    await userEvent.keyboard('6')
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith('123456')
  })

  it('ignores anything that is not a digit', async () => {
    const { box } = setup()
    await userEvent.keyboard('a-1')
    expect(box(1)).toHaveValue('1')
    expect(box(2)).toHaveValue('')
    expect(box(2)).toHaveFocus()
  })

  it('goes back on Backspace in an empty box, clearing the one before', async () => {
    const { box } = setup()
    await userEvent.keyboard('12')
    await userEvent.keyboard('{Backspace}')
    expect(box(2)).toHaveFocus()
    expect(box(2)).toHaveValue('')
    expect(box(1)).toHaveValue('1')
  })

  it('clears a filled box on Backspace without leaving it', async () => {
    const { box } = setup()
    await userEvent.type(box(1), '7')
    await userEvent.click(box(1))
    await userEvent.keyboard('{Backspace}')
    expect(box(1)).toHaveValue('')
    expect(box(1)).toHaveFocus()
  })

  it('stays put on Backspace in the first box when it is empty', async () => {
    const { box } = setup()
    await userEvent.keyboard('{Backspace}')
    expect(box(1)).toHaveFocus()
  })

  it('moves between boxes with the arrow keys', async () => {
    const { box } = setup()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    expect(box(3)).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(box(2)).toHaveFocus()
  })

  it('fills every box from a pasted code, whatever box it lands in, and submits', async () => {
    const { box, onComplete } = setup()
    await userEvent.click(box(4))
    await userEvent.paste('123 456')
    for (const n of [1, 2, 3, 4, 5, 6]) expect(box(n)).toHaveValue(String(n))
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith('123456')
  })

  it('puts a short paste in from the box it was pasted in', async () => {
    const { box, onComplete } = setup()
    await userEvent.click(box(2))
    await userEvent.paste('98')
    expect(box(1)).toHaveValue('')
    expect(box(2)).toHaveValue('9')
    expect(box(3)).toHaveValue('8')
    expect(box(4)).toHaveFocus()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('ignores a paste with no digits in it', async () => {
    const { box } = setup()
    await userEvent.paste('abc')
    expect(box(1)).toHaveValue('')
  })

  it('takes a whole code that the keyboard offers into the first box', () => {
    const { box, onComplete } = setup()
    fireEvent.change(box(1), { target: { value: '654321' } })
    expect(onComplete).toHaveBeenCalledWith('654321')
  })

  it('can be locked and marked wrong', () => {
    render(<CodeInput length={6} labelledBy="x" onComplete={() => {}} disabled invalid />)
    expect(screen.getAllByRole('textbox')[0]).toBeDisabled()
    expect(screen.getAllByRole('textbox')[0]).toHaveAttribute('aria-invalid', 'true')
  })
})
