import { beforeEach, describe, expect, it } from 'vitest'
import { _clearBookSources, lookup, matchAcronym, registerBookSources } from './glossary'

beforeEach(() => {
  _clearBookSources()
})

describe('lookup - fixed vocabulary', () => {
  it('expands a scoped code to its full name and category', () => {
    expect(lookup('STR', 'ability')).toEqual({
      full: 'Strength',
      category: 'Ability Score',
    })
    expect(lookup('gp', 'currency')).toEqual({
      full: 'gold pieces',
      category: 'Currency',
    })
    expect(lookup('LG', 'alignment')).toEqual({
      full: 'Lawful Good',
      category: 'Alignment',
    })
  })

  it('disambiguates a shared code by kind', () => {
    // "M" means different things per family; the kind picks the right one.
    expect(lookup('M', 'size')).toEqual({ full: 'Medium', category: 'Size' })
    expect(lookup('M', 'component')).toEqual({
      full: 'Material',
      category: 'Spell Component',
    })
    expect(lookup('M', 'itemType')).toEqual({
      full: 'Melee Weapon',
      category: 'Item Type',
    })
  })

  it('expands the item types of the vehicles, food, tack and generic variants', () => {
    expect(lookup('AIR', 'itemType')?.full).toBe('Vehicle (Air)')
    expect(lookup('SHP', 'itemType')?.full).toBe('Vehicle (Water)')
    expect(lookup('FD', 'itemType')?.full).toBe('Food and Drink')
    expect(lookup('TAH', 'itemType')?.full).toBe('Tack and Harness')
    expect(lookup('GV', 'itemType')?.full).toBe('Generic Variant')
  })

  it('expands the units of an item (pounds, feet)', () => {
    expect(lookup('lb', 'term')?.full).toBe('pounds')
    expect(lookup('ft', 'term')?.full).toBe('feet')
  })

  it('returns undefined for an unknown code in a known family', () => {
    expect(lookup('ZZ', 'ability')).toBeUndefined()
  })

  it('expands general term acronyms (RPG, DM)', () => {
    expect(lookup('RPG', 'term')).toEqual({
      full: 'Role Playing Game',
      category: 'Term',
    })
    expect(lookup('DM', 'term')).toEqual({
      full: 'Dungeon Master',
      category: 'Term',
    })
  })

  it('matches codes case-sensitively', () => {
    expect(lookup('str', 'ability')).toBeUndefined()
    expect(lookup('GP', 'currency')).toBeUndefined()
  })
})

describe('lookup - unscoped', () => {
  it('resolves a code that is unambiguous across all families', () => {
    expect(lookup('STR')).toEqual({ full: 'Strength', category: 'Ability Score' })
  })

  it('refuses to guess an ambiguous code', () => {
    // "M" is Medium, Material, and Melee Weapon - no single answer.
    expect(lookup('M')).toBeUndefined()
    expect(lookup('S')).toBeUndefined()
  })

  it('returns undefined for a code no family defines', () => {
    expect(lookup('QQQ')).toBeUndefined()
  })
})

describe('lookup - book sources', () => {
  it('resolves a registered book source', () => {
    registerBookSources([{ source: 'PHB', name: "Player's Handbook (2014)" }])
    expect(lookup('PHB', 'source')).toEqual({
      full: "Player's Handbook (2014)",
      category: 'Sourcebook',
    })
  })

  it('has no expansion before books are registered', () => {
    expect(lookup('PHB', 'source')).toBeUndefined()
  })

  it('resolves an unscoped book code when it is otherwise unambiguous', () => {
    registerBookSources([{ source: 'DMG', name: "Dungeon Master's Guide (2014)" }])
    expect(lookup('DMG')).toEqual({
      full: "Dungeon Master's Guide (2014)",
      category: 'Sourcebook',
    })
  })

  it('applies a full-name override for a compound source code', () => {
    // books.json carries only the sub-title; the override supplies the parent.
    registerBookSources([{ source: 'HAT-TG', name: "Thieves' Gallery" }])
    expect(lookup('HAT-TG', 'source')).toEqual({
      full: "Honor Among Thieves - Thieves' Gallery",
      category: 'Sourcebook',
    })
  })

  it('merges repeated registrations rather than replacing them', () => {
    registerBookSources([{ source: 'PHB', name: "Player's Handbook" }])
    registerBookSources([{ source: 'XGE', name: "Xanathar's Guide" }])
    expect(lookup('PHB', 'source')?.full).toBe("Player's Handbook")
    expect(lookup('XGE', 'source')?.full).toBe("Xanathar's Guide")
  })
})

describe('matchAcronym', () => {
  const text = (segs: ReturnType<typeof matchAcronym>) =>
    segs?.map((s) => (s.matched ? `[${s.text}]` : s.text)).join('')

  it('bolds word-initial letters, preferring word starts', () => {
    expect(text(matchAcronym('PHB', "Player's Handbook (2014)"))).toBe(
      "[P]layer's [H]and[B]ook (2014)",
    )
  })

  it('bolds a run of leading letters (STR -> STRength)', () => {
    expect(text(matchAcronym('STR', 'Strength'))).toBe('[S][T][R]ength')
  })

  it('mirrors the acronym letter case onto the matched characters', () => {
    // "b" in Handbook is re-cased to the acronym's upper-case "B".
    const segs = matchAcronym('PHB', 'Player Handbook')
    const bold = segs?.filter((s) => s.matched).map((s) => s.text)
    expect(bold).toEqual(['P', 'H', 'B'])
  })

  it('handles a lower-case acronym across two words (gp -> gold pieces)', () => {
    expect(text(matchAcronym('gp', 'gold pieces'))).toBe('[g]old [p]ieces')
  })

  it('bolds the edition year for the 2024 X prefix (XDMG -> ...(2024))', () => {
    // The leading X has no letter in the name, so it highlights the year it
    // stands for; the digits keep their own text.
    expect(text(matchAcronym('XDMG', "Dungeon Master's Guide (2024)"))).toBe(
      "[D]ungeon [M]aster's [G]uide ([2][0][2][4])",
    )
  })

  it('skips a separator in a compound code (HAT-TG -> two titles)', () => {
    // The "-" is structural: HAT maps to the parent, TG to the sub-title, and
    // the separator itself is never highlighted.
    expect(text(matchAcronym('HAT-TG', "Honor Among Thieves - Thieves' Gallery"))).toBe(
      "[H]onor [A]mong [T]hieves - [T]hieves' [G]allery",
    )
  })

  it('returns null only when nothing lines up at all', () => {
    expect(matchAcronym('XYZ', 'Strength')).toBeNull()
  })
})
