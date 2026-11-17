// A picture of a book shown large, over the reader: Escape or the close button shuts it
// and the focus goes back to the picture it was opened from. Plus and minus zoom (the
// picture then scrolls), the arrows step through the pictures of a gallery, and a map
// with a square or a hex grid can show the grid over it. Nothing here knows what a book is.

import { useEffect, useState } from 'react'
import Button from 'react-bootstrap/Button'
import Modal from 'react-bootstrap/Modal'
import { Icon } from '../components/Icon'
import type { ImageEntry } from '../text/entryContext'
import { TaggedText } from '../text/TaggedText'
import { stripTags } from '../text/tags'
import { labelOf, pathOf, useImageSource } from './imageSource'

/** The zoom steps, each a multiple of the width that fits the window. */
const ZOOMS = [1, 1.5, 2, 3, 4, 6]

/** What a cell of the grid stands for, as the data gives it. */
function gridNote(image: ImageEntry): string | null {
  const grid = image.grid
  if (!grid || (grid.type !== 'square' && !grid.type?.startsWith('hex'))) return null
  const kind = grid.type === 'square' ? 'Square' : 'Hex'
  const each = grid.type === 'square' ? 'square' : 'hex'
  return `${kind} grid: each ${each} is ${grid.distance ?? 5} ${grid.units ?? 'ft'}.`
}

/** The lines of a square grid, drawn in units of the picture's width so they zoom with it. */
function gridStyle(image: ImageEntry) {
  const grid = image.grid
  if (grid?.type !== 'square' || !grid.size || !image.width) return undefined
  const cell = (grid.size / image.width) * 100
  const at = (offset = 0) =>
    `${((((offset % grid.size!) + grid.size!) % grid.size!) / image.width!) * 100}cqw`
  return {
    backgroundSize: `${cell}cqw ${cell}cqw`,
    backgroundPosition: `${at(grid.offsetX)} ${at(grid.offsetY)}`,
  }
}

/** Whether the data gives enough to draw a hex grid: its kind, a cell size, the picture's size. */
function hexOf(image: ImageEntry) {
  const grid = image.grid
  const flat = grid?.type === 'hexColsOdd' || grid?.type === 'hexColsEven'
  const pointy = grid?.type === 'hexRowsOdd' || grid?.type === 'hexRowsEven'
  if (!grid?.size || !image.width || !image.height || !(flat || pointy)) return undefined
  return { grid, size: grid.size, width: image.width, height: image.height, flat }
}

/**
 * The lines of a hex grid over a picture, drawn in the picture's own pixels. `size` is the
 * distance between two opposite sides of a hex. The first column (or row) starts at the
 * offset, and "odd" means the odd ones sit half a hex further along.
 */
function HexGrid({ hex }: { hex: NonNullable<ReturnType<typeof hexOf>> }) {
  const { grid, size, width, height, flat } = hex
  const side = size / Math.sqrt(3)
  const half = size / 2
  const corners = [
    [0, half],
    [side / 2, 0],
    [side * 1.5, 0],
    [side * 2, half],
    [side * 1.5, size],
    [side / 2, size],
  ]
  // One hex and the edge that joins it to the next column, repeating every three sides.
  const points = (flat ? corners : corners.map(([x, y]) => [y, x]))
    .map(([x, y]) => `${x},${y}`)
    .join(' ')
  const link = flat
    ? `M${side * 2},${half}H${side * 3}`
    : `M${half},${side * 2}V${side * 3}`
  const shifted = grid.type?.endsWith('Even') ?? false
  const along = shifted ? half : 0
  const x = (grid.offsetX ?? 0) + (flat ? 0 : along)
  const y = (grid.offsetY ?? 0) + (flat ? along : 0)
  return (
    <svg
      className="book-viewer-grid is-hex"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="book-hex"
          width={flat ? side * 3 : size}
          height={flat ? size : side * 3}
          patternUnits="userSpaceOnUse"
          patternTransform={`translate(${x} ${y})`}
          strokeWidth={Math.max(1, width / 700)}
        >
          <polygon points={points} />
          <path d={link} />
        </pattern>
      </defs>
      <rect width={width} height={height} fill="url(#book-hex)" />
    </svg>
  )
}

function Picture({
  image,
  zoom,
  grid,
}: {
  image: ImageEntry
  zoom: number
  grid: boolean
}) {
  const source = useImageSource(pathOf(image))
  const style = gridStyle(image)
  const hex = hexOf(image)
  // One step fits the window whole; each step after is a multiple of that.
  const fit =
    image.width && image.height
      ? `min(100%, calc((100dvh - 9rem) * ${image.width / image.height}))`
      : '100%'
  const width = zoom > 1 ? `calc(${fit} * ${zoom})` : fit
  if (!source.src)
    return <p className="book-figure-missing">This picture could not be loaded.</p>
  return (
    <div className="book-viewer-sheet" style={{ width }}>
      <img
        key={source.attempt}
        src={source.src}
        alt={image.altText ?? stripTags(labelOf(image) ?? 'Illustration')}
        onError={source.onError}
      />
      {grid && style && (
        <div className="book-viewer-grid" style={style} aria-hidden="true" />
      )}
      {grid && hex && <HexGrid hex={hex} />}
    </div>
  )
}

export function ImageViewer({
  images,
  start,
  onClose,
}: {
  images: ImageEntry[]
  start: number
  onClose: () => void
}) {
  const [index, setIndex] = useState(start)
  const [step, setStep] = useState(0)
  const [grid, setGrid] = useState(false)
  const image = images[index]
  const title = labelOf(image)
  const note = gridNote(image)
  const gridable = gridStyle(image) !== undefined || hexOf(image) !== undefined
  const go = (to: number) => {
    setIndex(to)
    setStep(0)
    setGrid(false)
  }
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && index > 0) go(index - 1)
      if (event.key === 'ArrowRight' && index < images.length - 1) go(index + 1)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  })

  return (
    <Modal
      show
      fullscreen
      onHide={onClose}
      className="book-viewer"
      aria-label="Picture viewer"
    >
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="book-viewer-title">
          {title ? <TaggedText text={title} /> : 'Illustration'}
        </Modal.Title>
      </Modal.Header>
      <div className="book-viewer-bar" role="toolbar" aria-label="Picture controls">
        {images.length > 1 && (
          <div className="book-viewer-group" role="group" aria-label="Gallery">
            <Button
              variant="secondary"
              size="sm"
              aria-label="Previous picture"
              disabled={index <= 0}
              onClick={() => go(index - 1)}
            >
              <Icon name="back" />
            </Button>
            <span role="status">
              {index + 1} of {images.length}
            </span>
            <Button
              variant="secondary"
              size="sm"
              aria-label="Next picture"
              disabled={index >= images.length - 1}
              onClick={() => go(index + 1)}
            >
              <Icon name="back" className="book-flip" />
            </Button>
          </div>
        )}
        <div className="book-viewer-group" role="group" aria-label="Zoom">
          <Button
            variant="secondary"
            size="sm"
            aria-label="Zoom out"
            disabled={step <= 0}
            onClick={() => setStep(step - 1)}
          >
            <Icon name="minus" />
          </Button>
          <span role="status">{Math.round(ZOOMS[step] * 100)}%</span>
          <Button
            variant="secondary"
            size="sm"
            aria-label="Zoom in"
            disabled={step >= ZOOMS.length - 1}
            onClick={() => setStep(step + 1)}
          >
            <Icon name="add" />
          </Button>
        </div>
        {gridable && (
          <Button
            variant="secondary"
            size="sm"
            aria-pressed={grid}
            onClick={() => setGrid(!grid)}
          >
            {grid ? 'Hide grid' : 'Show grid'}
          </Button>
        )}
        <span className="book-viewer-note">
          {note}
          {image.credit && ` Art: ${image.credit}`}
        </span>
      </div>
      <Modal.Body className="book-viewer-body">
        <Picture image={image} zoom={ZOOMS[step]} grid={grid} />
      </Modal.Body>
    </Modal>
  )
}
