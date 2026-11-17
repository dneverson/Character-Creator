import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useShortcut } from './useShortcut'

function Probe({ action }: { action: () => void }) {
  useShortcut('b', action)
  return (
    <>
      <input aria-label="field" />
      <div contentEditable suppressContentEditableWarning aria-label="editable" />
      <button>plain</button>
    </>
  )
}

describe('useShortcut', () => {
  it('runs on the key alone, in either case, anywhere on the page', () => {
    const action = vi.fn()
    render(<Probe action={action} />)
    fireEvent.keyDown(document.body, { key: 'b' })
    fireEvent.keyDown(screen.getByRole('button'), { key: 'B' })
    expect(action).toHaveBeenCalledTimes(2)
  })

  it('leaves other keys and keys held with a modifier alone', () => {
    const action = vi.fn()
    render(<Probe action={action} />)
    fireEvent.keyDown(document.body, { key: 'c' })
    fireEvent.keyDown(document.body, { key: 'b', ctrlKey: true })
    fireEvent.keyDown(document.body, { key: 'b', metaKey: true })
    fireEvent.keyDown(document.body, { key: 'b', altKey: true })
    expect(action).not.toHaveBeenCalled()
  })

  it('is typing when a field has the focus', () => {
    const action = vi.fn()
    render(<Probe action={action} />)
    fireEvent.keyDown(screen.getByLabelText('field'), { key: 'b' })
    fireEvent.keyDown(screen.getByLabelText('editable'), { key: 'b' })
    expect(action).not.toHaveBeenCalled()
  })

  it('stops listening when it goes away', () => {
    const action = vi.fn()
    render(<Probe action={action} />).unmount()
    fireEvent.keyDown(document.body, { key: 'b' })
    expect(action).not.toHaveBeenCalled()
  })
})
