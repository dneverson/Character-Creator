import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BookPageBox } from './BookPageBox'

describe('the page box', () => {
  it('shows the page and the last page, and goes to a page typed over it', () => {
    const onGo = vi.fn()
    render(<BookPageBox page={12} last={223} onGo={onGo} />)
    const box = screen.getByRole('textbox', { name: 'Page' })
    expect(box).toHaveValue('12')
    expect(screen.getByText('of 223')).toBeInTheDocument()
    fireEvent.change(box, { target: { value: '1a05' } })
    expect(box).toHaveValue('105')
    fireEvent.submit(box)
    expect(onGo).toHaveBeenCalledWith(105)
    expect(box).toHaveValue('12')
  })

  it('keeps a page inside the book, ignores an empty box and drops a draft on leaving', () => {
    const onGo = vi.fn()
    render(<BookPageBox page={5} last={20} onGo={onGo} />)
    const box = screen.getByRole('textbox', { name: 'Page' })
    fireEvent.change(box, { target: { value: '999' } })
    fireEvent.submit(box)
    expect(onGo).toHaveBeenLastCalledWith(20)
    fireEvent.change(box, { target: { value: '0' } })
    fireEvent.submit(box)
    expect(onGo).toHaveBeenLastCalledWith(1)
    fireEvent.change(box, { target: { value: '' } })
    fireEvent.submit(box)
    expect(onGo).toHaveBeenCalledTimes(2)
    fireEvent.change(box, { target: { value: '7' } })
    fireEvent.blur(box)
    expect(box).toHaveValue('5')
  })
})
