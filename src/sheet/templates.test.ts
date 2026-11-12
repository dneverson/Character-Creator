import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SHEET_TEMPLATE,
  SHEET_TEMPLATES,
  isSheetTemplateId,
  sheetTemplate,
  tokensToCssVars,
  type LookTokens,
} from './templates'

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

const THEMES = ['light', 'dark'] as const
const COMBOS = SHEET_TEMPLATES.flatMap((t) =>
  THEMES.map((theme) => [t.id, theme] as const),
)

const COLOURS = [
  'pageBg',
  'panelBg',
  'panelBorder',
  'ink',
  'mutedInk',
  'accent',
  'accentInk',
  'tabActiveBg',
] as const satisfies readonly (keyof LookTokens)[]
const LENGTHS = [
  'panelBorderWidth',
  'panelRadius',
] as const satisfies readonly (keyof LookTokens)[]
const FONTS = [
  'headingFont',
  'bodyFont',
  'numberFont',
] as const satisfies readonly (keyof LookTokens)[]

const tokensOf = (id: string, theme: (typeof THEMES)[number]) =>
  sheetTemplate(id).tokens[theme]

describe('sheet templates', () => {
  it('has unique ids and starts with the app look', () => {
    const ids = SHEET_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(DEFAULT_SHEET_TEMPLATE).toBe('app')
    expect(ids).toContain('parchment')
  })

  it('gives every template a label and a description', () => {
    for (const t of SHEET_TEMPLATES) {
      expect(t.label).not.toBe('')
      expect(t.description).not.toBe('')
    }
  })

  it.each(COMBOS)('has valid colours, lengths and fonts in %s, %s', (id, theme) => {
    const tokens = tokensOf(id, theme)
    for (const name of COLOURS) expect(tokens[name]).toMatch(/^#[0-9a-f]{6}$/i)
    for (const name of LENGTHS) expect(tokens[name]).toMatch(/^\d+(\.\d+)?(px|rem)$/)
    for (const name of FONTS) expect(tokens[name]).not.toBe('')
    expect(tokens.panelShadow).toMatch(/^(none|[\d.]+(px)? [\d.]+(px)? [\d.]+(px)? .+)$/)
  })

  it.each(COMBOS)('keeps text at 4.5:1 or better in %s, %s', (id, theme) => {
    const t = tokensOf(id, theme)
    for (const ground of [t.panelBg, t.pageBg, t.tabActiveBg]) {
      expect(contrast(t.ink, ground)).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrast(t.mutedInk, t.panelBg)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t.mutedInk, t.pageBg)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t.accentInk, t.tabActiveBg)).toBeGreaterThanOrEqual(4.5)
  })

  it('names one variable per token', () => {
    const vars = tokensToCssVars(tokensOf('app', 'light'))
    expect(vars['--sheet-page-bg']).toBe('#ffffff')
    expect(vars['--sheet-panel-border-width']).toBe('1px')
    expect(Object.keys(vars)).toHaveLength(Object.keys(tokensOf('app', 'light')).length)
  })

  it('falls back to the first template for an unknown id', () => {
    expect(sheetTemplate('scroll').id).toBe('app')
    expect(sheetTemplate(null).id).toBe('app')
    expect(isSheetTemplateId('parchment')).toBe(true)
    expect(isSheetTemplateId('scroll')).toBe(false)
    expect(isSheetTemplateId(null)).toBe(false)
  })
})

describe('sheet.css', () => {
  const css = readFileSync('src/sheet/sheet.css', 'utf8')

  it('holds no colour literals', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(css).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/i)
  })

  it('holds no font-family literals', () => {
    const families = [...css.matchAll(/font-family:\s*([^;]+);/g)].map((m) => m[1])
    expect(families.length).toBeGreaterThan(0)
    for (const value of families) expect(value).toMatch(/^var\(--sheet-/)
  })

  it('reads only --sheet-* variables', () => {
    expect(css).not.toMatch(/var\(--bs-/)
    const used = new Set([...css.matchAll(/var\((--[a-z-]+)/g)].map((m) => m[1]))
    const supplied = Object.keys(tokensToCssVars(tokensOf('app', 'light')))
    for (const name of used) {
      if (name.startsWith('--sheet-')) expect(supplied).toContain(name)
      else expect(name).toBe('--app-navbar-height')
    }
  })
})
