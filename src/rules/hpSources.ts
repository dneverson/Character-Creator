// Every rule that raises a character's own hit point maximum, as one table. A rule
// is matched against the character (a feat taken, the race and subrace, a subclass
// on a class row) and applied automatically; class-level rules count the levels of
// the matching class, not the character. Verified against the whole data set: the
// audit test in hpSources.test.ts fails when a book adds a rule that is not here.

import { totalLevel } from '../character/derive'
import type { Character } from '../character/model'

type Origin = 'Feat' | 'Race' | 'Subclass'

type HpMatch =
  | { feat: string }
  | { race: { baseName: string; source: string; subraceName?: string } }
  | {
      subclass: {
        className: string
        shortName: string
        source: string
        /** The class level the feature arrives at, by the class row's book. */
        from: (classSource: string) => number
      }
    }

export interface HpRule {
  /** Data identity: the data collection, name and source the rule comes from. */
  id: string
  label: string
  origin: Origin
  /** The rule in plain words, as the line's tooltip. */
  text: string
  perLevel: number
  flat: number
  match: HpMatch
}

const perLevelRule = (
  id: string,
  label: string,
  origin: Origin,
  perLevel: number,
  match: HpMatch,
  text: string,
): HpRule => ({ id, label, origin, text, perLevel, flat: 0, match })

/** Draconic Resilience and Immortal Durability: 1 per level in the class. */
const classLevel = (
  className: string,
  shortName: string,
  source: string,
  from: (classSource: string) => number,
): HpMatch => ({ subclass: { className, shortName, source, from } })

export const HP_RULES: readonly HpRule[] = [
  perLevelRule(
    'feat|Tough|PHB',
    'Tough',
    'Feat',
    2,
    { feat: 'tough|phb' },
    'Tough: your hit point maximum increases by 2 for each level.',
  ),
  perLevelRule(
    'feat|Tough|XPHB',
    'Tough',
    'Feat',
    2,
    { feat: 'tough|xphb' },
    'Tough: your hit point maximum increases by twice your level.',
  ),
  {
    id: 'feat|Boon of Fortitude|XPHB',
    label: 'Boon of Fortitude',
    origin: 'Feat',
    text: 'Boon of Fortitude: your hit point maximum increases by 40.',
    perLevel: 0,
    flat: 40,
    match: { feat: 'boon of fortitude|xphb' },
  },
  perLevelRule(
    'subrace|Hill|PHB',
    'Dwarven Toughness',
    'Race',
    1,
    { race: { baseName: 'Dwarf', source: 'PHB', subraceName: 'Hill' } },
    'Hill Dwarf: your hit point maximum increases by 1 for each level.',
  ),
  perLevelRule(
    'race|Dwarf|XPHB',
    'Dwarven Toughness',
    'Race',
    1,
    { race: { baseName: 'Dwarf', source: 'XPHB' } },
    'Dwarf: your hit point maximum increases by 1 for each level.',
  ),
  perLevelRule(
    'race|Dwarf (Kaladesh)|PSK',
    'Dwarven Toughness',
    'Race',
    1,
    { race: { baseName: 'Dwarf (Kaladesh)', source: 'PSK' } },
    'Dwarf (Kaladesh): your hit point maximum increases by 1 for each level.',
  ),
  perLevelRule(
    'subrace|Stensia|PSI',
    'Tough',
    'Race',
    2,
    { race: { baseName: 'Human (Innistrad)', source: 'PSI', subraceName: 'Stensia' } },
    'Stensia human: your hit point maximum increases by 2 for each level.',
  ),
  perLevelRule(
    'subclassFeature|Draconic Resilience|PHB',
    'Draconic Resilience',
    'Subclass',
    1,
    // A 2014 subclass on a 2024 Sorcerer arrives at 3 like the rest of that subclass.
    classLevel('Sorcerer', 'Draconic', 'PHB', (s) => (s === 'XPHB' ? 3 : 1)),
    'Draconic Bloodline: your hit point maximum increases by 1 for each Sorcerer level.',
  ),
  perLevelRule(
    'subclassFeature|Draconic Resilience|XPHB',
    'Draconic Resilience',
    'Subclass',
    1,
    classLevel('Sorcerer', 'Draconic', 'XPHB', () => 3),
    'Draconic Sorcery: 3 more hit points at Sorcerer level 3, then 1 for each Sorcerer ' +
      'level after.',
  ),
  perLevelRule(
    'subclassFeature|Immortal Durability|UATheMysticClass',
    'Immortal Durability',
    'Subclass',
    1,
    classLevel('Mystic', 'Immortal', 'UATheMysticClass', () => 1),
    'Order of the Immortal: your hit point maximum increases by 1 for each Mystic level.',
  ),
]

/** One applied rule: what it gives and over how many levels. */
export interface HpLine {
  id: string
  label: string
  origin: Origin
  /** Where it comes from, e.g. "Feat", "Race", "Sorcerer (Draconic Bloodline)". */
  source: string
  /** The rule in plain words. */
  text: string
  perLevel: number
  /** The levels counted (character level, or the matching class's level). */
  levels: number
  flat: number
  /** Whether the levels are the character's or one class's. */
  per: 'character' | 'class'
  total: number
}

const lineOf = (
  rule: HpRule,
  source: string,
  per: HpLine['per'],
  levels: number,
): HpLine => ({
  id: rule.id,
  label: rule.label,
  origin: rule.origin,
  source,
  text: rule.text,
  perLevel: rule.perLevel,
  levels,
  flat: rule.flat,
  per,
  total: rule.perLevel * levels + rule.flat,
})

/** The feat rule for a feat key, e.g. for a feat's own "hit points" fact. */
export function featHpRule(key: string): HpRule | undefined {
  return HP_RULES.find((r) => 'feat' in r.match && r.match.feat === key)
}

/** Every rule that applies to the character, in table order. `featKeys` are its feats. */
export function hpSources(character: Character, featKeys: readonly string[]): HpLine[] {
  const level = totalLevel(character)
  const taken = new Set(featKeys)
  const race = character.race
  const lines: HpLine[] = []
  for (const rule of HP_RULES) {
    const m = rule.match
    if ('feat' in m) {
      if (taken.has(m.feat)) lines.push(lineOf(rule, 'Feat', 'character', level))
    } else if ('race' in m) {
      const r = m.race
      if (
        race?.baseName === r.baseName &&
        race.source === r.source &&
        (r.subraceName === undefined || race.subraceName === r.subraceName)
      ) {
        lines.push(lineOf(rule, 'Race', 'character', level))
      }
    } else {
      const s = m.subclass
      for (const row of character.classes) {
        const sub = row.subclass
        const levels = Math.floor(row.level || 0)
        if (
          row.name === s.className &&
          sub?.shortName === s.shortName &&
          sub.source === s.source &&
          levels >= s.from(row.source)
        ) {
          lines.push(lineOf(rule, `${row.name}, ${sub.name}`, 'class', levels))
        }
      }
    }
  }
  return lines
}
