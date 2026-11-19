import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK, DICE_PRESETS } from '../config/diceLooks'
import { appConfig } from '../config/app'
import { contrastRatio, isHexColor, parseLook, readableLook, shade } from './look'

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for a color on itself', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5)
  })
})

describe('the presets', () => {
  it('are ten, each with a number that can be read on its body', () => {
    expect(DICE_PRESETS).toHaveLength(10)
    for (const preset of DICE_PRESETS) {
      expect(readableLook(preset.look).adjusted).toBe(false)
      expect(contrastRatio(preset.look.number, preset.look.body)).toBeGreaterThanOrEqual(
        appConfig.dice.minNumberContrast,
      )
    }
  })
})

describe('readableLook', () => {
  it('keeps a number that can be read', () => {
    expect(readableLook(DEFAULT_LOOK)).toEqual({ look: DEFAULT_LOOK, adjusted: false })
  })

  it('falls back to black on a light body and white on a dark body', () => {
    const light = readableLook({ ...DEFAULT_LOOK, body: '#f0f0f0', number: '#eeeeee' })
    expect(light.adjusted).toBe(true)
    expect(light.look.number).toBe('#000000')
    const dark = readableLook({ ...DEFAULT_LOOK, body: '#101010', number: '#111111' })
    expect(dark.look.number).toBe('#ffffff')
  })
})

describe('parseLook', () => {
  it('reads what was saved', () => {
    expect(parseLook(JSON.stringify(DEFAULT_LOOK))).toEqual(DEFAULT_LOOK)
  })

  it('refuses what is not a look', () => {
    expect(parseLook(null)).toBeNull()
    expect(parseLook('not json')).toBeNull()
    expect(parseLook('7')).toBeNull()
    expect(parseLook(JSON.stringify({ ...DEFAULT_LOOK, body: 'red' }))).toBeNull()
    expect(parseLook(JSON.stringify({ ...DEFAULT_LOOK, finish: 'shiny' }))).toBeNull()
    expect(parseLook(JSON.stringify({ ...DEFAULT_LOOK, glow: 'yes' }))).toBeNull()
  })
})

describe('colors', () => {
  it('knows a hex color', () => {
    expect(isHexColor('#a1B2c3')).toBe(true)
    expect(isHexColor('#abc')).toBe(false)
    expect(isHexColor(3)).toBe(false)
  })

  it('shades toward white and toward black', () => {
    expect(shade('#000000', 1)).toBe('#ffffff')
    expect(shade('#ffffff', -1)).toBe('#000000')
    expect(shade('#808080', 0)).toBe('#808080')
  })
})
