// The "Edit portrait" window: the picture inside the square frame. The user drags it (or
// uses the arrow keys) to choose what shows, and zooms with the slider or the buttons.
// The picture always covers the frame. Saving stores only the square, never the file.

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import Modal from 'react-bootstrap/Modal'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'
import { PORTRAIT_NOT_SAVED, PORTRAIT_SIZE } from '../../character/portrait'
import {
  MAX_ZOOM,
  initialCrop,
  panCrop,
  sourceRect,
  zoomCrop,
  type Crop,
} from '../../portrait/crop'
import type { PortraitImage } from '../../portrait/imageFile'
import { Icon } from '../Icon'

/** Screen pixels the frame is shown at; the stored square is `PORTRAIT_SIZE`. */
const FRAME = PORTRAIT_SIZE
/** How far an arrow key moves the picture, in screen pixels. */
const KEY_STEP = 8
/** How much a zoom button or key changes the zoom. */
const ZOOM_STEP = 0.25

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-KEY_STEP, 0],
  ArrowRight: [KEY_STEP, 0],
  ArrowUp: [0, -KEY_STEP],
  ArrowDown: [0, KEY_STEP],
}

interface Props {
  /** The picture to crop; none until one is chosen. */
  image: PortraitImage | null
  /** What went wrong with the last file or save, in plain words. */
  error: string | null
  /** Whether the character already has a portrait (it can then be removed). */
  hasPortrait: boolean
  onChoose: () => void
  /** The cropped square as a data URL. */
  onSave: (portrait: string) => void
  onRemove: () => void
  onCancel: () => void
}

function ZoomButton({
  label,
  icon,
  onClick,
}: {
  label: string
  icon: 'add' | 'minus'
  onClick: () => void
}) {
  return (
    <OverlayTrigger placement="top" overlay={<Tooltip>{label}</Tooltip>}>
      <Button variant="secondary" size="sm" aria-label={label} onClick={onClick}>
        <Icon name={icon} />
      </Button>
    </OverlayTrigger>
  )
}

/** The frame with the picture in it, and the zoom controls under it. */
function Cropper({
  image,
  crop,
  onCrop,
}: {
  image: PortraitImage
  crop: Crop
  onCrop: (crop: Crop) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const last = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (canvas.current) image.paint(canvas.current, sourceRect(image, crop))
  }, [image, crop])

  const pan = (dx: number, dy: number) => onCrop(panCrop(image, crop, dx, dy, FRAME))
  const zoom = (value: number) => onCrop(zoomCrop(image, crop, value))

  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture?.(event.pointerId)
    last.current = { x: event.clientX, y: event.clientY }
  }
  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const from = last.current
    if (!from) return
    last.current = { x: event.clientX, y: event.clientY }
    pan(event.clientX - from.x, event.clientY - from.y)
  }
  function onKeyDown(event: KeyboardEvent<HTMLCanvasElement>) {
    const arrow = ARROWS[event.key]
    if (arrow) pan(...arrow)
    else if (event.key === '+' || event.key === '=') zoom(crop.zoom + ZOOM_STEP)
    else if (event.key === '-') zoom(crop.zoom - ZOOM_STEP)
    else return
    event.preventDefault()
  }

  return (
    <div className="d-flex flex-column align-items-center gap-2">
      <canvas
        ref={canvas}
        width={FRAME}
        height={FRAME}
        className="portrait-crop border"
        tabIndex={0}
        aria-label="Portrait frame. Drag the picture, or use the arrow keys, to move it. Plus and minus zoom."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (last.current = null)}
        onPointerCancel={() => (last.current = null)}
        onKeyDown={onKeyDown}
      />
      <div className="d-flex align-items-center gap-2 w-100" style={{ maxWidth: FRAME }}>
        <ZoomButton
          label="Zoom out"
          icon="minus"
          onClick={() => zoom(crop.zoom - ZOOM_STEP)}
        />
        <Form.Range
          aria-label="Zoom"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={crop.zoom}
          onChange={(event) => zoom(Number(event.target.value))}
        />
        <ZoomButton
          label="Zoom in"
          icon="add"
          onClick={() => zoom(crop.zoom + ZOOM_STEP)}
        />
      </div>
    </div>
  )
}

export function PortraitEditor({
  image,
  error,
  hasPortrait,
  onChoose,
  onSave,
  onRemove,
  onCancel,
}: Props) {
  // A new picture starts from its middle; the crop belongs to the picture it was made on.
  const [crop, setCrop] = useState<{ image: PortraitImage | null; value: Crop | null }>({
    image: null,
    value: null,
  })
  const [failure, setFailure] = useState<string | null>(null)
  const current =
    image && (crop.image === image && crop.value ? crop.value : initialCrop(image))
  const problem = failure ?? error

  function save() {
    if (!image || !current) return
    try {
      onSave(image.encode(sourceRect(image, current)))
    } catch {
      setFailure(PORTRAIT_NOT_SAVED)
    }
  }

  return (
    <Modal show onHide={onCancel} centered aria-labelledby="portrait-editor-title">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5" id="portrait-editor-title">
          Edit portrait
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="d-flex flex-column gap-3">
        {problem && (
          <Alert variant="warning" className="mb-0 py-2 d-flex gap-2 align-items-center">
            <Icon name="warning" />
            <span>{problem}</span>
          </Alert>
        )}
        {image && current ? (
          <Cropper
            image={image}
            crop={current}
            onCrop={(value) => {
              setFailure(null)
              setCrop({ image, value })
            }}
          />
        ) : (
          <p className="mb-0 text-body-secondary">
            Choose a picture to use as the portrait. You can move and zoom it to fit the
            square.
          </p>
        )}
        <div className="d-flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onChoose}>
            {image ? 'Choose another image' : 'Choose an image'}
          </Button>
          {hasPortrait && (
            <Button variant="danger" onClick={onRemove}>
              Remove portrait
            </Button>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!image} onClick={save}>
          Save
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
