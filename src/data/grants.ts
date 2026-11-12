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
import { isOnClassList, type ListCaster, type Spell } from './spells'

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

/** One thing a grant gives: a language, a tool, a weapon, an armor kind, a skill, a save. */
export interface GrantValue {
  kind: GrantKind
  /** The data's own key, lower case and without a source: "elvish", "light", "str". */
  key: string
  /** A weapon given by a data filter instead of a name (`type=martial weapon|property=light`). */
  filter?: string
}

/** What a grant lets the player choose: how many, of what, and the wording. */
export interface PickSpec {
  /** Stable among the picks of one alternative: "language:0". */
  id: string
  count: number
  /** Every kind a chosen value can be (a "skill or tool" choice spans two). */
  kinds: GrantKind[]
  /** The values the grant names to choose from; empty when it names none. */
  from: GrantValue[]
  /** The free categories it allows (`anyStandard`, `anyArtisansTool`, `other`...). */
  any: string[]
  /** A weapon choice limited by a data filter. */
  filter?: string
  /** The choice in words: "2 standard languages of your choice". */
  text: string
}

/** One alternative of a grant: what it gives outright and what it lets the player choose. */
export interface GrantAlt {
  fixed: GrantValue[]
  picks: PickSpec[]
}

export interface GrantRead {
  /** The player takes ONE of these. */
  alternatives: GrantAlt[]
  /** Blocks the book marks optional (a rule the DM may allow); each is on or off. */
  optional: GrantAlt[]
  /** Keys the reader does not know: the data audit fails on any. */
  unknown: string[]
}

/** What kind of thing each `any` key lets the player choose. */
const ANY_KIND: Record<string, GrantKind> = {
  anyStandard: 'language',
  anyExotic: 'language',
  anyLanguage: 'language',
  anyArtisansTool: 'tool',
  anyGamingSet: 'tool',
  anyMusicalInstrument: 'tool',
  anyTool: 'tool',
  anySkill: 'skill',
  anyWeapon: 'weapon',
  anyArmor: 'armor',
  anyProficientSkill: 'expertise',
}

const unique = <T>(list: T[]): T[] => [...new Set(list)]

/** A key as a value: no source, lower case. */
const dataKey = (raw: string) => raw.split('|')[0].trim().toLowerCase()

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

/** The property names of a data filter, as the codes the items carry. */
export const PROPERTY_CODES: Record<string, string> = {
  light: 'L',
  finesse: 'F',
  heavy: 'H',
  thrown: 'T',
  versatile: 'V',
  reach: 'R',
  'two-handed': '2H',
  loading: 'LD',
  ammunition: 'A',
  special: 'S',
}

/** A weapon filter of the data ("type=martial weapon|property=light;finesse"). */
export function readWeaponFilter(
  filter: string,
): { category: 'simple' | 'martial'; anyProperty?: string[] } | undefined {
  const type = /type=([^|}]+)/.exec(filter)?.[1]
  const property = /property=([^|}]+)/.exec(filter)?.[1]
  const category = type?.startsWith('martial')
    ? 'martial'
    : type?.startsWith('simple')
      ? 'simple'
      : undefined
  if (!category) return undefined
  const codes = property?.split(';').map((p) => PROPERTY_CODES[p.trim()])
  if (codes?.some((c) => c === undefined)) return undefined
  return { category, anyProperty: codes as string[] | undefined }
}

/** A weapon filter in words: "Martial weapons with the Light or Finesse property". */
function weaponFilterText(filter: string): string {
  const read = readWeaponFilter(filter)
  if (!read) return 'Weapons'
  const noun = read.category === 'martial' ? 'Martial weapons' : 'Simple weapons'
  const names = (read.anyProperty ?? []).map((code) =>
    titleCase(
      Object.keys(PROPERTY_CODES).find((k) => PROPERTY_CODES[k] === code) ?? code,
    ),
  )
  return names.length > 0 ? `${noun} with the ${names.join(' or ')} property` : noun
}

/** A value for display: its name, or the words of its filter. */
export const valueText = (v: GrantValue): string =>
  v.filter === undefined ? nameOf(v.key, v.kind) : weaponFilterText(v.filter)

function chooseSpecs(raw: unknown, kind: GrantKind): Omit<PickSpec, 'id'>[] {
  // A grant of mixed kinds lists its choices; the others hold just one.
  if (Array.isArray(raw)) return raw.flatMap((one) => chooseSpecs(one, kind))
  if (!raw || typeof raw !== 'object') return []
  const { from, count = 1, fromFilter } = raw as Choose
  if (Array.isArray(from)) {
    const options = from
      .filter((o): o is string => typeof o === 'string')
      .map((o) => meaning(o, kind))
    if (options.length === 0) return []
    // Any of the six abilities is a free pick of a saving throw.
    if (kind === 'save' && ABILITIES.every((a) => options.includes(a))) {
      return [
        {
          count,
          kinds: ['save'],
          from: options.map((key) => ({ kind: 'save', key })),
          any: [],
          text: ofYourChoice(count, ['saving throw', 'saving throws']),
        },
      ]
    }
    const any = options.filter((o) => o in ANY_NOUNS)
    const named = options.filter((o) => !(o in ANY_NOUNS))
    // "any skill or any tool" reads better as one free choice between kinds.
    if (named.length === 0) {
      const nouns = any.map((o) => ANY_NOUNS[o][count === 1 ? 0 : 1])
      return [
        {
          count,
          kinds: unique(any.map((o) => ANY_KIND[o])),
          from: [],
          any,
          text: `${count} ${nouns.join(' or ')} of your choice`,
        },
      ]
    }
    const names = options.map((o) =>
      o in ANY_NOUNS ? titleCase(ANY_NOUNS[o][0]) : nameOf(o, kind),
    )
    return [
      {
        count,
        kinds: unique([kind, ...any.map((o) => ANY_KIND[o])]),
        from: named.map((o) => ({ kind, key: dataKey(o) })),
        any,
        text: `${count} of ${names.join(', ')}`,
      },
    ]
  }
  if (typeof fromFilter === 'string') {
    // The data filters its own item list here; only the weapon kinds can be told apart.
    const kinds = filterWeapons(fromFilter)
    const noun =
      kinds.length > 0 ? `${kinds.join(' or ')} weapon` : ANY_NOUNS.anyWeapon[0]
    return [
      {
        count,
        kinds: ['weapon'],
        from: [],
        any: [],
        filter: fromFilter,
        text: ofYourChoice(count, [noun, `${noun}s`]),
      },
    ]
  }
  return []
}

const ARMOR_KEYS: readonly string[] = ['light', 'medium', 'heavy', 'shield']
const WEAPON_WORDS: readonly string[] = ['simple', 'martial', 'firearms', 'improvised']

/** Whether a plain key is a value the kind knows (kinds with an open list know any). */
function knownKey(key: string, kind: GrantKind): boolean {
  if (kind === 'armor') return ARMOR_KEYS.includes(key)
  if (kind === 'weapon') return WEAPON_WORDS.includes(key)
  if (kind === 'save') return (ABILITIES as readonly string[]).includes(key)
  if (kind === 'skill' || kind === 'expertise') return SKILLS.some((s) => s.key === key)
  return true
}

interface Accumulator {
  alt: GrantAlt
  unknown: string[]
}

/** Read one key of a block into the alternative being built. */
function readKey(name: string, value: unknown, kind: GrantKind, into: Accumulator) {
  const { alt, unknown } = into
  const key = meaning(name, kind)
  // A kind of tool named plainly is one of that kind.
  const count = key !== name && value === true ? 1 : value
  const addPick = (spec: Omit<PickSpec, 'id'>) =>
    alt.picks.push({ ...spec, id: `${spec.kinds[0]}:${alt.picks.length}` })
  if (key === 'choose') chooseSpecs(value, kind).forEach(addPick)
  else if (key === 'any' || key in ANY_NOUNS || key === 'anyProficientSkill') {
    if (typeof count !== 'number') return
    // `any` is a free choice of the grant's own kind; the others name theirs.
    const any = key === 'any' ? KIND_ANY[kind] : key
    addPick({
      count,
      kinds: [any === undefined ? kind : ANY_KIND[any]],
      from: [],
      any: [any ?? 'any'],
      text:
        any === 'anyProficientSkill'
          ? `${count} skill${count === 1 ? '' : 's'} you are proficient in`
          : ofYourChoice(count, any === undefined ? undefined : ANY_NOUNS[any]),
    })
  } else if (key === 'all' && value && typeof value === 'object') {
    const filter = (value as Choose).fromFilter
    if (typeof filter === 'string') alt.fixed.push({ kind, key: '', filter })
    else unknown.push(`all:${JSON.stringify(value)}`)
  } else if (key === 'proficiency' && typeof value === 'string') {
    readKey(value, true, kind, into)
  } else if (value === false) return
  else if (value !== true) unknown.push(name)
  // A language outside the standard list, agreed with the DM.
  else if (key === 'other') {
    addPick({ count: 1, kinds: ['language'], from: [], any: ['other'], text: '1 other' })
  } else if (!key.includes('|') && !knownKey(dataKey(key), kind)) unknown.push(name)
  else alt.fixed.push({ kind, key: dataKey(key) })
}

/** A word of an old class list: "light", "{@item rapier|phb|rapiers}", a filter tag. */
function readWord(word: string, kind: GrantKind, into: Accumulator) {
  const item = /\{@item ([^|}]+)/.exec(word)?.[1]
  if (item && kind !== 'save') into.alt.fixed.push({ kind, key: item.toLowerCase() })
  else if (word.includes('{@filter')) {
    into.alt.fixed.push({ kind, key: '', filter: word })
  } else readKey(word, true, kind, into)
}

/**
 * Read a grant's blocks once, as structured values: what is given outright and what
 * the player chooses, per alternative. Several object blocks are alternatives (the
 * player takes one); the words of an older class list are one alternative together; a
 * block marked optional is a separate switch. Every other view of a grant (the words
 * in a table cell, the proficiencies on the sheet, the picks) is read from this.
 */
export function readGrant(
  blocks: readonly unknown[] | undefined,
  kind: GrantKind,
): GrantRead {
  const out: GrantRead = { alternatives: [], optional: [], unknown: [] }
  let words: Accumulator | undefined
  for (const block of blocks ?? []) {
    if (typeof block === 'string') {
      if (!words) {
        words = { alt: { fixed: [], picks: [] }, unknown: out.unknown }
        out.alternatives.push(words.alt)
      }
      readWord(block, kind, words)
      continue
    }
    if (!block || typeof block !== 'object' || Array.isArray(block)) continue
    words = undefined
    const into: Accumulator = { alt: { fixed: [], picks: [] }, unknown: out.unknown }
    let optional = false
    for (const [name, value] of Object.entries(block)) {
      if (name === 'optional') optional = value === true
      // The book's own words for what the block gives.
      else if (name === 'full') continue
      else readKey(name, value, kind, into)
    }
    if (into.alt.fixed.length === 0 && into.alt.picks.length === 0) continue
    ;(optional ? out.optional : out.alternatives).push(into.alt)
  }
  out.alternatives = out.alternatives.filter((a) => a.fixed.length + a.picks.length > 0)
  return out
}

/** The words of one alternative. */
function altSet(alt: GrantAlt, kind: GrantKind): GrantSet {
  const set: GrantSet = {
    fixed: alt.fixed.map(valueText),
    choices: alt.picks.map((p) => p.text),
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

/** The alternatives of a grant in words; none when it grants nothing. */
export function grantSets(blocks: unknown[] | undefined, kind: GrantKind): GrantSet[] {
  // The words of the older class lists are read by `readGrant` for the sheet; a table cell
  // describes the blocks of a race, background or feat.
  return readGrant(
    blocks?.filter((b) => typeof b !== 'string'),
    kind,
  )
    .alternatives.map((alt) => altSet(alt, kind))
    .filter((s) => !isEmpty(s))
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
      set.choices.push(
        ...chooseSpecs((item as { choose?: unknown }).choose, 'mixed').map((s) => s.text),
      )
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

/** The spell facts a filter reads. */
export type FilterSpell = Pick<
  Spell,
  'level' | 'school' | 'ritual' | 'attack' | 'source' | 'lists' | 'edition'
>

/** What a filter's class is read against: the classes there are, and the books selected. */
export interface FilterLists {
  /** Every class there is, by key ("Wizard|PHB"), with its rules edition. */
  classes: ListCaster[]
  /** An optional list counts only while its book is. */
  selectedBooks: string[]
}

/**
 * Whether a spell is one the filter offers. A class is read from the list of each
 * class of that name of the grant's own edition (a 2014 feat offers the 2014 Cleric
 * list), of every edition when it is not given, as `isOnClassList` decides it.
 */
export function matchesFilter(
  spell: FilterSpell,
  filter: SpellFilter,
  edition: Spell['edition'] | undefined,
  lists: FilterLists,
): boolean {
  const onList = (name: string) =>
    lists.classes.some(
      (caster) =>
        caster.classKey.split('|')[0].toLowerCase() === name.toLowerCase() &&
        // A class whose data names no edition is read as a 2014 one, as its label is.
        (edition === undefined || (caster.edition ?? 'classic') === edition) &&
        isOnClassList(spell, { classKey: caster.classKey }, lists.selectedBooks),
    )
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

/** The kinds, other than skills, that a mixed grant lets the player choose (Skilled: tools). */
export function sharedKinds(
  blocks: readonly unknown[] | undefined,
): Exclude<GrantKind, 'mixed' | 'skill'>[] {
  const kinds = readGrant(blocks, 'mixed')
    .alternatives.flatMap((a) => a.picks.flatMap((p) => p.kinds))
    .filter(
      (k): k is Exclude<GrantKind, 'mixed' | 'skill'> => k !== 'mixed' && k !== 'skill',
    )
  return [...new Set(kinds)]
}
