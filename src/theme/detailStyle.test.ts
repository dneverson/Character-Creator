import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DETAIL_PALETTE, isDetailStyle } from './detailStyle'

/** WCAG relative luminance and contrast ratio of two #rrggbb colours. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('detail pane colours', () => {
  it('measures contrast the way WCAG does', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contrast('#777777', '#777777')).toBe(1)
  })

  it.each([
    ['book, light', DETAIL_PALETTE.light.book],
    ['book, dark', DETAIL_PALETTE.dark.book],
    ['parchment, light', DETAIL_PALETTE.light.parchment],
    ['parchment, dark', DETAIL_PALETTE.dark.parchment],
  ])('keeps the body text of %s at 4.5:1 or better', (_name, pair) => {
    expect(contrast(pair.ink, pair.ground)).toBeGreaterThanOrEqual(4.5)
  })

  it.each([
    ['book, light', DETAIL_PALETTE.light.title, DETAIL_PALETTE.light.book.ground],
    ['book, dark', DETAIL_PALETTE.dark.title, DETAIL_PALETTE.dark.book.ground],
    [
      'parchment, light',
      DETAIL_PALETTE.light.title,
      DETAIL_PALETTE.light.parchment.ground,
    ],
    ['parchment, dark', DETAIL_PALETTE.dark.title, DETAIL_PALETTE.dark.parchment.ground],
  ])('keeps the title of %s at 4.5:1 or better', (_name, title, ground) => {
    expect(contrast(title, ground)).toBeGreaterThanOrEqual(4.5)
  })

  it('is the palette the stylesheet draws', () => {
    const css = readFileSync('src/index.css', 'utf8').toLowerCase()
    for (const hex of [
      DETAIL_PALETTE.light.title,
      DETAIL_PALETTE.dark.title,
      DETAIL_PALETTE.light.parchment.ground,
      DETAIL_PALETTE.light.parchment.ink,
      DETAIL_PALETTE.light.parchment.border,
      DETAIL_PALETTE.dark.parchment.ground,
      DETAIL_PALETTE.dark.parchment.ink,
      DETAIL_PALETTE.dark.parchment.border,
    ]) {
      expect(css).toContain(hex)
    }
  })

  it('knows its three styles', () => {
    expect(['standard', 'book', 'parchment'].every(isDetailStyle)).toBe(true)
    expect(isDetailStyle('scroll')).toBe(false)
    expect(isDetailStyle(null)).toBe(false)
  })
})
