// The look of the dice as a value: reading a saved one back, and keeping its number
// readable. The surface of a die (its gradients and patterns) is drawn around the number
// on a plate of the body colour, so the number is measured against the body.

import { appConfig } from '../config/app'
import { FINISHES, type DiceLook } from '../config/diceLooks'

const HEX = /^#[0-9a-f]{6}$/i

/** Whether the text is a colour written `#rrggbb`. */
export const isHexColor = (text: unknown): text is string =>
  typeof text === 'string' && HEX.test(text)

/** The WCAG relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const channel = parseInt(hex.slice(at, at + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** The WCAG contrast ratio of two `#rrggbb` colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

/** A look whose number is readable: the look itself, or the look with its number changed. */
export interface ReadableLook {
  look: DiceLook
  /** The number colour was replaced, because the one picked was too hard to read. */
  adjusted: boolean
}

/**
 * The look with a readable number: black or white when the number picked has less than the
 * least contrast against the body (whichever of the two reads better; one always reaches
 * 4.5 to 1).
 */
export function readableLook(look: DiceLook): ReadableLook {
  if (contrastRatio(look.number, look.body) >= appConfig.dice.minNumberContrast) {
    return { look, adjusted: false }
  }
  const dark = '#000000'
  const light = '#ffffff'
  const number =
    contrastRatio(dark, look.body) >= contrastRatio(light, look.body) ? dark : light
  return { look: { ...look, number }, adjusted: true }
}

/** The look saved as text, read back; null when the text is not a look. */
export function parseLook(text: string | null): DiceLook | null {
  if (text === null) return null
  try {
    const found: unknown = JSON.parse(text)
    if (typeof found !== 'object' || found === null) return null
    const { body, number, edge, finish, glow } = found as Record<string, unknown>
    const known = FINISHES.find((entry) => entry.finish === finish)
    if (
      isHexColor(body) &&
      isHexColor(number) &&
      isHexColor(edge) &&
      known &&
      typeof glow === 'boolean'
    ) {
      return { body, number, edge, finish: known.finish, glow }
    }
  } catch {
    // Not JSON: not a look.
  }
  return null
}

/** `#rrggbb` mixed with white (amount above 0) or black (below 0): "lighter by .3". */
export function shade(hex: string, amount: number): string {
  const target = amount < 0 ? 0 : 255
  const weight = Math.abs(amount)
  const channels = [1, 3, 5].map((at) => {
    const value = parseInt(hex.slice(at, at + 2), 16)
    return Math.round(value + (target - value) * weight)
      .toString(16)
      .padStart(2, '0')
  })
  return `#${channels.join('')}`
}
