// Build a fillable D&D character sheet PDF from scratch with pdf-lib. Core
// fields are real AcroForm text fields (editable in any PDF reader) pre-filled
// from the character; longer lists and roleplay text are editable fields too.
// Nothing is flattened, so the exported sheet stays editable.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { ABILITIES, ABILITY_NAMES, abilityMod, formatMod } from '../dice/dice'
import type { Character } from '../character/model'
import { indexItems, resolveInventoryItem, unlistedItem } from '../character/inventory'
import { carriedWeight, carryingCapacity } from '../rules/equipment'
import type { Item } from '../data/items'
import { totalLevel } from '../character/derive'
import { proficiencyBonus } from '../data/skills'
import { hpBreakdown } from '../character/hp'
import { classEntryScores, resolveFeats } from '../character/feats'
import {
  checkLevelCap,
  checkMulticlass,
  checkOriginIncreases,
  type Deviation,
} from '../rules/compliance'
import { multiclassRequirements, type MulticlassRequirements } from '../data/class'
import { unassignedAbilities } from '../character/stats'
import { deriveSheet, type DerivedSheet } from '../derived'
import type { DeriveDeps } from '../derived/sources'
import type { Listing } from '../derived/types'

/** What the sheet is built from: the same loaded data every derived number reads. */
export type SheetDeps = DeriveDeps

const MARGIN = 40
const LABEL = rgb(0.35, 0.35, 0.4)
const INK = rgb(0.1, 0.1, 0.12)
const LINE = rgb(0.7, 0.7, 0.75)

interface Ctx {
  doc: PDFDocument
  font: PDFFont
  bold: PDFFont
  fieldIndex: number
}

function drawLabel(
  page: PDFPage,
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  size = 7,
) {
  page.drawText(text.toUpperCase(), { x, y, size, font: ctx.bold, color: LABEL })
}

function drawText(
  page: PDFPage,
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  size = 9,
  bold = false,
) {
  page.drawText(text, { x, y, size, font: bold ? ctx.bold : ctx.font, color: INK })
}

function addField(
  page: PDFPage,
  ctx: Ctx,
  value: string,
  x: number,
  y: number,
  w: number,
  h: number,
  size = 10,
  multiline = false,
) {
  const field = ctx.doc.getForm().createTextField(`f${ctx.fieldIndex++}`)
  field.setText(value)
  if (multiline) field.enableMultiline()
  field.addToPage(page, {
    x,
    y,
    width: w,
    height: h,
    font: ctx.font,
    borderColor: LINE,
    borderWidth: 0.5,
    backgroundColor: rgb(1, 1, 1),
  })
  // Set the size after the widget exists so it has an appearance to update.
  field.setFontSize(size)
}

/** Assemble the computed values the sheet needs. */
function summarize(character: Character, deps: SheetDeps) {
  const feats = resolveFeats(character, {
    feats: deps.feats ?? [],
    classByKey: deps.classByKey,
    race: deps.race,
    background: deps.background,
  })
  const derived = deriveSheet(character, deps)
  const totals = derived.totals
  const level = totalLevel(character)
  const prof = proficiencyBonus(level)
  const hp = hpBreakdown(character, deps.classByKey, feats)
  const { casters, ...slots } = derived.slots

  const rows = derived.skills

  const classLine = character.classes
    .map((c) => `${c.name}${c.subclass ? ` (${c.subclass.name})` : ''} ${c.level}`)
    .join(' / ')

  // Non-standard deviations to surface on the sheet.
  const reqBySource = new Map<string, MulticlassRequirements | undefined>()
  for (const l of deps.classByKey.values()) {
    reqBySource.set(`${l.entry.name}|${l.entry.source}`, multiclassRequirements(l.entry))
  }
  const unset = unassignedAbilities(character.abilities, character.statMethod)
  const deviations: Deviation[] = [
    ...checkMulticlass(
      character.classes,
      reqBySource,
      classEntryScores(character, feats),
      unset,
    ),
    ...checkLevelCap(level),
    ...checkOriginIncreases(character, deps.race, deps.background),
  ]

  return {
    totals,
    level,
    prof,
    rows,
    hp,
    slots,
    casters,
    classLine,
    deviations,
    derived,
  }
}

/** One line for each attack: "Longsword +5, 1d8 + 3 slashing (1d10 + 3 with two hands)". */
export function attackLines(derived: DerivedSheet): string[] {
  const damage = (dice: string, bonus: number) =>
    dice === ''
      ? String(bonus)
      : bonus === 0
        ? dice
        : `${dice} ${bonus < 0 ? '-' : '+'} ${Math.abs(bonus)}`
  return derived.attacks.map((a) => {
    const two = a.twoHanded
      ? ` (${damage(a.twoHanded.dice, a.twoHanded.bonus.value)} with two hands)`
      : ''
    const types = a.damage.types ? ` ${a.damage.types}` : ''
    return `${a.name} ${formatMod(a.toHit.value)}, ${damage(a.damage.dice, a.damage.bonus.value)}${types}${two}`
  })
}

/** One line for each kind of proficiency the sheet has: "Armor: Light armor, Shields". */
export function proficiencyLines(derived: DerivedSheet): string[] {
  const { listing, open } = derived.proficiencies
  const kinds: [string, Listing[]][] = [
    ['Saving throws', listing.save],
    ['Armor', listing.armor],
    ['Weapons', listing.weapon],
    ['Tools', listing.tool],
    ['Languages', listing.language],
  ]
  return [
    ...kinds
      .filter(([, rows]) => rows.length > 0)
      .map(([name, rows]) => `${name}: ${rows.map((r) => r.value).join(', ')}`),
    ...open.map((o) => `To choose - ${o.block.card.name}: ${o.spec.text}`),
  ]
}

/** One line for each spellcasting ability: "Wizard: spell save DC 14, spell attack +6". */
export function spellStatLines(derived: DerivedSheet): string[] {
  return derived.spellStats.map(
    (r) =>
      `${r.from}: spell save DC ${r.dc.value}, spell attack ${formatMod(r.attack.value)}`,
  )
}

const oneDecimal = (n: number) => Math.round(n * 10) / 10

/**
 * What the sheet says of the inventory: one line of the items, with their quantity
 * and whether they are equipped or attuned to, and, when the catalog is given, how
 * much is carried against what can be.
 */
export function equipmentLines(
  character: Character,
  items: readonly Item[] | undefined,
  strength: number,
  size?: string,
): { items: string; carried?: string } {
  const stacks = character.equipment.items
  const list =
    stacks
      .map(
        (i) =>
          `${i.name} ×${i.quantity}${i.equipped ? ' (equipped)' : ''}${i.attuned ? ' (attuned)' : ''}`,
      )
      .join(', ') || '-'
  if (!items) return { items: list }
  const catalog = indexItems(items)
  const weights = stacks.map((stack) => ({
    quantity: stack.quantity,
    weight: (resolveInventoryItem(stack, catalog) ?? unlistedItem(stack)).weight,
  }))
  const carried = carriedWeight(weights, character.equipment.currency)
  const capacity = strength > 0 ? ` of ${carryingCapacity(strength, size)}` : ''
  const unlisted =
    carried.unlisted === 0
      ? ''
      : carried.unlisted === 1
        ? '; 1 item has no listed weight'
        : `; ${carried.unlisted} items have no listed weight`
  return {
    items: list,
    carried: `Carried ${oneDecimal(carried.pounds)}${capacity} lb${unlisted}`,
  }
}

/** Generate the character-sheet PDF and return its bytes. */
export async function buildCharacterSheet(
  character: Character,
  deps: SheetDeps,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const ctx: Ctx = { doc, font, bold, fieldIndex: 0 }
  const s = summarize(character, deps)

  // ---- Page 1: identity, abilities, combat, saves, skills ----
  const p1 = doc.addPage([612, 792])
  const { width, height } = p1.getSize()
  let y = height - MARGIN

  drawText(p1, ctx, 'D&D Character Sheet', MARGIN, y, 16, true)
  y -= 22
  addField(p1, ctx, character.name, MARGIN, y - 4, 260, 20, 12)
  drawLabel(p1, ctx, 'Character Name', MARGIN, y + 18)
  addField(
    p1,
    ctx,
    s.classLine,
    MARGIN + 270,
    y - 4,
    width - MARGIN - (MARGIN + 270),
    20,
    10,
  )
  drawLabel(p1, ctx, 'Class & Level', MARGIN + 270, y + 18)

  y -= 34
  const idW = (width - 2 * MARGIN - 20) / 3
  const idData: [string, string][] = [
    ['Race', character.race?.name ?? ''],
    ['Background', character.background?.name ?? ''],
    ['Alignment', character.story.alignment],
  ]
  idData.forEach(([label, value], i) => {
    const x = MARGIN + i * (idW + 10)
    drawLabel(p1, ctx, label, x, y + 16)
    addField(p1, ctx, value, x, y - 4, idW, 18, 10)
  })

  // Abilities column (left) + combat box (right)
  y -= 40
  drawLabel(p1, ctx, 'Ability Scores', MARGIN, y + 8)
  let ay = y
  for (const key of ABILITIES) {
    const score = s.totals[key]
    const mod = abilityMod(score)
    drawText(p1, ctx, ABILITY_NAMES[key], MARGIN, ay - 9, 9, true)
    addField(p1, ctx, String(score), MARGIN + 80, ay - 12, 36, 18, 10)
    drawText(p1, ctx, `mod ${formatMod(mod)}`, MARGIN + 122, ay - 9, 9)
    const save = s.derived.saves[key]
    drawText(
      p1,
      ctx,
      `save ${formatMod(save.total.value)}${save.proficient ? ' •' : ''}`,
      MARGIN + 175,
      ay - 9,
      9,
    )
    ay -= 24
  }

  // Combat box on the right
  const cx = MARGIN + 300
  drawLabel(p1, ctx, 'Combat', cx, y + 8)
  const combat: [string, string][] = [
    ['Proficiency Bonus', formatMod(s.prof)],
    ['Armor Class', String(s.derived.ac.value)],
    ['Initiative', formatMod(s.derived.combat.initiative.value)],
    ['Speed', ''],
    ['Hit Points (avg)', String(s.hp.averageHP || '')],
    ['Total Level', String(s.level)],
  ]
  let cy = y
  combat.forEach(([label, value]) => {
    drawLabel(p1, ctx, label, cx, cy - 2, 7)
    addField(p1, ctx, value, cx + 130, cy - 6, 60, 16, 9)
    cy -= 22
  })

  // Skills list (below abilities)
  y = ay - 12
  drawLabel(p1, ctx, 'Skills', MARGIN, y + 8)
  y -= 4
  const colW = (width - 2 * MARGIN) / 2
  s.rows.forEach((row, i) => {
    const col = i % 2
    const rowY = y - Math.floor(i / 2) * 15
    const x = MARGIN + col * colW
    // Use WinAnsi-safe markers (Helvetica can't encode ●/○).
    const marker = row.proficient ? '•' : '  '
    drawText(p1, ctx, `${marker} ${row.label}`, x, rowY, 9)
    drawText(p1, ctx, formatMod(row.total.value), x + colW - 40, rowY, 9, true)
  })

  // ---- Page 2: spells, equipment, story, deviations ----
  const p2 = doc.addPage([612, 792])
  let y2 = p2.getSize().height - MARGIN

  drawText(p2, ctx, 'Spells & Equipment', MARGIN, y2, 14, true)
  y2 -= 22

  // Spell slots
  if (s.slots.maxSpellLevel > 0) {
    const slotStr = s.slots.standard
      .map((n, i) => (n > 0 ? `L${i + 1}:${n}` : ''))
      .filter(Boolean)
      .join('  ')
    const pactStr = s.slots.pact
      ? `  Pact: ${s.slots.pact.slots}×L${s.slots.pact.level}`
      : ''
    drawLabel(p2, ctx, 'Spell Slots', MARGIN, y2 + 8)
    drawText(p2, ctx, slotStr + pactStr, MARGIN, y2 - 4, 9)
    y2 -= 22
  }

  for (const caster of s.casters) {
    const sel = character.spells[caster.classKey]
    if (!sel) continue
    const cantrips = sel.cantrips.map((c) => c.name).join(', ')
    const spells = sel.spells.map((c) => c.name).join(', ')
    drawText(p2, ctx, caster.name, MARGIN, y2, 10, true)
    y2 -= 14
    y2 = drawWrapped(
      p2,
      ctx,
      `Cantrips: ${cantrips || '-'}`,
      MARGIN,
      y2,
      width - 2 * MARGIN,
      8,
    )
    y2 = drawWrapped(
      p2,
      ctx,
      `Spells: ${spells || '-'}`,
      MARGIN,
      y2,
      width - 2 * MARGIN,
      8,
    )
    y2 -= 6
  }

  // Attacks and spellcasting numbers
  drawLabel(p2, ctx, 'Attacks', MARGIN, y2 + 6)
  y2 -= 8
  for (const line of [...attackLines(s.derived), ...spellStatLines(s.derived)]) {
    y2 = drawWrapped(p2, ctx, line, MARGIN, y2, width - 2 * MARGIN, 9)
  }
  y2 -= 8

  // Proficiencies other than skills
  const profLines = proficiencyLines(s.derived)
  if (profLines.length > 0) {
    drawLabel(p2, ctx, 'Proficiencies', MARGIN, y2 + 6)
    y2 -= 8
    for (const line of profLines) {
      y2 = drawWrapped(p2, ctx, line, MARGIN, y2, width - 2 * MARGIN, 9)
    }
    y2 -= 8
  }

  // Equipment
  drawLabel(p2, ctx, 'Equipment', MARGIN, y2 + 6)
  y2 -= 8
  const coins = character.equipment.currency
  drawText(
    p2,
    ctx,
    `Coins - PP ${coins.pp}  GP ${coins.gp}  EP ${coins.ep}  SP ${coins.sp}  CP ${coins.cp}`,
    MARGIN,
    y2,
    9,
  )
  y2 -= 14
  const carry = equipmentLines(character, deps.items, s.totals.str, deps.race?.size?.[0])
  if (carry.carried) {
    drawText(p2, ctx, carry.carried, MARGIN, y2, 9)
    y2 -= 14
  }
  y2 = drawWrapped(p2, ctx, carry.items, MARGIN, y2, width - 2 * MARGIN, 8)
  y2 -= 8

  // Roleplay (editable multiline fields)
  const storyFields: [string, string][] = [
    ['Personality Traits', character.story.personalityTraits],
    ['Ideals', character.story.ideals],
    ['Bonds', character.story.bonds],
    ['Flaws', character.story.flaws],
    ['Backstory', character.story.backstory],
  ]
  for (const [label, value] of storyFields) {
    drawLabel(p2, ctx, label, MARGIN, y2)
    y2 -= 4
    const h = label === 'Backstory' ? 80 : 30
    addField(p2, ctx, value, MARGIN, y2 - h, width - 2 * MARGIN, h, 9, true)
    y2 -= h + 12
  }

  // Deviations
  if (s.deviations.length > 0) {
    drawLabel(p2, ctx, 'Non-standard (DM approval)', MARGIN, y2)
    y2 -= 12
    for (const d of s.deviations) {
      y2 = drawWrapped(p2, ctx, `• ${d.message}`, MARGIN, y2, width - 2 * MARGIN, 8)
    }
  }

  return doc.save()
}

/** Draw text wrapped to a width, returning the new y below it. */
function drawWrapped(
  page: PDFPage,
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
): number {
  const words = text.split(' ')
  let line = ''
  let cy = y
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.font.widthOfTextAtSize(test, size) > maxWidth && line) {
      drawText(page, ctx, line, x, cy, size)
      cy -= size + 3
      line = word
    } else {
      line = test
    }
  }
  if (line) {
    drawText(page, ctx, line, x, cy, size)
    cy -= size + 3
  }
  return cy
}
