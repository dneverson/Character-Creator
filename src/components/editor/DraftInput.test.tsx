import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DraftInput } from './DraftInput'

describe('DraftInput', () => {
  it('holds typing locally and commits on blur', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<DraftInput aria-label="Name" value="Ann" onCommit={onCommit} />)
    await user.type(screen.getByLabelText('Name'), 'ie')
    expect(screen.getByLabelText('Name')).toHaveValue('Annie')
    expect(onCommit).not.toHaveBeenCalled()
    await user.tab()
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith('Annie')
  })

  it('commits a single-line input on Enter but not a textarea', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    const onArea = vi.fn()
    render(
      <>
        <DraftInput aria-label="Line" value="" onCommit={onCommit} />
        <DraftInput aria-label="Area" as="textarea" value="" onCommit={onArea} />
      </>,
    )
    await user.type(screen.getByLabelText('Line'), 'x{Enter}')
    expect(onCommit).toHaveBeenCalledWith('x')
    await user.type(screen.getByLabelText('Area'), 'a{Enter}b')
    expect(onArea).not.toHaveBeenCalled()
    await user.tab()
    expect(onArea).toHaveBeenCalledWith('a\nb')
  })

  it('does not commit an unchanged value', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<DraftInput aria-label="Name" value="Ann" onCommit={onCommit} />)
    await user.click(screen.getByLabelText('Name'))
    await user.tab()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('resyncs when the stored value changes from outside', async () => {
    const user = userEvent.setup()
    function Host() {
      const [value, setValue] = useState('one')
      return (
        <>
          <DraftInput aria-label="Name" value={value} onCommit={setValue} />
          <button onClick={() => setValue('rolled')}>Outside</button>
        </>
      )
    }
    render(<Host />)
    await user.type(screen.getByLabelText('Name'), 'xyz')
    await user.click(screen.getByRole('button', { name: 'Outside' }))
    expect(screen.getByLabelText('Name')).toHaveValue('rolled')
  })

  it('shows the stored value after a commit the store normalised', async () => {
    const user = userEvent.setup()
    render(<DraftInput aria-label="Coins" value="0" onCommit={() => undefined} />)
    await user.type(screen.getByLabelText('Coins'), '5')
    await user.tab()
    expect(screen.getByLabelText('Coins')).toHaveValue('0')
  })

  it('commits what was typed when it unmounts', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    const { unmount } = render(
      <DraftInput aria-label="Name" value="Ann" onCommit={onCommit} />,
    )
    await user.type(screen.getByLabelText('Name'), '!')
    unmount()
    expect(onCommit).toHaveBeenCalledWith('Ann!')
  })
})

describe('DraftInput number steppers', () => {
  it('commits a step change at once but waits on typed digits', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<DraftInput aria-label="Bonus" type="number" value="1" onCommit={onCommit} />)
    const input = screen.getByLabelText('Bonus')
    await user.type(input, '5')
    expect(onCommit).not.toHaveBeenCalled()
    await user.tab()
    expect(onCommit).toHaveBeenCalledWith('15')
    onCommit.mockClear()
    // A stepper click fires a plain input event with no typing inputType.
    fireEvent.input(input, { target: { value: '16' } })
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith('16')
    fireEvent.input(input, {
      target: { value: '17' },
      inputType: 'insertReplacementText',
    })
    expect(onCommit).toHaveBeenLastCalledWith('17')
    fireEvent.input(input, { target: { value: '170' }, inputType: 'insertText' })
    expect(onCommit).toHaveBeenCalledTimes(2)
  })

  it('does not step-commit a text input', () => {
    const onCommit = vi.fn()
    render(<DraftInput aria-label="Name" value="a" onCommit={onCommit} />)
    fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'b' } })
    expect(onCommit).not.toHaveBeenCalled()
  })
})
