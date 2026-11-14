// The limited uses the character has: each feature's counter from the rules table, each
// spell the data lets it cast a number of times per rest, and each equipped item with
// charges. The maximum is worked out here from the build and never stored; the play state
// keeps only what was spent, by the counter's id.

import { ABILITY_NAMES, abilityMod } from '../dice/dice'
import { subclassOf, type ClassTableGroup } from '../data/class'
import type { SpellGrant } from '../character/spellGrants'
import { holderId, type Holder } from '../rules/holder'
import {
  RESOURCE_CHANGES,
  RESOURCE_RULES,
  type Recharge,
  type ResourceRule,
  type UseCount,
} from '../rules/resources'
import type { Entry } from '../text/Entries'
import { stripTags } from '../text/tags'
import type { AbilityTotals } from './armorClass'
import { cellText } from './classLevelTable'
import { heldBy, type Held, type Sources } from './sources'

export interface DerivedResource {
  /** The key of the play state's spent count. */
  id: string
  label: string
  /** What gives it: the class, the feat, the species, the item. */
  from: string
  /** The feature row it belongs to (`FeatureRow.anchor`), when it has one. */
  anchor?: string
  kind: 'feature' | 'spell' | 'item'
  /** The uses; undefined when unlimited (a Barbarian's rages at 20th level, 2014). */
  max?: number
  recharge: Recharge
  /** Uses a short rest restores on top of the recharge. */
  shortRegain: number
  /** How the maximum is worked out: "Rages column at class level 5". */
  basis: string
  /** What restores the uses, in words. */
  restores: string
  /** The text of what gives it, for the detail pane. */
  entries: Entry[]
}

/** What a count is read against. */
export interface CountContext {
  totals: AbilityTotals
  prof: number
  /** The holder's class level; 0 for a feat, a species or an option. */
  level: number
  /** The holder's class or subclass level tables. */
  tables: readonly ClassTableGroup[]
}

/** The uses a count gives, with how; `max` undefined means unlimited. */
export function countUses(
  count: UseCount,
  ctx: CountContext,
): { max?: number; basis: string } {
  switch (count.kind) {
    case 'fixed':
      return { max: count.count, basis: `${count.count}` }
    case 'prof':
      return {
        max: ctx.prof * count.times,
        basis:
          count.times === 1 ? 'Proficiency bonus' : `${count.times} x proficiency bonus`,
      }
    case 'ability': {
      const mod = abilityMod(ctx.totals[count.ability])
      const name = `${ABILITY_NAMES[count.ability]} modifier`
      const base = count.times === 1 ? name : `${count.times} x ${name}`
      return {
        max: Math.max(count.min, count.times * mod + count.plus),
        basis: `${count.plus ? `${count.plus} + ` : ''}${base}${count.min > 0 ? `, at least ${count.min}` : ''}`,
      }
    }
    case 'byLevel': {
      const step = [...count.steps].reverse().find(([from]) => ctx.level >= from)
      return {
        max: step?.[1] ?? 0,
        basis: count.steps.map(([from, n]) => `${n} from class level ${from}`).join(', '),
      }
    }
    case 'perLevel':
      return {
        max: count.times * ctx.level + count.plus,
        basis: `${count.plus ? `${count.plus} + ` : ''}${count.times === 1 ? '' : `${count.times} x `}class level (${ctx.level})`,
      }
    case 'column': {
      const cell = columnCell(ctx.tables, count.column, ctx.level)
      const basis = `${count.column} column at class level ${ctx.level}`
      if (/unlimited/i.test(cell)) return { basis }
      return { max: Number.parseInt(cell, 10) || 0, basis }
    }
  }
}

/** The text of a level table's cell by its column's label. */
function columnCell(tables: readonly ClassTableGroup[], column: string, level: number) {
  for (const group of tables) {
    const col = (group.colLabels ?? []).findIndex((l) => stripTags(l) === column)
    if (col >= 0) return cellText(group.rows?.[level - 1]?.[col])
  }
  return ''
}

export const RESTORES: Record<Recharge, string> = {
  short: 'All on a short or long rest',
  long: 'All on a long rest',
  shortOne: 'One on a short rest, all on a long rest',
  none: 'No rest restores them',
}

const restoresText = (recharge: Recharge, shortRegain: number) =>
  shortRegain > 0
    ? `${RESTORES[recharge]}; ${shortRegain} on a short rest`
    : RESTORES[recharge]

/** The name a counter shows: its label, the trait inside the holder, or the holder's name. */
function ruleLabel(rule: Pick<ResourceRule, 'holder' | 'label' | 'feature'>): string {
  if (rule.label ?? rule.feature) return rule.label ?? rule.feature ?? ''
  const h: Holder = rule.holder
  if ('feat' in h) return h.feat.split('|')[0]
  if ('option' in h) return h.option.split('|')[0]
  if ('item' in h) return h.item.split('|')[0]
  if ('race' in h) return h.race.subraceName ?? h.race.baseName
  return 'classFeature' in h ? h.classFeature.name : h.subclassFeature.name
}

/** The feature row a holder's counter belongs to, by the tag of where it comes from. */
function anchorOf(rule: ResourceRule, held: Held): string {
  const h = rule.holder
  if ('classFeature' in h) return `${held.source.tag}#${h.classFeature.name}`
  if ('subclassFeature' in h) return `${held.source.tag}#${h.subclassFeature.name}`
  if ('race' in h) return `race#${rule.feature ?? ''}`
  return held.source.tag
}

/** The level tables of the class or subclass that holds a class or subclass feature. */
function tablesOf(sources: Sources, holder: Holder): ClassTableGroup[] {
  if (!('classFeature' in holder) && !('subclassFeature' in holder)) return []
  const className =
    'classFeature' in holder
      ? holder.classFeature.className
      : holder.subclassFeature.className
  const c = sources.classes.find((s) => s.row.name === className && s.loaded)
  if (!c?.loaded) return []
  if ('classFeature' in holder) return c.loaded.entry.classTableGroups ?? []
  const { shortName, source } = holder.subclassFeature
  return subclassOf(c.loaded, { shortName, source })?.subclassTableGroups ?? []
}

interface HeldRule {
  rule: ResourceRule
  held: Held
  label: string
  max?: number
  basis: string
}

/** The counters of the rules table the character holds, pooled by name. */
function featureResources(
  sources: Sources,
  totals: AbilityTotals,
  prof: number,
): DerivedResource[] {
  const held: HeldRule[] = []
  for (const rule of RESOURCE_RULES) {
    const h = heldBy(sources, rule.holder)
    if (!h) continue
    const ctx = {
      totals,
      prof,
      level: h.classLevel ?? 0,
      tables: tablesOf(sources, rule.holder),
    }
    held.push({ rule, held: h, label: ruleLabel(rule), ...countUses(rule.count, ctx) })
  }
  const changes = RESOURCE_CHANGES.flatMap((change) => {
    const h = heldBy(sources, change.holder)
    return h ? [{ change, held: h }] : []
  })
  const byLabel = new Map<string, HeldRule[]>()
  for (const entry of held) {
    const key = entry.label.toLowerCase()
    byLabel.set(key, [...(byLabel.get(key) ?? []), entry])
  }
  return [...byLabel.values()].map((group) => {
    // One feature given by two classes keeps the larger count (Channel Divinity); a
    // feature that adds to the counter (Martial Adept's die) adds to it.
    const bases = group.filter((g) => !g.rule.adds)
    const first = bases[0] ?? group[0]
    const unlimited = bases.some((g) => g.max === undefined)
    const base = bases.length > 0 ? Math.max(...bases.map((g) => g.max ?? 0)) : 0
    const added = group.filter((g) => g.rule.adds).reduce((n, g) => n + (g.max ?? 0), 0)
    let max = unlimited ? undefined : base + added
    let basis = [first, ...group.filter((g) => g.rule.adds)]
      .map((g) => (g === first ? g.basis : `${g.basis} from ${g.held.source.label}`))
      .join(' + ')
    let recharge = first.rule.recharge
    let shortRegain = 0
    for (const { change, held: by } of changes) {
      if (change.target.toLowerCase() !== first.label.toLowerCase()) continue
      if (change.recharge) recharge = change.recharge
      if (change.shortRegain) shortRegain += change.shortRegain
      if (change.count) {
        const ctx = {
          totals,
          prof,
          level: by.classLevel ?? 0,
          tables: tablesOf(sources, change.holder),
        }
        const changed = countUses(change.count, ctx)
        max = changed.max
        basis = `${changed.basis} (${by.source.label})`
      }
    }
    return {
      id: `use:${holderId(first.rule.holder)}#${first.label}`,
      label: first.label,
      from: first.held.source.label,
      anchor: anchorOf(first.rule, first.held),
      kind: 'feature' as const,
      max,
      recharge,
      shortRegain,
      basis,
      restores: restoresText(recharge, shortRegain),
      entries: [],
    }
  })
}

/** A counter for each spell the data lets the character cast a number of times per rest. */
function spellResources(
  grants: readonly SpellGrant[],
  totals: AbilityTotals,
  prof: number,
): DerivedResource[] {
  const pools = new Map<string, SpellGrant[]>()
  for (const grant of grants) {
    if (!grant.limit || grant.locked || !grant.spell) continue
    pools.set(grant.limit.pool, [...(pools.get(grant.limit.pool) ?? []), grant])
  }
  return [...pools.entries()].map(([pool, list]) => {
    const limit = list[0].limit
    const count = limit?.count ?? 0
    const { max, basis } =
      typeof count === 'number'
        ? { max: count, basis: `${count}` }
        : count === 'pb'
          ? { max: prof, basis: 'Proficiency bonus' }
          : {
              max: Math.max(1, abilityMod(totals[count])),
              basis: `${ABILITY_NAMES[count]} modifier, at least 1`,
            }
    const recharge: Recharge = limit?.rest === 'short' ? 'short' : 'long'
    const names = list.map((g) => g.spell?.name ?? '').join(', ')
    return {
      id: `spell:${pool}`,
      label: names,
      from: list[0].from,
      kind: 'spell' as const,
      max,
      recharge,
      shortRegain: 0,
      basis,
      restores: restoresText(recharge, 0),
      entries: [`Cast ${names} without a spell slot: ${list[0].uses}.`],
    }
  })
}

/** A counter for each equipped item with a number of charges. */
function itemResources(sources: Sources): DerivedResource[] {
  return sources.items.flatMap(({ item, source }) => {
    const charges = item.charges
    if (!charges || !/^\d+$/.test(charges.max)) return []
    const recharge: Recharge = charges.on === 'restLong' ? 'long' : 'none'
    return [
      {
        id: `item:${item.key}`,
        label: item.name,
        from: source.label,
        anchor: source.tag,
        kind: 'item' as const,
        max: Number(charges.max),
        recharge,
        shortRegain: 0,
        basis: 'Charges',
        // Charges that come back at dawn are restored by hand: no rest is tied to dawn.
        restores:
          recharge === 'long'
            ? RESTORES.long
            : `${charges.amount ? `Regains ${charges.amount}` : 'Regains them'} ${charges.recharge ?? 'as the item describes'}`,
        entries: item.entries,
      },
    ]
  })
}

export function deriveResources(
  sources: Sources,
  grants: readonly SpellGrant[],
  totals: AbilityTotals,
  prof: number,
): DerivedResource[] {
  return [
    ...featureResources(sources, totals, prof),
    ...spellResources(grants, totals, prof),
    ...itemResources(sources),
  ]
}
