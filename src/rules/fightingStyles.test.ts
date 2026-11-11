import { describe, expect, it } from 'vitest'
import { dataDir, findIds } from '../test/dataAudit'
import { FIGHTING_STYLES, fightingStyleId } from './fightingStyles'

describe('fighting styles', () => {
  it('has each style once', () => {
    const ids = FIGHTING_STYLES.map(fightingStyleId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe.skipIf(!dataDir)('fighting styles against the data', () => {
  const dir = dataDir ?? ''
  const ids = new Set(FIGHTING_STYLES.map(fightingStyleId))

  const styles = new Set([
    ...findIds(
      dir,
      ['optionalfeature'],
      (_t, r) =>
        Array.isArray(r.featureType) &&
        r.featureType.some((t) => String(t).startsWith('FS')),
    ),
    ...findIds(dir, ['feat'], (_t, r) => String(r.category ?? '').startsWith('FS')),
  ])

  it('covers every fighting style of the books', () => {
    expect([...styles].filter((id) => !ids.has(id))).toEqual([])
  })

  it('has every style of the table present in the data', () => {
    expect([...ids].filter((id) => !styles.has(id))).toEqual([])
  })
})
