import { describe, expect, it } from 'vitest'
import {
  PORTRAIT_MAX_FILE_BYTES,
  PORTRAIT_MAX_LENGTH,
  PORTRAIT_TOO_BIG,
  isPortrait,
  portraitFileProblem,
} from './portrait'

describe('isPortrait', () => {
  it('accepts a base64 picture data URL of a type a browser shows', () => {
    for (const type of ['webp', 'jpeg', 'png', 'gif', 'avif']) {
      expect(isPortrait(`data:image/${type};base64,QUJD`)).toBe(true)
    }
  })

  it('refuses anything else, whatever its type', () => {
    expect(isPortrait(undefined)).toBe(false)
    expect(isPortrait('data:image/webp;base64,')).toBe(false)
    expect(isPortrait('data:image/webp,QUJD')).toBe(false)
    expect(isPortrait('data:image/svg+xml;base64,QUJD')).toBe(false)
    expect(isPortrait('data:text/plain;base64,QUJD')).toBe(false)
    expect(isPortrait('https://example.com/a.webp')).toBe(false)
    expect(isPortrait('data:image/webp;base64,QU JD')).toBe(false)
  })

  it('refuses a picture longer than the cap', () => {
    const head = 'data:image/webp;base64,'
    expect(isPortrait(head + 'A'.repeat(PORTRAIT_MAX_LENGTH - head.length))).toBe(true)
    expect(isPortrait(head + 'A'.repeat(PORTRAIT_MAX_LENGTH - head.length + 1))).toBe(
      false,
    )
  })
})

describe('portraitFileProblem', () => {
  it('names a file over 20 MB and passes one at the limit', () => {
    expect(portraitFileProblem(PORTRAIT_MAX_FILE_BYTES)).toBeUndefined()
    expect(portraitFileProblem(PORTRAIT_MAX_FILE_BYTES + 1)).toBe(PORTRAIT_TOO_BIG)
  })
})
