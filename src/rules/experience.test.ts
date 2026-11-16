import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  levelForXp,
  MAX_XP_LEVEL,
  XP_FOR_LEVEL,
  xpForLevel,
  xpStanding,
} from './experience'

type Table = {
  caption?: string
  source?: string
  colLabels?: string[]
  rows?: string[][]
}

const tables: Table[] = (
  JSON.parse(readFileSync('public/data/generated/gendata-tables.json', 'utf8')) as {
    table: Table[]
  }
).table

/** The experience points of each level, level 2 up, in the order the book's table gives. */
function bookXp(source: string): number[] {
  const table = tables.find(
    (t) => t.caption === 'Character Advancement' && t.source === source,
  )
  if (!table?.rows || !table.colLabels)
    throw new Error(`no Character Advancement in ${source}`)
  const column = table.colLabels.indexOf('Experience Points')
  const level = table.colLabels.indexOf('Level')
  return table.rows
    .filter((row) => Number(row[level]) >= 2)
    .sort((a, b) => Number(a[level]) - Number(b[level]))
    .map((row) => Number(row[column].replace(/,/g, '')))
}

describe('the experience table', () => {
  it('matches the 2014 Player Handbook table', () => {
    expect(XP_FOR_LEVEL.classic).toEqual(bookXp('PHB'))
  })

  it('matches the 2024 Player Handbook table', () => {
    expect(XP_FOR_LEVEL.one).toEqual(bookXp('XPHB'))
  })

  it('gives the points of each level, none for the first', () => {
    expect(xpForLevel('classic', 1)).toBe(0)
    expect(xpForLevel('classic', 2)).toBe(300)
    expect(xpForLevel('one', 20)).toBe(355000)
    expect(xpForLevel('one', 25)).toBe(355000)
  })

  it('finds the level that points reach', () => {
    expect(levelForXp('classic', 0)).toBe(1)
    expect(levelForXp('classic', 899)).toBe(2)
    expect(levelForXp('one', 900)).toBe(3)
    expect(levelForXp('one', 9_999_999)).toBe(MAX_XP_LEVEL)
  })

  it('says whether a level is waiting against the level the character has', () => {
    expect(xpStanding('classic', 299, 1)).toEqual({ next: 300, ready: false })
    expect(xpStanding('classic', 300, 1)).toEqual({ next: 300, ready: true })
    // A multiclass character counts its total level: 5 levels need 14000 for the next.
    expect(xpStanding('one', 6500, 5)).toEqual({ next: 14000, ready: false })
    expect(xpStanding('one', 400000, 20)).toEqual({ next: null, ready: false })
  })
})
