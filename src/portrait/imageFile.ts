// Reads a picture in the browser and draws the part the user chose. This module is not
// unit tested: jsdom has neither `createImageBitmap` nor a working canvas. It stays thin
// (the sums are in crop.ts) and is exercised in a real browser.

import { PORTRAIT_FORMATS, PORTRAIT_QUALITY, PORTRAIT_SIZE } from '../character/portrait'
import type { SourceRect } from './crop'

/** A decoded picture: its size, and drawing a part of it. */
export interface PortraitImage {
  readonly width: number
  readonly height: number
  /** Draws the rectangle of the picture, scaled to fill the canvas. */
  paint(canvas: HTMLCanvasElement, rect: SourceRect): void
  /** The rectangle as the stored portrait: a square data URL in the first format the browser encodes. */
  encode(rect: SourceRect): string
  close(): void
}

function paintInto(bitmap: ImageBitmap, canvas: HTMLCanvasElement, rect: SourceRect) {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas drawing is not available')
  context.imageSmoothingQuality = 'high'
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.drawImage(
    bitmap,
    rect.x,
    rect.y,
    rect.side,
    rect.side,
    0,
    0,
    canvas.width,
    canvas.height,
  )
}

function wrap(bitmap: ImageBitmap): PortraitImage {
  return {
    width: bitmap.width,
    height: bitmap.height,
    paint: (canvas, rect) => paintInto(bitmap, canvas, rect),
    encode(rect) {
      const canvas = document.createElement('canvas')
      canvas.width = PORTRAIT_SIZE
      canvas.height = PORTRAIT_SIZE
      paintInto(bitmap, canvas, rect)
      for (const format of PORTRAIT_FORMATS) {
        const url = canvas.toDataURL(format, PORTRAIT_QUALITY)
        // A browser that cannot encode a format answers with PNG.
        if (url.startsWith(`data:${format};`)) return url
      }
      throw new Error('The portrait could not be encoded')
    },
    close: () => bitmap.close(),
  }
}

/** Decodes a picture file (the first frame of a GIF); rejects when it is not one. */
export async function decodeImage(file: Blob): Promise<PortraitImage> {
  return wrap(await createImageBitmap(file))
}

/** Decodes a picture that is already a data URL (the stored portrait). */
export async function decodeImageUrl(url: string): Promise<PortraitImage> {
  const image = new Image()
  image.src = url
  await image.decode()
  return wrap(await createImageBitmap(image))
}
