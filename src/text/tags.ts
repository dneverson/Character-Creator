// Convert 5etools "{@tag ...}" markup to plain display text.
//
// 5etools embeds tags like {@spell fireball|phb|fire ball}, {@dice 1d6},
// {@condition prone}, {@item longsword}, {@dc 15}. `TAG_RULES` is the one table that
// says how a tag is drawn: the text it prints and, where the printed books set it in a
// style (the italic "Melee Weapon Attack:" of a stat block), that style. `stripTags`
// prints the text; TaggedText adds the style. A tag with no rule prints its display
// override (the third part) or its first part, which is how every reference tag reads.
// The audit test (tags.audit.test.ts) fails on a tag of the data that has neither a rule
// here nor a place in the lookup's reference tags.

import { ABILITY_NAMES, abilityMod, formatMod, type AbilityKey } from '../dice/dice'

/** How a tag sets its text: an element, or the class of a note. */
export type TagStyle = 'em' | 'strong' | 'u' | 's' | 'sup' | 'note'

export interface TagRule {
  /** The text the tag prints, from its parts (split at "|") and its whole content. */
  text?: (parts: string[], content: string) => string
  /** The style the text is set in. */
  style?: TagStyle
  /** The tag holds text with tags of its own, which are drawn inside the style. */
  nested?: boolean
}

const first = (parts: string[]) => parts[0] ?? ''

/** A tag that prints its display override, else its first part, as a reference does. */
const DISPLAY: TagRule = {}

/** A tag that prints its first part. */
const FIRST: TagRule = { text: first }

/** A tag that prints its whole content, nested tags and all. */
const WHOLE: TagRule = { text: (_parts, content) => content }

/** A tag that sets its whole content in a style; the style holds nested tags. */
const styled = (style: TagStyle): TagRule => ({ style, nested: true, text: WHOLE.text })

/** A tag that prints one fixed label in the italic of the printed books. */
const label = (text: string): TagRule => ({ style: 'em', text: () => text })

/** The part of a tag at `index`, or its first part when that one is empty. */
const part =
  (index: number): TagRule['text'] =>
  (parts) =>
    parts[index] || first(parts)

/** The "+4" of a bonus: a sign is added when the text has none. */
const signed = (text: string) =>
  /^[+-]/.test(text.trim()) ? text.trim() : `+${text.trim()}`

/** The last word of a content like "athletics 4": the bonus of a skill check. */
const lastWord = (content: string) => content.trim().split(/\s+/).pop() ?? ''

const RANGES: Record<string, string> = { m: 'Melee', r: 'Ranged' }
const WEAPONS: Record<string, string> = { w: 'Weapon', s: 'Spell', '': '' }

/**
 * The words of an attack: "Melee or Ranged Weapon Attack" for `mw,rw`, "Melee Attack
 * Roll" for `m` with the 2024 noun. A code it does not know is printed as it is.
 */
function attackWords(codes: string, noun: string): string | undefined {
  const found = codes.split(',').map((code) => /^([mr])([ws]?)$/.exec(code.trim()))
  const kinds = found.filter((match): match is RegExpExecArray => match !== null)
  if (kinds.length !== found.length) return undefined
  const words = (match: RegExpExecArray, range: string) =>
    [range, WEAPONS[match[2]], noun].filter(Boolean).join(' ')
  // The same weapon or spell for every kind: "Melee or Ranged Weapon Attack".
  if (new Set(kinds.map((kind) => kind[2])).size === 1) {
    return words(kinds[0], kinds.map((kind) => RANGES[kind[1]]).join(' or '))
  }
  return kinds.map((kind) => words(kind, RANGES[kind[1]])).join(' or ')
}

const attack = (noun: string): TagRule => ({
  style: 'em',
  text: (parts) => {
    const words = attackWords(first(parts), noun)
    return words ? `${words}:` : first(parts)
  },
})

const ORDINALS = ['First', 'Second', 'Third', 'Fourth']

/** A saving throw label: {@actSave con} prints "Constitution Saving Throw:". */
const saveLabel = (parts: string[]) => {
  const name = ABILITY_NAMES[first(parts).trim().toLowerCase() as AbilityKey]
  return name ? `${name} Saving Throw:` : first(parts)
}

/** {@actSaveFail 2} prints "Second Failure:", {@actSaveFail} prints "Failure:". */
const failLabel = (parts: string[]) => {
  const place = ORDINALS[Number(first(parts)) - 1]
  return `${place ? `${place} ` : ''}Failure:`
}

/** {@ability con 10|+0} prints "CON 10 (+0)", the modifier worked out when absent. */
function abilityText(parts: string[]): string {
  const [key = '', score = ''] = first(parts).trim().split(/\s+/)
  const modifier = parts[1] || formatMod(abilityMod(Number(score)))
  return `${key.toUpperCase()} ${score} (${modifier})`
}

/** {@recharge 5} prints "(Recharge 5-6)" with the en dash of the printed books. */
const rechargeText = (parts: string[]) =>
  first(parts) && first(parts) !== '6' ? `(Recharge ${first(parts)}–6)` : '(Recharge 6)'

export const TAG_RULES: Readonly<Record<string, TagRule>> = {
  // Attacks and the labels of a stat block's actions, which the books set in italic.
  atk: attack('Attack'),
  atkr: attack('Attack Roll'),
  actSave: { style: 'em', text: saveLabel },
  actSaveFail: { style: 'em', text: failLabel },
  actSaveFailBy: { style: 'em', text: (p) => `Failure by ${first(p)} or More:` },
  actSaveSuccess: label('Success:'),
  actSaveSuccessOrFail: label('Failure or Success:'),
  actTrigger: label('Trigger:'),
  actResponse: label('Response:'),
  h: label('Hit: '),
  m: label('Miss: '),
  hom: label('Hit or Miss: '),
  // Numbers and rolls.
  hit: { text: (p) => p[1] || signed(first(p)) },
  d20: { text: (p) => p[1] || signed(first(p)) },
  skillCheck: { text: (_p, content) => signed(lastWord(content)) },
  savingThrow: { text: (_p, content) => signed(lastWord(content)) },
  ability: { text: abilityText },
  dc: { text: (p) => `DC ${first(p)}` },
  hitYourSpellAttack: { text: (_p, content) => content || 'your spell attack modifier' },
  dcYourSpellSave: { text: () => 'your spell save DC' },
  chance: { text: (p) => p[1] || `${first(p)}%` },
  recharge: { text: rechargeText },
  // A roll prints its display text, else the roll itself.
  dice: { text: part(1) },
  damage: { text: part(1) },
  autodice: { text: part(1) },
  // The increase of a scaling roll ("increases by 1d6"), not its level range.
  scaledice: { text: part(2) },
  scaledamage: { text: part(2) },
  // Tags whose display text is a later part than the third.
  classFeature: { text: part(5) },
  subclassFeature: { text: part(7) },
  subclass: { text: part(4) },
  deity: { text: part(3) },
  card: { text: part(3) },
  quickref: { text: part(4) },
  // Places, links and notes whose first part is the text.
  book: FIRST,
  adventure: FIRST,
  filter: FIRST,
  footnote: FIRST,
  area: FIRST,
  link: FIRST,
  tip: FIRST,
  legroup: FIRST,
  color: FIRST,
  font: FIRST,
  style: FIRST,
  '5etools': FIRST,
  '5etoolsImg': FIRST,
  '5etoolsAudio': FIRST,
  coinflip: FIRST,
  // The singular or the plural of a unit, by the amount: {@unit 2|egg|eggs}.
  unit: { text: (p) => (Number(first(p)) === 1 ? p[1] : p[2]) || first(p) },
  // Names of things the lookup does not hold, printed as a reference is.
  crochet: DISPLAY,
  creatureFluff: DISPLAY,
  boon: DISPLAY,
  // Text the printed books set apart.
  i: styled('em'),
  italic: styled('em'),
  b: styled('strong'),
  bold: styled('strong'),
  u: styled('u'),
  s: styled('s'),
  strike: styled('s'),
  sup: styled('sup'),
  note: styled('note'),
  // The text of a comic panel or a highlight, printed without the panel's own style.
  highlight: WHOLE,
  comic: WHOLE,
  comicH1: WHOLE,
  comicH2: WHOLE,
  comicH3: WHOLE,
  comicH4: WHOLE,
  comicNote: WHOLE,
}

function renderTag(tag: string, content: string): string {
  const parts = content.split('|')
  const text = TAG_RULES[tag]?.text
  // Reference tags: {@spell name|source|display}, {@item ...}: the display override.
  return text ? text(parts, content) : parts[2] || first(parts)
}

/** Replace all {@tag …} occurrences with display text, innermost first. */
export function stripTags(text: string): string {
  if (typeof text !== 'string') return String(text)
  // Match an innermost tag (no nested braces inside).
  const re = /\{@(\w+)\s*([^{}]*)\}/
  let out = text
  let guard = 0
  while (re.test(out) && guard < 100) {
    out = out.replace(re, (_m, tag: string, content: string) => renderTag(tag, content))
    guard++
  }
  return out
}
