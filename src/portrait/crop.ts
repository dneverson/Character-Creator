// Where the portrait frame sits on the picture. The frame is a square; the picture is
// shown so that it always covers it, so a crop is the point of the picture at the middle
// of the frame and how far in it is zoomed. All of it is worked out here, in the
// picture's own pixels, and nothing here touches the page.

export interface ImageSize {
  width: number
  height: number
}

/** The centre of the frame in picture pixels, and the zoom (1 shows as much as fits). */
export interface Crop {
  zoom: number
  cx: number
  cy: number
}

/** The square of the picture inside the frame, in picture pixels. */
export interface SourceRect {
  x: number
  y: number
  side: number
}

/** The furthest the picture can be zoomed in. */
export const MAX_ZOOM = 4

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value))

/** The side of the square the frame shows at this zoom. */
const sideAt = (image: ImageSize, zoom: number) =>
  Math.min(image.width, image.height) / zoom

/** The crop with its zoom in range and the frame kept inside the picture. */
export function clampCrop(image: ImageSize, crop: Crop): Crop {
  const zoom = clamp(crop.zoom, 1, MAX_ZOOM)
  const half = sideAt(image, zoom) / 2
  return {
    zoom,
    cx: clamp(crop.cx, half, image.width - half),
    cy: clamp(crop.cy, half, image.height - half),
  }
}

/** The first crop: the middle of the picture, as much as fits. */
export function initialCrop(image: ImageSize): Crop {
  return clampCrop(image, { zoom: 1, cx: image.width / 2, cy: image.height / 2 })
}

/** The part of the picture the frame shows. */
export function sourceRect(image: ImageSize, crop: Crop): SourceRect {
  const { zoom, cx, cy } = clampCrop(image, crop)
  const side = sideAt(image, zoom)
  return { x: cx - side / 2, y: cy - side / 2, side }
}

/**
 * The crop after the picture is moved by (dx, dy) screen pixels in a frame that is
 * `frame` pixels wide: the picture follows the pointer, so the frame goes the other way.
 */
export function panCrop(
  image: ImageSize,
  crop: Crop,
  dx: number,
  dy: number,
  frame: number,
): Crop {
  const perPixel = sideAt(image, clamp(crop.zoom, 1, MAX_ZOOM)) / frame
  return clampCrop(image, {
    zoom: crop.zoom,
    cx: crop.cx - dx * perPixel,
    cy: crop.cy - dy * perPixel,
  })
}

/** The crop at another zoom, around the same centre. */
export function zoomCrop(image: ImageSize, crop: Crop, zoom: number): Crop {
  return clampCrop(image, { ...crop, zoom })
}
