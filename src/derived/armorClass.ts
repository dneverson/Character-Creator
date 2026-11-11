// Armor class, line by line. The base is the best of the ways the character has to
// work it out (worn armor with its Dexterity limit, 10 + Dexterity unarmored, every
// unarmored formula and natural armor its class, species, feats and items give); the
// ways not used are listed greyed with the number they would give. Then come the shield,
// the magic bonuses of what is worn or wielded, the bonuses of feats, styles and species,
// and the player's own adjustment. Anything against the rules (armor without proficiency,
// too little Strength) is a flagged line with its consequence; nothing is ever blocked.

import { ABILITY_NAMES, abilityMod, formatMod, type AbilityKey } from '../dice/dice'
import { strengthNeeded } from '../rules/equipment'
import { AC_RULES, acRuleId, type AcRequirement, type AcRule } from '../rules/acRules'
import type { ArmorKind } from '../rules/proficiencyGrants'
import { itemBonus } from './itemBonus'
import { armorProficiency, isArmorItem, type Proficiencies } from './proficiencies'
import { heldBy, type HeldItem, type Sources } from './sources'
import {
  BASE_SOURCE,
  quantity,
  sumLines,
  type Line,
  type Quantity,
  type SourceRef,
} from './types'

export type AbilityTotals = Record<AbilityKey, number>

export const AC_MANUAL = 'ac|manual'

const MEDIUM_DEX_CAP = 2
const UNARMORED_BASE = 10

const KIND_NAMES: Record<ArmorKind, string> = {
  light: 'light armor',
  medium: 'medium armor',
  heavy: 'heavy armor',
  shield: 'shields',
}

const NOT_PROFICIENT =
  'Disadvantage on any ability check, saving throw or attack roll that uses Strength or Dexterity, and you cannot cast spells.'

interface Candidate {
  id: string
  label: string
  lines: Line[]
  /** Why the way is not open to the character, when it is not. */
  blocked?: string
}

const total = (c: Candidate) => sumLines(c.lines)

const abilityLine = (id: string, key: AbilityKey, mod: number, how?: string): Line => ({
  id: `${id}|${key}`,
  label: ABILITY_NAMES[key],
  source: BASE_SOURCE,
  op: 'add',
  status: 'applied',
  how: how ?? `${ABILITY_NAMES[key]} ${formatMod(mod)}`,
  amount: mod,
})

/** The way armor is worn: its base plus the Dexterity the armor allows. */
function armorCandidate(
  worn: HeldItem,
  totals: AbilityTotals,
  sources: Sources,
): Candidate {
  const armor = worn.item.armor
  const dex = abilityMod(totals.dex)
  const id = `ac|armor|${worn.item.key}`
  const own = AC_RULES.some(
    (r) =>
      r.effect.kind === 'noDexCap' &&
      'item' in r.holder &&
      r.holder.item === worn.item.key,
  )
  const master = AC_RULES.find(
    (r) => r.effect.kind === 'mediumDexCap' && heldBy(sources, r.holder),
  )
  let cap: number | undefined
  let capWhy = ''
  // A cap of the data that is the plain medium-armor cap is the one Medium Armor Master raises.
  const standard =
    armor?.class === 'medium' &&
    !own &&
    (armor.dexterityMax === undefined || armor.dexterityMax === MEDIUM_DEX_CAP)
  if (standard) {
    const raised =
      master?.effect.kind === 'mediumDexCap' && totals.dex >= master.effect.minDex
    cap =
      raised && master?.effect.kind === 'mediumDexCap'
        ? master.effect.cap
        : MEDIUM_DEX_CAP
    capWhy = `limited to ${formatMod(cap)} in medium armor${raised ? ' (Medium Armor Master)' : ''}`
  } else if (armor?.dexterityMax !== undefined) {
    cap = armor.dexterityMax
    capWhy = `limited to ${formatMod(cap)} by the armor`
  }
  const lines: Line[] = [
    {
      id,
      label: 'Armor',
      source: worn.source,
      op: 'base',
      status: 'applied',
      how: `${worn.item.name}: base ${armor?.base}`,
      amount: armor?.base ?? 0,
    },
  ]
  if (armor?.class === 'heavy') {
    lines.push({
      ...abilityLine(id, 'dex', 0, 'Heavy armor adds no Dexterity'),
      amount: 0,
    })
  } else {
    const used = cap === undefined ? dex : Math.min(dex, cap)
    lines.push(
      abilityLine(
        id,
        'dex',
        used,
        `Dexterity ${formatMod(dex)}${cap !== undefined && dex > cap ? `, ${capWhy}` : ''}`,
      ),
    )
  }
  return { id, label: worn.item.name, lines }
}

/** The ways the rules tables give to work out the base. */
function formulaCandidates(
  sources: Sources,
  totals: AbilityTotals,
  bodyArmor: boolean,
  shield: boolean,
): { candidate: Candidate; rule: AcRule; source: SourceRef; useless: boolean }[] {
  return AC_RULES.flatMap((rule) => {
    const e = rule.effect
    if (e.kind !== 'base') return []
    const held = heldBy(sources, rule.holder)
    if (!held) return []
    const item = sources.items.find(
      (i) => 'item' in rule.holder && i.item.key === rule.holder.item,
    )
    const id = `ac|base|${acRuleId(rule)}`
    const lines: Line[] = [
      {
        id,
        label: rule.label,
        source: held.source,
        op: 'base',
        status: 'applied',
        text: rule.text,
        how: `Base ${e.base}`,
        amount: e.base,
      },
      ...e.abilities.map((a) => {
        const mod = abilityMod(totals[a])
        return a === 'dex' && e.dexMax !== undefined && mod > e.dexMax
          ? abilityLine(
              id,
              a,
              e.dexMax,
              `Dexterity ${formatMod(mod)}, limited to ${formatMod(e.dexMax)}`,
            )
          : abilityLine(id, a, mod)
      }),
    ]
    const blocked =
      item && !item.active
        ? 'Needs attunement, and you are not attuned.'
        : e.unarmored && bodyArmor
          ? 'Only while you wear no armor.'
          : e.noShield && shield
            ? 'Not while you use a shield.'
            : undefined
    return [
      {
        candidate: { id, label: rule.label, lines, blocked },
        rule,
        source: held.source,
        useless: e.armorUseless === true,
      },
    ]
  })
}

/** Whether what the character wears and wields meets what a bonus asks. */
function meets(
  req: AcRequirement | undefined,
  state: { armor?: HeldItem; shield: boolean; melee: number; weapons: string[] },
): { ok: boolean; why: string } {
  const worn = state.armor
  switch (req) {
    case undefined:
      return { ok: true, why: '' }
    case 'armor':
      return { ok: !!worn, why: 'Needs armor worn.' }
    case 'heavyArmor':
      return { ok: worn?.item.armor?.class === 'heavy', why: 'Needs heavy armor worn.' }
    case 'noArmor':
      return { ok: !worn, why: 'Only while you wear no armor.' }
    case 'noHeavyArmor':
      return { ok: worn?.item.armor?.class !== 'heavy', why: 'Not in heavy armor.' }
    case 'noArmorNoShield':
      return { ok: !worn && !state.shield, why: 'Only with no armor and no shield.' }
    case 'noShield':
      return { ok: !state.shield, why: 'Not while you use a shield.' }
    case 'twoMeleeWeapons':
      return { ok: state.melee >= 2, why: 'Needs a melee weapon in each hand.' }
    default:
      return {
        ok: state.weapons.some((w) => w.includes(req.weapon)),
        why: `Needs a ${req.weapon} held.`,
      }
  }
}

const bonusLine = (rule: AcRule, source: SourceRef): Line => {
  const e = rule.effect
  return {
    id: `ac|add|${acRuleId(rule)}`,
    label: rule.label,
    source,
    op: 'add',
    status: 'applied',
    text: rule.text,
    amount: e.kind === 'add' ? e.amount : 0,
  }
}

function hasMageArmor(sources: Sources): boolean {
  return Object.values(sources.character.spells).some((sel) =>
    sel.spells.some((s) => s.name === 'Mage Armor'),
  )
}

export function armorClass(
  sources: Sources,
  totals: AbilityTotals,
  prof: Proficiencies,
): Quantity {
  const dex = abilityMod(totals.dex)
  const worn = sources.items.filter(
    (i) => isArmorItem(i.item) && i.item.armor?.base !== undefined,
  )
  const shields = sources.items.filter((i) => i.item.armor?.class === 'shield')
  const weapons = sources.items.filter((i) => i.item.weapon)

  const armorCandidates = worn.map((w) => ({ w, c: armorCandidate(w, totals, sources) }))
  const best = armorCandidates.reduce<(typeof armorCandidates)[number] | undefined>(
    (a, b) => (!a || total(b.c) > total(a.c) ? b : a),
    undefined,
  )
  const shield = shields.reduce<HeldItem | undefined>(
    (a, b) => (!a || (b.item.armor?.bonus ?? 0) > (a.item.armor?.bonus ?? 0) ? b : a),
    undefined,
  )
  const formulas = formulaCandidates(sources, totals, worn.length > 0, !!shield)
  const useless = formulas.some((f) => f.useless && !f.candidate.blocked)

  // Every way to work out the base, in the order a tie is settled.
  const candidates: Candidate[] = [
    ...(best
      ? [useless ? { ...best.c, blocked: 'You gain no benefit from armor.' } : best.c]
      : []),
    ...formulas.map((f) => f.candidate),
    ...(worn.length === 0
      ? [
          {
            id: 'ac|unarmored',
            label: 'Unarmored',
            lines: [
              {
                id: 'ac|unarmored',
                label: 'Unarmored',
                source: BASE_SOURCE,
                op: 'base' as const,
                status: 'applied' as const,
                how: `Base ${UNARMORED_BASE}`,
                amount: UNARMORED_BASE,
              },
              abilityLine('ac|unarmored', 'dex', dex),
            ],
          },
        ]
      : []),
  ]
  const open = candidates.filter((c) => !c.blocked)
  const winner = open.reduce<Candidate | undefined>(
    (a, b) => (!a || total(b) > total(a) ? b : a),
    undefined,
  )

  const lines: Line[] = winner ? [...winner.lines] : []
  const usedArmor = winner && best && winner.id === best.c.id ? best.w : undefined
  const armorWorn = best && !useless ? best.w : undefined
  const state = {
    armor: armorWorn,
    shield: !!shield,
    melee: weapons
      .filter((w) => w.item.weapon?.melee)
      .reduce((n, w) => n + Math.max(1, w.stack.quantity), 0),
    weapons: weapons.map((w) => w.item.name.toLowerCase()),
  }

  // The shield.
  if (shield) {
    lines.push({
      id: `ac|shield|${shield.item.key}`,
      label: 'Shield',
      source: shield.source,
      op: 'add',
      status: 'applied',
      how: shield.item.name,
      amount: shield.item.armor?.bonus ?? 2,
    })
  }

  // The magic bonuses of what is worn or wielded.
  for (const held of sources.items) {
    const overridden = AC_RULES.some(
      (r) =>
        (r.effect.kind === 'add' || r.effect.kind === 'ignoreStructuredBonus') &&
        'item' in r.holder &&
        r.holder.item === held.item.key,
    )
    const amount = overridden ? 0 : itemBonus(held.item, 'bonusAc')
    if (amount === 0) continue
    const unused =
      (isArmorItem(held.item) && held !== usedArmor) ||
      (held.item.armor?.class === 'shield' && held !== shield)
    lines.push({
      id: `ac|magic|${held.item.key}`,
      label: 'Magic bonus',
      source: held.source,
      op: 'add',
      amount,
      status: !held.active || unused ? 'inactive' : 'applied',
      why: !held.active
        ? 'Needs attunement, and you are not attuned.'
        : unused
          ? 'Not the armor or shield that counts.'
          : undefined,
    })
  }

  // The bonuses the tables give (feats, styles, species, items).
  for (const rule of AC_RULES) {
    if (rule.effect.kind !== 'add') continue
    const held = heldBy(sources, rule.holder)
    if (!held) continue
    const line = bonusLine(rule, held.source)
    const item = sources.items.find(
      (i) => 'item' in rule.holder && i.item.key === rule.holder.item,
    )
    const need = meets(rule.effect.requires, state)
    if (item && !item.active) {
      lines.push({
        ...line,
        status: 'inactive',
        why: 'Needs attunement, and you are not attuned.',
      })
    } else if (!need.ok) {
      lines.push({ ...line, status: 'inactive', why: need.why })
    } else lines.push(line)
  }

  // The player's own adjustment.
  const manual = sources.character.manualBonuses?.ac ?? 0
  lines.push({
    id: AC_MANUAL,
    label: 'Other bonus',
    source: { kind: 'manual', tag: 'manual', label: '' },
    op: 'add',
    status: 'applied',
    badge: 'Manual',
    amount: manual,
  })

  // The ways not used, greyed with what they would give.
  const winnerTotal = winner ? total(winner) : 0
  for (const c of candidates) {
    if (c === winner) continue
    const base = c.lines[0]
    lines.push({
      id: `ac|alt|${c.id}`,
      label: c.label,
      source: base.source,
      op: 'alt',
      status: 'inactive',
      how: c.lines
        .map((l, i) =>
          i === 0 ? `${l.label} ${l.amount}` : `${l.label} ${formatMod(l.amount ?? 0)}`,
        )
        .join(', '),
      amount: c.blocked ? undefined : total(c),
      why: c.blocked ?? `Lower than ${winner?.label}: ${winnerTotal}.`,
    })
  }
  if (hasMageArmor(sources) && worn.length === 0) {
    lines.push({
      id: 'ac|alt|mage-armor',
      label: 'Mage Armor (if cast)',
      source: { kind: 'base', tag: 'spell:Mage Armor', label: 'Mage Armor' },
      op: 'alt',
      status: 'inactive',
      how: `Base 13, Dexterity ${formatMod(dex)}`,
      amount: 13 + dex,
      why: 'A spell you cast on yourself: counted only while it lasts, so not added here.',
    })
  }

  // What is against the rules, with its consequence.
  const flag = (id: string, label: string, why: string): Line => ({
    id: `ac|flag|${id}`,
    label,
    source: BASE_SOURCE,
    op: 'note',
    status: 'flag',
    why,
  })
  if (armorWorn?.item.armor) {
    const a = armorWorn.item.armor
    const kind = a.class
    if (kind && kind !== 'shield' && !armorProficiency(prof, kind)) {
      lines.push(
        flag(
          'armor-proficiency',
          `Not proficient with ${KIND_NAMES[kind]}`,
          NOT_PROFICIENT,
        ),
      )
    }
    const needed = strengthNeeded(a.strength, totals.str)
    if (needed !== undefined) {
      lines.push(
        flag(
          'strength',
          `${armorWorn.item.name} needs Strength ${needed}`,
          `You have ${totals.str}: your speed is reduced by 10 feet.`,
        ),
      )
    }
    const mediumMaster = AC_RULES.some(
      (r) => r.effect.kind === 'mediumDexCap' && heldBy(sources, r.holder),
    )
    if (a.stealth && !(kind === 'medium' && mediumMaster)) {
      lines.push(
        flag(
          'stealth',
          `${armorWorn.item.name} hampers stealth`,
          'You have disadvantage on Dexterity (Stealth) checks.',
        ),
      )
    }
  }
  if (shield && !armorProficiency(prof, 'shield')) {
    lines.push(flag('shield-proficiency', 'Not proficient with shields', NOT_PROFICIENT))
  }
  if (worn.length > 1) {
    lines.push(
      flag(
        'two-armors',
        'More than one suit of armor equipped',
        'Only one suit can be worn: the one that gives the best armor class is counted.',
      ),
    )
  }
  if (shields.length > 1) {
    lines.push(
      flag('two-shields', 'More than one shield equipped', 'Only one shield counts.'),
    )
  }
  if (
    shield &&
    weapons.some((w) => w.item.weapon?.properties.some((p) => p.code === '2H'))
  ) {
    lines.push(
      flag(
        'shield-two-handed',
        'A shield and a two-handed weapon',
        'A two-handed weapon needs both hands, so it cannot be used while a shield is held.',
      ),
    )
  }
  return quantity(lines)
}
