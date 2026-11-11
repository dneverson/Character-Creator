// A single registry that expands the app's acronyms/codes to their full names,
// so a tooltip can spell out "STR" as "Strength", "PHB" as "Player's Handbook",
// and so on. Two feeders:
//
//   1. Book sources - fully data-driven. `loadBooks()` (data/loaders) calls
//      `registerBookSources` as it loads, so the source -> full-name map always
//      mirrors books.json with zero maintenance. Until books load, a book code
//      simply has no expansion yet (the caller degrades to plain text).
//   2. Fixed rules vocabulary - abilities, stats, currency, alignments, sizes,
//      spell schools/components, item-type codes. These have no upstream data
//      file, so they live here as a maintained table. Editing an entry here
//      updates every tooltip that uses it.
//
// Codes collide across families ("M" is Medium, a Martial weapon, and a Material
// component; "S" is Small, a Shield, and Somatic), so a lookup can be scoped by
// `kind`. An unscoped lookup only resolves a code that is unambiguous across all
// families - it never guesses which family was meant.

/** The acronym families the glossary knows about. */
export type AbbrKind =
  | 'source'
  | 'ability'
  | 'stat'
  | 'currency'
  | 'alignment'
  | 'size'
  | 'school'
  | 'component'
  | 'itemType'
  | 'term'

export interface GlossaryHit {
  /** The expanded full name, e.g. "Strength". */
  full: string
  /** The human label for the code's family, e.g. "Ability Score". */
  category: string
}

interface Family {
  /** The label shown as the tooltip's category prefix. */
  label: string
  /** Exact code -> full name. Codes are matched case-sensitively. */
  terms: Record<string, string>
}

/** The label used for book-source codes (fed dynamically from books.json). */
const SOURCE_LABEL = 'Sourcebook'

// The fixed rules vocabulary. Codes are the exact strings the data files use
// (e.g. sizes are single upper-case letters; currency codes are lower-case).
const FAMILIES: Record<Exclude<AbbrKind, 'source'>, Family> = {
  ability: {
    label: 'Ability Score',
    terms: {
      STR: 'Strength',
      DEX: 'Dexterity',
      CON: 'Constitution',
      INT: 'Intelligence',
      WIS: 'Wisdom',
      CHA: 'Charisma',
    },
  },
  stat: {
    label: 'Statistic',
    terms: {
      AC: 'Armor Class',
      HP: 'Hit Points',
      HD: 'Hit Dice',
      THP: 'Temporary Hit Points',
      CR: 'Challenge Rating',
      DC: 'Difficulty Class',
      PB: 'Proficiency Bonus',
      XP: 'Experience Points',
      DPR: 'Damage Per Round',
    },
  },
  currency: {
    label: 'Currency',
    terms: {
      cp: 'copper pieces',
      sp: 'silver pieces',
      ep: 'electrum pieces',
      gp: 'gold pieces',
      pp: 'platinum pieces',
    },
  },
  alignment: {
    label: 'Alignment',
    terms: {
      LG: 'Lawful Good',
      NG: 'Neutral Good',
      CG: 'Chaotic Good',
      LN: 'Lawful Neutral',
      N: 'Neutral',
      CN: 'Chaotic Neutral',
      LE: 'Lawful Evil',
      NE: 'Neutral Evil',
      CE: 'Chaotic Evil',
    },
  },
  size: {
    label: 'Size',
    terms: {
      T: 'Tiny',
      S: 'Small',
      M: 'Medium',
      L: 'Large',
      H: 'Huge',
      G: 'Gargantuan',
    },
  },
  school: {
    label: 'Spell School',
    terms: {
      A: 'Abjuration',
      C: 'Conjuration',
      D: 'Divination',
      En: 'Enchantment',
      Ev: 'Evocation',
      I: 'Illusion',
      N: 'Necromancy',
      T: 'Transmutation',
    },
  },
  component: {
    label: 'Spell Component',
    terms: {
      V: 'Verbal',
      S: 'Somatic',
      M: 'Material',
    },
  },
  itemType: {
    label: 'Item Type',
    terms: {
      M: 'Melee Weapon',
      R: 'Ranged Weapon',
      A: 'Ammunition',
      LA: 'Light Armor',
      MA: 'Medium Armor',
      HA: 'Heavy Armor',
      S: 'Shield',
      SCF: 'Spellcasting Focus',
      RG: 'Ring',
      RD: 'Rod',
      WD: 'Wand',
      ST: 'Staff',
      SC: 'Scroll',
      P: 'Potion',
      W: 'Wondrous Item',
      G: 'Adventuring Gear',
      GS: 'Gaming Set',
      INS: 'Instrument',
      AT: "Artisan's Tools",
      T: 'Tools',
      TG: 'Trade Good',
      VEH: 'Vehicle',
      MNT: 'Mount',
      AIR: 'Vehicle (Air)',
      SHP: 'Vehicle (Water)',
      FD: 'Food and Drink',
      TAH: 'Tack and Harness',
      GV: 'Generic Variant',
    },
  },
  term: {
    label: 'Term',
    terms: {
      RPG: 'Role Playing Game',
      CSV: 'Comma-Separated Values',
      DM: 'Dungeon Master',
      lb: 'pounds',
      ft: 'feet',
    },
  },
}

// Book source -> full name, warmed by registerBookSources as books load.
const bookSources = new Map<string, string>()

/**
 * Full names for source codes that books.json spells only partially. A compound
 * code names a sub-product of a larger release (HAT-TG = the "Thieves' Gallery"
 * supplement of "Honor Among Thieves"), but the book's `name` carries just the
 * sub-title, so the parent is missing. List the full decoded title here and the
 * tooltip shows the whole thing - add a line as new compound sources appear.
 */
const SOURCE_NAME_OVERRIDES: Record<string, string> = {
  'HAT-TG': "Honor Among Thieves - Thieves' Gallery",
}

/**
 * Record the source -> full-name mapping for the loaded books so book codes
 * resolve in tooltips app-wide. Called by the book loader; safe to call again
 * (it merges), which keeps the map in step with whatever set is loaded. A code
 * listed in SOURCE_NAME_OVERRIDES uses that fuller title instead of the raw name.
 */
export function registerBookSources(books: { source: string; name: string }[]): void {
  for (const b of books)
    bookSources.set(b.source, SOURCE_NAME_OVERRIDES[b.source] ?? b.name)
}

/** Reset the book-source map (tests). */
export function _clearBookSources(): void {
  bookSources.clear()
}

/**
 * Expand an acronym/code to its full name and family label. Scope the lookup
 * with `kind` when the caller knows the family (a size column, a spell school).
 * With no `kind`, only a code that is unambiguous across every family resolves;
 * an ambiguous or unknown code returns undefined so the caller shows it plainly.
 */
export function lookup(code: string, kind?: AbbrKind): GlossaryHit | undefined {
  if (kind === 'source') {
    const full = bookSources.get(code)
    return full ? { full, category: SOURCE_LABEL } : undefined
  }
  if (kind) {
    const full = FAMILIES[kind].terms[code]
    return full ? { full, category: FAMILIES[kind].label } : undefined
  }
  // Unscoped: collect every family that defines this exact code (plus books),
  // and only resolve when there's a single unambiguous answer.
  const hits: GlossaryHit[] = []
  for (const family of Object.values(FAMILIES)) {
    const full = family.terms[code]
    if (full) hits.push({ full, category: family.label })
  }
  const bookFull = bookSources.get(code)
  if (bookFull) hits.push({ full: bookFull, category: SOURCE_LABEL })
  return hits.length === 1 ? hits[0] : undefined
}

/** One character of an expanded name, flagged if it maps back to the acronym. */
export interface FullNameSegment {
  text: string
  /** True when this character corresponds to one of the acronym's letters. */
  matched: boolean
}

/**
 * Map each letter of `code` onto `full` to show how the acronym is formed, e.g.
 * PHB -> [P]layer's [H]and[B]ook, STR -> [STR]ength, gp -> [g]old [p]ieces.
 *
 * Greedy, left to right, preferring the start of a word for each letter so the
 * initials line up the way a reader expects; a matched character is re-cased to
 * the acronym's letter (so STR stays upper, gp stays lower). The 2024-edition
 * "X" prefix has no counterpart letter in the name, so it instead highlights the
 * year the edition is stamped with - XDMG -> "[D]ungeon [M]aster's [G]uide
 * ([2024])" - making the edition obvious. Any other unplaceable letter is simply
 * skipped; only when nothing lines up at all does it return null so the caller
 * shows the plain name.
 */
export function matchAcronym(code: string, full: string): FullNameSegment[] | null {
  const recase = new Map<number, string>() // full index -> acronym letter (re-cased)
  const bold = new Set<number>() // full indices to embolden
  let cursor = 0
  for (const letter of code) {
    // A separator in a compound code (the "-" in HAT-TG) is structural, not part
    // of the acronym, so it is neither matched nor highlighted.
    if (!/[a-z]/i.test(letter)) continue
    const lower = letter.toLowerCase()
    // Prefer a word-start occurrence at/after the cursor, else any occurrence.
    let wordStart = -1
    let anywhere = -1
    for (let i = cursor; i < full.length; i++) {
      if (full[i].toLowerCase() !== lower) continue
      const atWordStart = i === 0 || !/[a-z]/i.test(full[i - 1])
      if (atWordStart) {
        wordStart = i
        break
      }
      if (anywhere === -1) anywhere = i
    }
    const at = wordStart !== -1 ? wordStart : anywhere
    if (at === -1) {
      // The edition-marker "X" isn't spelled in the name; bold the (year) it
      // denotes instead. The digits keep their own text (no re-casing to "X").
      if (lower === 'x') {
        const year = /\((\d{4})\)/.exec(full)
        if (year) for (let k = 1; k <= year[1].length; k++) bold.add(year.index + k)
      }
      continue // other unplaceable letters are just skipped
    }
    recase.set(at, letter)
    bold.add(at)
    cursor = at + 1
  }
  if (bold.size === 0) return null // nothing lined up -> show the plain name
  return Array.from(full, (ch, i) => ({
    text: recase.get(i) ?? ch,
    matched: bold.has(i),
  }))
}
