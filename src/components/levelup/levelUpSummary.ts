// What Level up shows from two derived sheets, the character before and the draft after:
// the hit points the level adds, the before and after table, and the choices it opened.
// Every number here is read from `deriveSheet`, so the summary says what the sheet will.

import type { CharacterPatch } from '../../character/history'
import type { Character, SpellsByClass } from '../../character/model'
import { formatMod } from '../../dice/dice'
import { ordinal } from '../../data/spellText'
import type { DerivedSheet } from '../../derived'
import type { ChecklistItem } from '../../derived/checklist'
import { quantity, type Line, type Quantity } from '../../derived/types'

/**
 * The lines the level adds to the hit point maximum: each line of the maximum whose
 * amount changed, by how much.
 */
export function hpGain(before: Quantity, after: Quantity): Quantity {
  const had = new Map(before.lines.map((l) => [l.id, l.amount ?? 0]))
  const lines: Line[] = []
  for (const line of after.lines) {
    if (line.status !== 'applied' || line.amount === undefined) continue
    const gained = line.amount - (had.get(line.id) ?? 0)
    if (gained === 0) continue
    lines.push({ ...line, op: 'add', amount: gained, how: line.how && `now ${line.how}` })
  }
  return quantity(lines)
}

/** One row of the before and after table. */
export interface SummaryRow {
  label: string
  before: string
  after: string
}

const hitDiceText = (sheet: DerivedSheet) =>
  sheet.hitDice.map((d) => `${d.count.value}d${d.faces}`).join(', ') || 'None'

const slotsText = (sheet: DerivedSheet) =>
  sheet.slots.standard
    .map((n, i) => (n > 0 ? `${ordinal(i + 1)}: ${n}` : ''))
    .filter(Boolean)
    .join(', ') || 'None'

const pactText = (sheet: DerivedSheet) =>
  sheet.slots.pact
    ? `${sheet.slots.pact.slots} of ${ordinal(sheet.slots.pact.level)} level`
    : 'None'

const levelText = (character: Character) =>
  character.classes.map((c) => `${c.name} ${c.level}`).join(', ')

const spellNames = (spells: SpellsByClass) =>
  Object.values(spells).flatMap((s) => [
    ...s.cantrips,
    ...s.spells,
    ...(s.spellbook ?? []),
  ])

/** The spells of the class lists the draft has and the character had not, and the reverse. */
export function spellChanges(before: Character, after: Character) {
  const key = (s: { name: string; source: string }) => `${s.name}|${s.source}`
  const had = new Set(spellNames(before.spells).map(key))
  const has = new Set(spellNames(after.spells).map(key))
  const names = (list: { name: string; source: string }[], not: Set<string>) => [
    ...new Set(list.filter((s) => !not.has(key(s))).map((s) => s.name)),
  ]
  return {
    added: names(spellNames(after.spells), had),
    removed: names(spellNames(before.spells), has),
  }
}

/** The before and after table: what the level changes, from the two derived sheets. */
export function summaryRows(
  before: { character: Character; sheet: DerivedSheet },
  after: { character: Character; sheet: DerivedSheet },
): SummaryRow[] {
  const row = (label: string, b: string | number, a: string | number): SummaryRow => ({
    label,
    before: String(b),
    after: String(a),
  })
  const rows = [
    row('Level', levelText(before.character), levelText(after.character)),
    row('Hit point maximum', before.sheet.hp.value, after.sheet.hp.value),
    row(
      'Proficiency bonus',
      formatMod(before.sheet.prof.value),
      formatMod(after.sheet.prof.value),
    ),
    row('Hit dice', hitDiceText(before.sheet), hitDiceText(after.sheet)),
    row('Armor class', before.sheet.ac.value, after.sheet.ac.value),
    row('Spell slots', slotsText(before.sheet), slotsText(after.sheet)),
    row('Pact magic slots', pactText(before.sheet), pactText(after.sheet)),
  ]
  // A row for each way of casting either sheet has: the save DC and the attack bonus.
  const stats = new Map(before.sheet.spellStats.map((s) => [s.id, s]))
  const ids = [
    ...new Set([...before.sheet.spellStats, ...after.sheet.spellStats].map((s) => s.id)),
  ]
  for (const id of ids) {
    const b = stats.get(id)
    const a = after.sheet.spellStats.find((s) => s.id === id)
    const from = (a ?? b)?.from ?? ''
    rows.push(
      row(`${from} spell save DC`, b ? b.dc.value : 'None', a ? a.dc.value : 'None'),
      row(
        `${from} spell attack`,
        b ? formatMod(b.attack.value) : 'None',
        a ? formatMod(a.attack.value) : 'None',
      ),
    )
  }
  // Rows that read "None" on both sides say nothing about this character.
  return rows.filter((r) => r.before !== 'None' || r.after !== 'None')
}

/** The checklist items the level opened: new ones, and ones with more left than before. */
export function openedChoices(
  before: readonly ChecklistItem[],
  after: readonly ChecklistItem[],
): ChecklistItem[] {
  const had = new Map(before.map((item) => [item.id, item.count]))
  return after.filter((item) => item.count > (had.get(item.id) ?? 0))
}

/** The parts of a character Level up never writes: its identity, history and play. */
const KEPT = new Set<keyof Character>([
  'id',
  'schemaVersion',
  'createdAt',
  'history',
  'updatedAt',
  'completedAt',
  'play',
  'rollCursors',
])

const isPatchKey = (key: keyof Character): key is keyof CharacterPatch => !KEPT.has(key)

function copyKey<K extends keyof CharacterPatch>(
  patch: CharacterPatch,
  key: K,
  from: Character,
) {
  patch[key] = from[key]
}

/** The build values the draft changed, as one patch for the store. */
export function levelUpPatch(before: Character, draft: Character): CharacterPatch {
  const patch: CharacterPatch = {}
  const keys = new Set([...Object.keys(before), ...Object.keys(draft)])
  for (const name of keys) {
    const key = name as keyof Character
    if (!isPatchKey(key)) continue
    if (JSON.stringify(before[key]) === JSON.stringify(draft[key])) continue
    copyKey(patch, key, draft)
  }
  return patch
}
