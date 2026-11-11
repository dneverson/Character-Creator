import { describe, expect, it } from 'vitest'
import { titleCase } from './titleCase'

describe('titleCase', () => {
  it('capitalises each word', () => {
    expect(titleCase('deep speech')).toBe('Deep Speech')
  })

  it('keeps minor words lowercase, except in front', () => {
    expect(titleCase('sleight of hand')).toBe('Sleight of Hand')
    expect(titleCase('the common tongue')).toBe('The Common Tongue')
  })

  it('does not break a word at its apostrophe', () => {
    expect(titleCase("thieves' tools")).toBe("Thieves' Tools")
    expect(titleCase("artisan's tools")).toBe("Artisan's Tools")
  })

  it('reaches inside brackets', () => {
    expect(titleCase('vehicles (land)')).toBe('Vehicles (Land)')
  })
})
