// What a race, background or feat grants, in words.
//
// The data lists proficiencies (languages, tools, weapons, armor, skills) as
// blocks: a block names what is granted outright (`{ "common": true }`) and what
// is the player's to choose (`{ "anyStandard": 1 }`, `{ "choose": { ... } }`).
// Several blocks are alternatives: the player takes one of them. This reads those
// blocks once, so a table cell, a compare row and a filter all say the same.

import { ABILITY_NAMES, ABILITIES } from '../dice/dice'
import { lookup } from './glossary'
import { SKILLS, skillLabel } from './skills'
import { titleCase } from '../text/titleCase'
import type { Spell } from './spells'

export type GrantKind =
  'language' | 'tool' | 'weapon' | 'armor' | 'skill' | 'expertise' | 'save' | 'mixed'

/** The fields a race or background lists its proficiencies in, as blocks. */
export const PROFICIENCY_FIELDS = [
  'languageProficiencies',
  'skillProficiencies',
  'toolProficiencies',
  'armorProficiencies',
  'weaponProficiencies',
  'skillToolLanguageProficiencies',
] as const

export type ProficiencyField = (typeof PROFICIENCY_FIELDS)[number]

/** One alternative of a grant: what is given outright, and what is chosen. */
export interface GrantSet {
  fixed: string[]
  choices: string[]
}

/** The nouns of the "any" keys: `anyStandard: 2` is "2 standard languages". */
const ANY_NOUNS: Record<string, [one: string, several: string]> = {
  anyStandard: ['standard language', 'standard languages'],
  anyExotic: ['exotic language', 'exotic languages'],
  anyLanguage: ['language', 'languages'],
  anyArtisansTool: ["set of artisan's tools", "sets of artisan's tools"],
  anyGamingSet: ['gaming set', 'gaming sets'],
  anyMusicalInstrument: ['musical instrument', 'musical instruments'],
  anyTool: ['tool', 'tools'],
  anySkill: ['skill', 'skills'],
  anyWeapon: ['weapon', 'weapons'],
  anyArmor: ['armor', 'armors'],
}

// A kind of tool written as a plain name ("gaming set") means one of that kind
// of the player's choice, as its `any` key says it.
const TOOL_CATEGORIES: Record<string, string> = {
  'gaming set': 'anyGamingSet',
  'musical instrument': 'anyMusicalInstrument',
  "artisan's tools": 'anyArtisansTool',
}

/** What a free `any` choice is of, for the kinds that are of one thing. */
const KIND_ANY: Partial<Record<GrantKind, string>> = {
  language: 'anyLanguage',
  tool: 'anyTool',
  weapon: 'anyWeapon',
  armor: 'anyArmor',
  skill: 'anySkill',
}

/** A key as the grant means it: a kind of tool read as its `any` key. */
const meaning = (key: string, kind: GrantKind) =>
  (kind === 'tool' || kind === 'mixed' ? TOOL_CATEGORIES[key] : undefined) ?? key

const FIXED_NAMES: Partial<Record<GrantKind, Record<string, string>>> = {
  armor: {
    light: 'Light armor',
    medium: 'Medium armor',
    heavy: 'Heavy armor',
    shield: 'Shields',
  },
  weapon: {
    simple: 'Simple weapons',
    martial: 'Martial weapons',
    firearms: 'Firearms',
    improvised: 'Improvised weapons',
  },
  save: ABILITY_NAMES,
}

const EVERY_SKILL = 'Every skill'

/** A name from the data for display: no source tag, and in title case. */
function nameOf(raw: string, kind: GrantKind): string {
  const name = raw.split('|')[0].trim()
  if (kind === 'skill' || kind === 'expertise') return skillLabel(name)
  return FIXED_NAMES[kind]?.[name] ?? titleCase(name)
}

const ofYourChoice = (count: number, nouns?: [string, string]) =>
  nouns
    ? `${count} ${count === 1 ? nouns[0] : nouns[1]} of your choice`
    : `${count} of your choice`

interface Choose {
  from?: unknown
  count?: number
  fromFilter?: unknown
}

// The weapon kinds a data filter (`type=martial weapon;mundane weapon`) names;
// "mundane" is the plain weapons, which the books call simple.
const FILTER_WEAPONS: Record<string, string> = {
  'simple weapon': 'simple',
  'mundane weapon': 'simple',
  'martial weapon': 'martial',
}

/** The weapon kinds a filter allows: "simple or martial". */
function filterWeapons(filter: string): string[] {
  const types = filter
    .split('|')
    .find((part) => part.startsWith('type='))
    ?.slice('type='.length)
    .split(';')
  const kinds = new Set(
    (types ?? []).map((t) => FILTER_WEAPONS[t.trim()]).filter(Boolean),
  )
  return ['simple', 'martial'].filter((k) => kinds.has(k))
}

function chooseText(raw: unknown, kind: GrantKind): string[] {
  // A grant of mixed kinds lists its choices; the others hold just one.
  if (Array.isArray(raw)) return raw.flatMap((one) => chooseText(one, kind))
  if (!raw || typeof raw !== 'object') return []
  const { from, count = 1, fromFilter } = raw as Choose
  if (Array.isArray(from)) {
    const options = from
      .filter((o): o is string => typeof o === 'string')
      .map((o) => meaning(o, kind))
    if (options.length === 0) return []
    // Any of the six abilities is a free pick of a saving throw.
    if (kind === 'save' && ABILITIES.every((a) => options.includes(a)))
      return [ofYourChoice(count, ['saving throw', 'saving throws'])]
    // "any skill or any tool" reads better as one free choice between kinds.
    if (options.every((o) => o in ANY_NOUNS)) {
      const nouns = options.map((o) => ANY_NOUNS[o][count === 1 ? 0 : 1])
      return [`${count} ${nouns.join(' or ')} of your choice`]
    }
    const names = options.map((o) =>
      o in ANY_NOUNS ? titleCase(ANY_NOUNS[o][0]) : nameOf(o, kind),
    )
    return [`${count} of ${names.join(', ')}`]
  }
  if (typeof fromFilter === 'string') {
    // The data filters its own item list here; only the weapon kinds can be told apart.
    const kinds = filterWeapons(fromFilter)
    const noun =
      kinds.length > 0 ? `${kinds.join(' or ')} weapon` : ANY_NOUNS.anyWeapon[0]
    return [ofYourChoice(count, [noun, `${noun}s`])]
  }
  return []
}

function readBlock(raw: unknown, kind: GrantKind): GrantSet {
  const set: GrantSet = { fixed: [], choices: [] }
  if (!raw || typeof raw !== 'object') return set
  for (const [name, value] of Object.entries(raw)) {
    const key = meaning(name, kind)
    // A kind of tool named plainly is one of that kind.
    const count = key !== name && value === true ? 1 : value
    if (key === 'choose') set.choices.push(...chooseText(value, kind))
    else if (key === 'anyProficientSkill') {
      // Expertise: a skill the character is already proficient in.
      if (typeof count === 'number')
        set.choices.push(`${count} skill${count === 1 ? '' : 's'} you are proficient in`)
    } else if (key === 'any' || key in ANY_NOUNS) {
      // `any` is a free choice of the grant's own kind; the others name theirs.
      if (typeof count === 'number') {
        const any = key === 'any' ? KIND_ANY[kind] : key
        set.choices.push(ofYourChoice(count, any ? ANY_NOUNS[any] : undefined))
      }
    } else if (value !== true) continue
    // A language outside the standard list, agreed with the DM.
    else if (key === 'other') set.choices.push('1 other')
    else set.fixed.push(nameOf(key, kind))
  }
  // Naming all the skills is the same as granting every one of them.
  if (
    (kind === 'skill' || kind === 'expertise') &&
    SKILLS.every((k) => set.fixed.includes(k.label))
  )
    set.fixed = [EVERY_SKILL]
  return set
}

const isEmpty = (set: GrantSet) => set.fixed.length === 0 && set.choices.length === 0

/** The alternatives of a grant; none when it grants nothing. */
export function grantSets(blocks: unknown[] | undefined, kind: GrantKind): GrantSet[] {
  return (blocks ?? []).map((block) => readBlock(block, kind)).filter((s) => !isEmpty(s))
}

/**
 * A plain list where every item is granted: damage resistances, condition
 * immunities. An item is a name, or a choice between names.
 */
export function listedGrants(items: unknown[] | undefined): GrantSet[] {
  const set: GrantSet = { fixed: [], choices: [] }
  for (const item of items ?? []) {
    if (typeof item === 'string') set.fixed.push(titleCase(item))
    else if (item && typeof item === 'object')
      set.choices.push(...chooseText((item as { choose?: unknown }).choose, 'mixed'))
  }
  return isEmpty(set) ? [] : [set]
}

/**
 * Where a grant keeps its spells: cast without a slot (`innate`), always known or
 * prepared, or only added to the class's spell list (`expanded`).
 */
export const SPELL_PATHS = ['innate', 'known', 'prepared', 'expanded'] as const
export type SpellPath = (typeof SPELL_PATHS)[number]

// The data's school codes; the glossary writes Enchantment and Evocation "En" and "Ev".
const SCHOOL_CODES: Record<string, string> = { E: 'En', V: 'Ev' }

const schoolName = (code: string) =>
  lookup(SCHOOL_CODES[code] ?? code, 'school')?.full ?? code

/**
 * What a grant lets the player choose a spell from, read from the data's filter
 * (`level=1|school=D;E`, `level=0|class=Wizard`). An empty list means "any".
 */
export interface SpellFilter {
  levels: number[]
  /** Class names, as the data writes them (any case). */
  classes: string[]
  /** School codes ("D", "E"). */
  schools: string[]
  ritual: boolean
  /** Spell attack kinds, lower case: "m" melee, "r" ranged. */
  attacks: string[]
  sources: string[]
}

/** Read a data filter (`;` is or, `|` is and; keys are not case sensitive). */
export function parseSpellFilter(filter: string): SpellFilter {
  const parts = new Map(
    filter.split('|').map((part) => {
      const [key, value = ''] = part.split('=')
      return [
        key.trim().toLowerCase(),
        value
          .split(';')
          .map((v) => v.trim())
          .filter(Boolean),
      ] as const
    }),
  )
  const list = (key: string) => parts.get(key) ?? []
  return {
    levels: list('level')
      .map(Number)
      .filter((n) => Number.isInteger(n)),
    classes: list('class'),
    schools: list('school').map((s) => s.toUpperCase()),
    ritual: list('components & miscellaneous').some((v) => v.toLowerCase() === 'ritual'),
    attacks: list('spell attack').map((a) => a.toLowerCase()),
    sources: list('source').map((s) => s.toUpperCase()),
  }
}

/** The class books of the 2024 rules; a class list belongs to its book's edition. */
const ONE_CLASS_SOURCES = new Set(['XPHB', 'EFA'])

/** The spell facts a filter reads. */
export type FilterSpell = Pick<
  Spell,
  'level' | 'school' | 'ritual' | 'attack' | 'source' | 'lists'
>

/**
 * Whether a spell is one the filter offers. A class is read from the class list of
 * the grant's own edition (a 2014 feat offers the 2014 Cleric list), every
 * edition when it is not given.
 */
export function matchesFilter(
  spell: FilterSpell,
  filter: SpellFilter,
  edition?: Spell['edition'],
): boolean {
  const onList = (name: string) =>
    [...spell.lists.classes, ...Object.keys(spell.lists.variants)].some((key) => {
      const [className, classSource = ''] = key.split('|')
      return (
        className.toLowerCase() === name.toLowerCase() &&
        (edition === undefined ||
          ONE_CLASS_SOURCES.has(classSource) === (edition === 'one'))
      )
    })
  return (
    (filter.levels.length === 0 || filter.levels.includes(spell.level)) &&
    (filter.classes.length === 0 || filter.classes.some(onList)) &&
    (filter.schools.length === 0 || filter.schools.includes(spell.school)) &&
    (!filter.ritual || spell.ritual) &&
    (filter.attacks.length === 0 ||
      (spell.attack === 'Melee' && filter.attacks.includes('m')) ||
      (spell.attack === 'Ranged' && filter.attacks.includes('r'))) &&
    (filter.sources.length === 0 || filter.sources.includes(spell.source.toUpperCase()))
  )
}

/**
 * A spell the player picks, worded from the data's filter: "1 level 1
 * Divination or Enchantment spell", "1 Wizard cantrip".
 */
export function chooseSpellText(filter: string, count: number): string {
  return `${count} ${spellKindText(parseSpellFilter(filter), count)}`
}

/** What a filter allows, as a noun: "Wizard cantrip", "level 1 ritual spells". */
export function spellKindText(
  { levels, schools, classes, ritual }: SpellFilter,
  count: number,
): string {
  const cantrip = levels.length === 1 && levels[0] === 0
  const first = Math.min(...levels)
  const last = Math.max(...levels)
  const level =
    levels.length === 0 || cantrip
      ? ''
      : first === last
        ? `level ${first}`
        : `level ${first} to ${last}`
  const words = [
    level,
    schools.map(schoolName).join(' or '),
    classes.map(titleCase).join(' or '),
    ritual ? 'ritual' : '',
    `${cantrip ? 'cantrip' : 'spell'}${count === 1 ? '' : 's'}`,
  ].filter(Boolean)
  return words.join(' ')
}

function gatherSpells(raw: unknown, set: GrantSet): void {
  if (typeof raw === 'string') {
    // "dancing lights|xphb#c": a name, its source, and a marker for a cantrip.
    const name = titleCase(raw.split('|')[0].split('#')[0].trim())
    if (name && !set.fixed.includes(name)) set.fixed.push(name)
  } else if (Array.isArray(raw)) {
    for (const item of raw) gatherSpells(item, set)
  } else if (raw && typeof raw === 'object') {
    const { count } = raw as { count?: unknown }
    for (const [key, value] of Object.entries(raw)) {
      if (key === 'choose')
        set.choices.push(
          typeof value === 'string'
            ? chooseSpellText(value, typeof count === 'number' ? count : 1)
            : 'Spell of your choice',
        )
      else gatherSpells(value, set)
    }
  }
}

/**
 * The spells a grant gives (`additionalSpells` in the data), named, from the
 * places given (every place by default). Where the data offers several sets the
 * player takes one; they are listed together.
 */
export function spellGrants(
  blocks: unknown[] | undefined,
  paths: readonly SpellPath[] = SPELL_PATHS,
): GrantSet[] {
  const read = new Set<string>(paths)
  const set: GrantSet = { fixed: [], choices: [] }
  for (const block of blocks ?? []) {
    if (!block || typeof block !== 'object') continue
    for (const [key, value] of Object.entries(block)) {
      if (read.has(key)) gatherSpells(value, set)
    }
  }
  set.choices = [...new Set(set.choices)]
  return isEmpty(set) ? [] : [set]
}

/** A grant in words: "Common, Elvish, 1 standard language of your choice". */
export function grantText(sets: GrantSet[]): string {
  return sets.map((set) => [...set.fixed, ...set.choices].join(', ')).join(' or ')
}

/** What a filter offers for a grant: each thing given, and "Choice" for any choice. */
export const CHOICE_VALUE = 'Choice'
export function grantValues(sets: GrantSet[]): string[] {
  const values = new Set(sets.flatMap((set) => set.fixed))
  if (sets.some((set) => set.choices.length > 0)) values.add(CHOICE_VALUE)
  return [...values]
}
