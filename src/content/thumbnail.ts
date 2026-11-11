// Shrinks an image to a small thumbnail inside the browser.
//
// This module is not unit tested: jsdom has neither `createImageBitmap` nor a
// working canvas. It is exercised in a real browser by `pnpm verify:content`.

/**
 * Scale an image down to `width` pixels wide (never up), keeping its proportions,
 * and encode it as WebP. A browser that cannot encode WebP answers with PNG.
 */
export async function shrinkImage(image: Blob, width: number): Promise<Blob> {
  const bitmap = await createImageBitmap(image)
  try {
    const scale = Math.min(1, width / bitmap.width)
    const targetWidth = Math.max(1, Math.round(bitmap.width * scale))
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale))

    // Halve repeatedly before the final step: one large reduction skips most of
    // the source pixels and looks jagged in browsers without high-quality scaling.
    let source: ImageBitmap | HTMLCanvasElement = bitmap
    while (source.width / 2 >= targetWidth) {
      source = draw(source, Math.round(source.width / 2), Math.round(source.height / 2))
    }
    const canvas = draw(source, targetWidth, targetHeight)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('The thumbnail could not be encoded'))
        },
        'image/webp',
        0.8,
      )
    })
  } finally {
    bitmap.close()
  }
}

function draw(
  source: ImageBitmap | HTMLCanvasElement,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas drawing is not available')
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, width, height)
  return canvas
}
