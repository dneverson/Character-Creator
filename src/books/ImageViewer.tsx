// A picture of a book shown large, over the reader: Escape or the close button shuts it
// and the focus goes back to the picture it was opened from. Plus and minus zoom (the
// picture then scrolls), the arrows step through the pictures of a gallery, and a map
// with a square grid can show the grid over it. Nothing here knows what a book is.

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
  const gridable = gridStyle(image) !== undefined
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
