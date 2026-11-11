import { describe, expect, it } from 'vitest'
import { coverPath } from './covers'

describe('coverPath', () => {
  it('is the path of an internal cover', () => {
    expect(coverPath({ type: 'internal', path: 'covers/PHB.webp' })).toBe(
      'covers/PHB.webp',
    )
  })

  it('keeps the path exactly as the book gives it', () => {
    expect(coverPath({ type: 'internal', path: 'covers/MM.WEBP' })).toBe('covers/MM.WEBP')
  })

  it('returns null for a missing cover', () => {
    expect(coverPath(undefined)).toBeNull()
  })

  it('returns null for a non-internal cover type', () => {
    expect(coverPath({ type: 'external', path: 'http://x/y.webp' })).toBeNull()
  })

  it('returns null when the path is empty', () => {
    expect(coverPath({ type: 'internal', path: '' })).toBeNull()
  })
})
