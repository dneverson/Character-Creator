import { describe, expect, it } from 'vitest'
import { MAX_ZOOM, clampCrop, initialCrop, panCrop, sourceRect, zoomCrop } from './crop'

const WIDE = { width: 1600, height: 600 }
const TALL = { width: 600, height: 1600 }

describe('initialCrop and sourceRect', () => {
  it('starts on the middle of a wide picture, showing the full height', () => {
    expect(initialCrop(WIDE)).toEqual({ zoom: 1, cx: 800, cy: 300 })
    expect(sourceRect(WIDE, initialCrop(WIDE))).toEqual({ x: 500, y: 0, side: 600 })
  })

  it('starts on the middle of a tall picture, showing the full width', () => {
    expect(sourceRect(TALL, initialCrop(TALL))).toEqual({ x: 0, y: 500, side: 600 })
  })

  it('shows a smaller square as the zoom grows', () => {
    const rect = sourceRect(WIDE, { zoom: 2, cx: 800, cy: 300 })
    expect(rect).toEqual({ x: 650, y: 150, side: 300 })
  })
})

describe('clampCrop', () => {
  it('keeps the zoom between 1 and the most', () => {
    expect(clampCrop(WIDE, { zoom: 0.2, cx: 800, cy: 300 }).zoom).toBe(1)
    expect(clampCrop(WIDE, { zoom: 99, cx: 800, cy: 300 }).zoom).toBe(MAX_ZOOM)
  })

  it('never lets the frame leave the picture', () => {
    expect(clampCrop(WIDE, { zoom: 1, cx: -50, cy: -50 })).toEqual({
      zoom: 1,
      cx: 300,
      cy: 300,
    })
    expect(clampCrop(WIDE, { zoom: 1, cx: 5000, cy: 5000 })).toEqual({
      zoom: 1,
      cx: 1300,
      cy: 300,
    })
    const zoomed = clampCrop(WIDE, { zoom: 4, cx: 0, cy: 0 })
    expect(sourceRect(WIDE, zoomed)).toEqual({ x: 0, y: 0, side: 150 })
  })
})

describe('panCrop', () => {
  it('moves the frame the opposite way to the picture, in picture pixels', () => {
    // 256 px frame over 600 source pixels: one screen pixel is 600/256 source pixels.
    const moved = panCrop(WIDE, initialCrop(WIDE), -64, 0, 256)
    expect(moved.cx).toBeCloseTo(800 + 64 * (600 / 256))
    expect(moved.cy).toBe(300)
  })

  it('stops at the edge of the picture and cannot move across a covered axis', () => {
    const far = panCrop(WIDE, initialCrop(WIDE), -100000, -100000, 256)
    expect(sourceRect(WIDE, far)).toEqual({ x: 1000, y: 0, side: 600 })
  })

  it('moves more picture per pixel when zoomed out than in', () => {
    const out = panCrop(WIDE, { zoom: 1, cx: 800, cy: 300 }, 10, 0, 256)
    const inn = panCrop(WIDE, { zoom: 4, cx: 800, cy: 300 }, 10, 0, 256)
    expect(800 - out.cx).toBeGreaterThan(800 - inn.cx)
  })
})

describe('zoomCrop', () => {
  it('zooms around the same centre and pulls the frame back inside the picture', () => {
    const edge = { zoom: 4, cx: 75, cy: 75 }
    expect(zoomCrop(WIDE, edge, 1)).toEqual({ zoom: 1, cx: 300, cy: 300 })
    expect(zoomCrop(WIDE, initialCrop(WIDE), 2)).toEqual({ zoom: 2, cx: 800, cy: 300 })
  })
})
