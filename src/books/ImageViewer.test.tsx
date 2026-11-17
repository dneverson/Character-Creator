import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ImageEntry } from '../text/entryContext'
import { ImageViewer } from './ImageViewer'

const map: ImageEntry = {
  type: 'image',
  href: { type: 'internal', path: 'book/TST/one.webp' },
  title: 'Map one',
  credit: 'An Artist',
  width: 800,
  height: 400,
  grid: { type: 'square', size: 40, distance: 5, units: 'ft' },
}
const second: ImageEntry = {
  type: 'image',
  href: { type: 'internal', path: 'book/TST/two.webp' },
  title: 'Map two',
  grid: { type: 'hex', distance: 6, units: 'mi' },
}

const grids = () => document.querySelectorAll('.book-viewer-grid').length

describe('ImageViewer', () => {
  it('shows the title, the credit and the grid it knows', () => {
    render(<ImageViewer images={[map]} start={0} onClose={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Map one' })).toBeInTheDocument()
    expect(screen.getByText(/Square grid: each square is 5 ft/)).toHaveTextContent(
      'Art: An Artist',
    )
    expect(screen.queryByRole('button', { name: 'Previous picture' })).toBeNull()
  })

  it('zooms by steps and stops at the ends', () => {
    render(<ImageViewer images={[map]} start={0} onClose={() => {}} />)
    const out = screen.getByRole('button', { name: 'Zoom out' })
    const zoomIn = screen.getByRole('button', { name: 'Zoom in' })
    expect(out).toBeDisabled()
    fireEvent.click(zoomIn)
    expect(screen.getByText('150%')).toBeInTheDocument()
    for (let i = 0; i < 5; i++) fireEvent.click(zoomIn)
    expect(screen.getByText('600%')).toBeInTheDocument()
    expect(zoomIn).toBeDisabled()
    fireEvent.click(out)
    expect(screen.getByText('400%')).toBeInTheDocument()
  })

  it('shows and hides the square grid', () => {
    render(<ImageViewer images={[map]} start={0} onClose={() => {}} />)
    expect(grids()).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Show grid' }))
    expect(grids()).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Hide grid' }))
    expect(grids()).toBe(0)
  })

  describe('a hex grid', () => {
    const hexMap = (type: string, size = 100): ImageEntry => ({
      ...map,
      grid: { type, size, offsetX: 10, offsetY: 20, distance: 6, units: 'mi' },
    })
    const pattern = () => document.querySelector('pattern')

    it('is drawn when the data gives the size of a hex', () => {
      render(<ImageViewer images={[hexMap('hexColsOdd')]} start={0} onClose={() => {}} />)
      expect(grids()).toBe(0)
      fireEvent.click(screen.getByRole('button', { name: 'Show grid' }))
      expect(grids()).toBe(1)
      expect(document.querySelector('svg.book-viewer-grid')).toHaveAttribute(
        'viewBox',
        '0 0 800 400',
      )
      fireEvent.click(screen.getByRole('button', { name: 'Hide grid' }))
      expect(grids()).toBe(0)
    })

    it('has columns three sides wide when the hexes stand on a side', () => {
      render(<ImageViewer images={[hexMap('hexColsOdd')]} start={0} onClose={() => {}} />)
      fireEvent.click(screen.getByRole('button', { name: 'Show grid' }))
      const side = 100 / Math.sqrt(3)
      expect(Number(pattern()?.getAttribute('width'))).toBeCloseTo(side * 3)
      expect(pattern()?.getAttribute('height')).toBe('100')
      expect(pattern()).toHaveAttribute('patternTransform', 'translate(10 20)')
    })

    it('has rows three sides tall when the hexes stand on a corner', () => {
      render(<ImageViewer images={[hexMap('hexRowsOdd')]} start={0} onClose={() => {}} />)
      fireEvent.click(screen.getByRole('button', { name: 'Show grid' }))
      expect(pattern()?.getAttribute('width')).toBe('100')
      expect(Number(pattern()?.getAttribute('height'))).toBeCloseTo(
        (100 / Math.sqrt(3)) * 3,
      )
    })

    it('moves the first column down half a hex for an even grid', () => {
      render(
        <ImageViewer images={[hexMap('hexColsEven')]} start={0} onClose={() => {}} />,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Show grid' }))
      expect(pattern()).toHaveAttribute('patternTransform', 'translate(10 70)')
    })

    it('moves the first row along half a hex for an even grid of rows', () => {
      render(
        <ImageViewer images={[hexMap('hexRowsEven')]} start={0} onClose={() => {}} />,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Show grid' }))
      expect(pattern()).toHaveAttribute('patternTransform', 'translate(60 20)')
    })

    it('is not offered without a hex size', () => {
      render(<ImageViewer images={[second]} start={0} onClose={() => {}} />)
      expect(screen.queryByRole('button', { name: 'Show grid' })).toBeNull()
    })
  })

  it('steps through a gallery with the buttons and the arrow keys', () => {
    render(<ImageViewer images={[map, second]} start={0} onClose={() => {}} />)
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous picture' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Next picture' }))
    expect(screen.getByRole('heading', { name: 'Map two' })).toBeInTheDocument()
    expect(screen.getByText(/Hex grid: each hex is 6 mi/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show grid' })).toBeNull()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowLeft' })
    expect(screen.getByRole('heading', { name: 'Map one' })).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' })
    expect(screen.getByText('2 of 2')).toBeInTheDocument()
  })

  it('closes with the close button and with Escape', () => {
    const onClose = vi.fn()
    render(<ImageViewer images={[map]} start={0} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', keyCode: 27 })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('says so when the picture has no file', () => {
    render(
      <ImageViewer
        images={[{ type: 'image', title: 'None' }]}
        start={0}
        onClose={() => {}}
      />,
    )
    expect(screen.getByText('This picture could not be loaded.')).toBeInTheDocument()
  })
})
