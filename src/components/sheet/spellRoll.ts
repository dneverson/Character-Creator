// What a spell of the sheet rolls: the roll window of a spell that deals damage or heals.
// A spell attack rolls to hit and then damage, like a weapon; a save spell says the save
// and its DC and rolls the damage; the rest roll the damage or the healing. The dice come
// from the spell's own data (data/spellRoll.ts); the sheet adds the numbers it knows: the
// spell attack bonus, the save DC, the spellcasting modifier and what class options add.

import { abilityMod, ABILITY_NAMES, formatMod } from '../../dice/dice'
import type { SpellStatRow } from '../../derived/spellStats'
import type { DerivedSheet } from '../../derived'
import {
  resolveCast,
  spellRollPlan,
  variantsAt,
  type Piece,
  type SpellRollPlan,
} from '../../data/spellRoll'
import { ordinal } from '../../data/spellText'
import { BASE_SOURCE, quantity, type Line } from '../../derived/types'
import { tablesOf } from '../derived/breakdownTables'
import type { BreakdownSpec } from '../derived/DerivedNumber'
import { damageAddedBy, changesOf } from '../editor/spellLineFacts'
import type { SpellLine } from '../editor/SpellLines'
import type { BreakdownTable } from './SheetDetail'
import { testRoll, type DamageSpec, type RollChoice, type RollSpec } from './rollSpec'

/** How the spell attack bonus of a casting ability adds up. */
export const spellAttackSpec = (row: SpellStatRow): BreakdownSpec => ({
  id: `spell:${row.id}:attack`,
  label: `${row.from} spell attack bonus`,
  amountHeader: 'Spell attack bonus',
  quantity: row.attack,
  format: formatMod,
})

/** How the spell save DC of a casting ability adds up. */
const spellSaveSpec = (row: SpellStatRow): BreakdownSpec => ({
  id: `spell:${row.id}:dc`,
  label: `${row.from} spell save DC`,
  amountHeader: 'Spell save DC',
  quantity: row.dc,
})

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** The levels a leveled spell can be cast at: its own, and each higher one with a slot. */
function castLevels(spellLevel: number, sheet: DerivedSheet): number[] {
  const { standard, pact } = sheet.slots
  const higher = standard.flatMap((slots, at) =>
    slots > 0 && at + 1 > spellLevel ? [at + 1] : [],
  )
  if (pact && pact.slots > 0 && pact.level > spellLevel) higher.push(pact.level)
  return [...new Set([spellLevel, ...higher])].sort((a, b) => a - b)
}

/** The casting ability a spell line uses: the one of what gives it, else the first. */
const statRowOf = (line: SpellLine, sheet: DerivedSheet) =>
  sheet.spellStats.find((row) => line.from.includes(row.from)) ?? sheet.spellStats[0]

const note = (id: string, label: string): Line => ({
  id,
  label,
  source: BASE_SOURCE,
  op: 'note',
  status: 'applied',
})

/** One part of a cast as an expression to roll: "8d6", "1d4+1", "2d8+3". */
function expressionOf(piece: Piece, flat: number, times: number): string {
  const dice = piece.dice.map((d) => `${d.count * times}d${d.sides}`).join('+')
  const bonus = flat * times
  return bonus === 0 ? dice : `${dice}${bonus > 0 ? '+' : ''}${bonus}`
}

/** What a spell rolls to hit, to save against or to heal, as the window is opened. */
export function spellRoll(
  line: SpellLine,
  sheet: DerivedSheet,
  characterLevel: number,
): RollSpec | undefined {
  const { spell } = line
  const plan = spellRollPlan(spell)
  const row = statRowOf(line, sheet)
  if (!plan || line.locked || !row) return undefined

  const mod = abilityMod(sheet.totals[row.ability])
  const levels = spell.level > 0 ? castLevels(spell.level, sheet) : []
  const variants = variantsAt(plan, characterLevel)
  const choices = choicesOf(plan, levels, variants)
  const verb = plan.action === 'healing' ? 'healing' : 'damage'

  const damageFor = (picked: Record<string, string>): DamageSpec => {
    const slotLevel = Number(picked.level ?? spell.level)
    const cast = resolveCast(plan, { characterLevel, slotLevel, variant: picked.variant })
    // A projectile of a spell that always hits rolls with the rest; each beam or ray of an
    // attack is its own attack and its own damage roll.
    const together = plan.action === 'auto' ? (cast.projectiles?.count ?? 1) : 1
    const added = damageAddedBy(line)
    const lines: Line[] = [
      ...cast.lines.map((text, at) => note(`${spell.key}|cast|${at}`, text)),
      ...(cast.pieces.some((p) => p.addsModifier)
        ? [
            {
              ...note(`${spell.key}|mod`, ABILITY_NAMES[row.ability]),
              op: 'add' as const,
              amount: mod,
              how: `Your spellcasting ability modifier, ${formatMod(mod)}`,
            },
          ]
        : []),
      ...changesOf(line, 'damage'),
    ]
    const table: BreakdownTable[] =
      lines.length === 0
        ? []
        : [
            {
              quantity: quantity(lines),
              ariaLabel: `${spell.name} ${verb}`,
              amountHeader: `${capital(verb)} bonus`,
              totalLabel: `Flat ${verb} bonus`,
              format: formatMod,
            },
          ]
    const count = cast.projectiles?.count ?? 1
    const noun = cast.projectiles?.noun
    const detail = [
      cast.variant !== '' && variants.length > 1 ? cast.variant : '',
      spell.level > 0 ? `level ${slotLevel}` : '',
    ]
      .filter(Boolean)
      .join(', ')
    return {
      name: spell.name,
      ...(detail && { detail }),
      verb,
      pieces: cast.pieces.map((piece, at) => ({
        type: piece.type,
        expression: expressionOf(
          piece,
          piece.flat + (piece.addsModifier ? mod : 0) + (at === 0 ? added : 0),
          together,
        ),
      })),
      tables: table,
      parts: [],
      ...(noun &&
        count > 1 && {
          note:
            plan.action === 'attack'
              ? `${count} ${noun}s at this level: make an attack roll and a damage roll for each.`
              : `${count} ${noun}s, rolled together.`,
        }),
    }
  }

  const initial: Record<string, string> = Object.fromEntries(
    choices.map((choice) => [choice.id, choice.initial]),
  )
  const rest = {
    damage: damageFor(initial),
    ...(choices.length > 0 && { choices, damageFor }),
  }
  if (plan.action === 'attack') {
    return testRoll(`${spell.name} attack`, spellAttackSpec(row), rest)
  }
  const saveSpec = spellSaveSpec(row)
  return {
    kind: 'damage',
    label: `${spell.name} ${verb}`,
    modifier: 0,
    tables: plan.action === 'save' ? tablesOf(saveSpec) : [],
    parts: [],
    ...(plan.action === 'save' && {
      note: `Targets make a ${plan.save.join(' or ')} saving throw against DC ${row.dc.value}.`,
    }),
    ...rest,
  }
}

/** What the player picks: the level a leveled spell is cast at, and a cantrip's variant. */
function choicesOf(
  plan: SpellRollPlan,
  levels: number[],
  variants: string[],
): RollChoice[] {
  return [
    ...(levels.length > 1
      ? [
          {
            id: 'level',
            label: 'Cast at level',
            options: levels.map((level) => ({
              value: String(level),
              label: `${ordinal(level)} level`,
            })),
            initial: String(plan.level),
            list: true,
          },
        ]
      : []),
    ...(variants.length > 1
      ? [
          {
            id: 'variant',
            label: 'Which damage',
            options: variants.map((label) => ({ value: label, label: capital(label) })),
            initial: variants[0],
          },
        ]
      : []),
  ]
}
