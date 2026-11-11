// Starting equipment: what a class and a background give, read out of the data into
// the choices a player makes and the items they end up with. One reader for both
// sources, both editions. A source offers some things to everyone and some as
// alternatives (a or b, A or B), with "any martial weapon" style picks inside, and
// coin, sometimes as the whole of an alternative (the gold instead of the kit).
// Nothing here knows about screens: `StartingEquipment.tsx` shows it.

import type { Item } from '../data/items'
import { indexItems, uniqueCustomName } from './inventory'
import type { Currency, EquipmentState, InventoryItem, StartingPick } from './model'

/** An item of the catalog, a number of times. */
export interface GearItem {
  kind: 'item'
  item: Item
  quantity: number
  /** What the data calls this one in its own words ("prayer book"), when not the name. */
  note?: string
}

/** A thing that is in no catalog (a letter of introduction, an unknown name). */
export interface GearCustom {
  kind: 'custom'
  name: string
  quantity: number
  /** Said so in the data (a letter of introduction), not a name the catalog is missing. */
  special: boolean
  /** What it is worth in copper, when the data says. */
  value?: number
}

/** "Any martial weapon": one item of the kinds named, to be chosen. */
export interface GearPick {
  kind: 'pick'
  /** Unique within the source: where the choice is stored. */
  slot: string
  /** The kinds it can be, as the data names them ("weaponMartial"). */
  types: string[]
  /** Or an umbrella item of the books ("holy symbol"): any member of that group. */
  group?: string
  /** In words: "Martial weapon". */
  label: string
}

/** Coin, in copper. */
export interface GearCoin {
  kind: 'coin'
  copper: number
}

export type Gear = GearItem | GearCustom | GearPick | GearCoin

/** One way to take a block: the gear it gives. An option of coin only is the gold instead. */
export interface StartingOption {
  /** "A", "B", "a": the key the data gives it. */
  key: string
  gear: Gear[]
  /** The coin it gives, in copper. */
  gold: number
}

/** One question of the source: what everyone gets, and the ways to take the rest. */
export interface StartingBlock {
  index: number
  /** Given with any option (the data's `_`). */
  fixed: Gear[]
  /** The alternatives; none when the block only gives. */
  options: StartingOption[]
}

/** The 2014 way to take gold instead: roll dice, times a number of gold pieces. */
export interface GoldRoll {
  dice: number
  sides: number
  /** Gold pieces per point rolled: 5d4 x 10 is 10. */
  multiplier: number
}

export interface StartingChoices {
  /** What gives it: "Fighter|XPHB". */
  source: string
  blocks: StartingBlock[]
  goldRoll?: GoldRoll
}

/** What a player has decided: the option of each block that offers some, the picks. */
export interface StartingSelection {
  /** Block index to option key. */
  options: Record<number, string>
  /** Slot to item key. */
  picks: Record<string, string>
  /** The gold taken in place of everything else (a 2014 class), in copper. */
  gold?: number
}

/** The option that means gold in place of the kit, in a selection and a stored pick. */
export const GOLD_OPTION = 'gold'

type Fields = Record<string, unknown>
const isFields = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const EQUIPMENT_TYPE_LABELS: Record<string, string> = {
  weaponSimple: 'Simple weapon',
  weaponMartial: 'Martial weapon',
  weaponSimpleMelee: 'Simple melee weapon',
  weaponMartialMelee: 'Martial melee weapon',
  focusSpellcastingArcane: 'Arcane focus',
  focusSpellcastingHoly: 'Holy symbol',
  focusSpellcastingDruidic: 'Druidic focus',
  instrumentMusical: 'Musical instrument',
  toolArtisan: "Artisan's tools",
  setGaming: 'Gaming set',
}

/** Whether a kind of item the data names ("weaponMartial") fits an item. */
export function matchesEquipmentType(type: string, item: Item): boolean {
  if (item.magic || item.variant) return false
  switch (type) {
    case 'weaponSimple':
      return item.weapon?.category === 'simple'
    case 'weaponMartial':
      return item.weapon?.category === 'martial'
    case 'weaponSimpleMelee':
      return item.weapon?.category === 'simple' && item.weapon.melee
    case 'weaponMartialMelee':
      return item.weapon?.category === 'martial' && item.weapon.melee
    case 'focusSpellcastingArcane':
      return item.focus === 'arcane'
    case 'focusSpellcastingHoly':
      return item.focus === 'holy'
    case 'focusSpellcastingDruidic':
      return item.focus === 'druid'
    case 'instrumentMusical':
      return item.kind === 'instrument'
    case 'toolArtisan':
      return item.type === 'AT'
    case 'setGaming':
      return item.type === 'GS'
    default:
      return false
  }
}

/** Whether an item is one the pick allows: of a kind it names, or a member of its group. */
export const matchesPick = (
  pick: Pick<GearPick, 'types' | 'group'>,
  item: Item,
): boolean =>
  !item.magic &&
  !item.variant &&
  (pick.types.some((type) => matchesEquipmentType(type, item)) ||
    (pick.group !== undefined &&
      item.groups.some((group) => group.toLowerCase() === pick.group)))

/** "a letter of introduction" as a name: the first letter in capitals, nothing else. */
const sentenceCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** The books that print the basic gear a pick is made from, by edition. */
const CORE_BOOKS: Record<Item['edition'], string> = { classic: 'PHB', one: 'XPHB' }

/**
 * The items a pick offers: those that fit, from the core book of the source's
 * edition, so a martial weapon is not a firearm. When that leaves nothing, every
 * item that fits.
 */
export function pickRows(
  pick: Pick<GearPick, 'types' | 'group'>,
  rows: readonly Item[],
  edition: Item['edition'],
): Item[] {
  const fitting = rows.filter((row) => matchesPick(pick, row))
  const basic = fitting.filter((row) => row.source === CORE_BOOKS[edition])
  return basic.length > 0 ? basic : fitting
}

/** The gold-roll text of a 2014 class: "{@dice 5d4 x 10|...}" is 5d4, times 10. */
export function parseGoldRoll(text: unknown): GoldRoll | undefined {
  if (typeof text !== 'string') return undefined
  const match = /(\d+)d(\d+)(?:\s*[×x*]\s*(\d+))?/.exec(text)
  if (!match) return undefined
  return {
    dice: Number(match[1]),
    sides: Number(match[2]),
    multiplier: match[3] ? Number(match[3]) : 1,
  }
}

/** The coin of a list of gear, in copper. */
export const goldOf = (gear: readonly Gear[]): number =>
  gear.reduce((sum, g) => (g.kind === 'coin' ? sum + g.copper : sum), 0)

/** Whether an option gives coin and nothing else: the gold in place of the kit. */
export const isGoldOnly = (option: StartingOption): boolean =>
  option.gold > 0 && option.gear.every((g) => g.kind === 'coin')

/** The data's name for an item ("light crossbow|phb") as the catalog is indexed. */
const referenceOf = (reference: string, source: string) => {
  const [name, book] = reference.split('|')
  return `${name}|${book ?? source}`.toLowerCase()
}

/**
 * Reads the starting equipment of one class or background into choices. `source` is
 * "Name|BOOK" of the giver, `blocks` its `startingEquipment` data, `catalog` every
 * item. A name the catalog does not know becomes a custom item of that name, so
 * nothing the data gives is ever lost.
 */
export function startingChoices(
  source: string,
  blocks: readonly unknown[] | undefined,
  catalog: readonly Item[],
  goldAlternative?: unknown,
): StartingChoices {
  const book = source.split('|')[1] ?? ''
  const byReference = new Map(catalog.map((item) => [item.key.toLowerCase(), item]))

  const find = (reference: string) => byReference.get(referenceOf(reference, book))
  // The umbrella items of the books ("holy symbol" is any of its members).
  const groups = new Set(
    catalog.flatMap((item) => item.groups.map((g) => g.toLowerCase())),
  )

  /** One entry of a list as gear (a pick of 2 is two gear), with the coin it holds. */
  const read = (entry: unknown, slot: string): Gear[] => {
    if (typeof entry === 'string') return read({ item: entry }, slot)
    if (!isFields(entry)) return []
    const quantity = typeof entry.quantity === 'number' ? entry.quantity : 1
    const display = typeof entry.displayName === 'string' ? entry.displayName : undefined
    const gear: Gear[] = []

    if (typeof entry.value === 'number') return [{ kind: 'coin', copper: entry.value }]

    const types = Array.isArray(entry.equipmentTypes)
      ? entry.equipmentTypes.filter((t): t is string => typeof t === 'string')
      : typeof entry.equipmentType === 'string'
        ? [entry.equipmentType]
        : []
    if (types.length > 0) {
      const label = display
        ? sentenceCase(display)
        : types.map((t) => EQUIPMENT_TYPE_LABELS[t] ?? t).join(' or ')
      for (let n = 0; n < quantity; n += 1)
        gear.push({ kind: 'pick', slot: `${slot}.${n}`, types, label })
      return gear
    }

    const reference =
      typeof entry.item === 'string'
        ? entry.item
        : typeof entry.special === 'string'
          ? entry.special
          : undefined
    if (reference === undefined) return []
    const item = find(reference)
    const group = reference.split('|')[0].toLowerCase()
    if (!item && groups.has(group)) {
      for (let n = 0; n < quantity; n += 1)
        gear.push({
          kind: 'pick',
          slot: `${slot}.${n}`,
          types: [],
          group,
          label: display ? sentenceCase(display) : sentenceCase(group),
        })
      return gear
    }
    if (item) {
      const note =
        display && display.toLowerCase() !== item.name.toLowerCase() ? display : undefined
      gear.push({ kind: 'item', item, quantity, note })
    } else {
      const name = display ?? sentenceCase(reference.split('|')[0])
      gear.push({
        kind: 'custom',
        name,
        quantity,
        special: typeof entry.special === 'string',
        value: typeof entry.worthValue === 'number' ? entry.worthValue : undefined,
      })
    }
    // A pouch with coin in it: the coin goes in the purse.
    if (typeof entry.containsValue === 'number')
      gear.push({ kind: 'coin', copper: entry.containsValue })
    return gear
  }

  const readList = (list: unknown, slot: string): Gear[] =>
    (Array.isArray(list) ? list : []).flatMap((entry, i) => read(entry, `${slot}.${i}`))

  const blocksRead = (blocks ?? []).flatMap((block, index): StartingBlock[] => {
    if (!isFields(block)) return []
    const options = Object.entries(block)
      .filter(([key]) => key !== '_')
      .map(([key, list]): StartingOption => {
        const gear = readList(list, `${index}.${key}`)
        return { key, gear, gold: goldOf(gear) }
      })
    return [{ index, fixed: readList(block._, `${index}._`), options }]
  })

  return {
    source,
    blocks: blocksRead,
    goldRoll: parseGoldRoll(goldAlternative),
  }
}

/** Every pick slot of the options a selection takes, in reading order. */
export function selectedGear(
  choices: StartingChoices,
  selection: StartingSelection,
): Gear[] {
  if (selection.gold !== undefined) return []
  return choices.blocks.flatMap((block) => {
    const taken = block.options.find((o) => o.key === selection.options[block.index])
    return [...block.fixed, ...(taken?.gear ?? [])]
  })
}

/** The first option of each block that offers some: what one click takes. */
export function defaultSelection(choices: StartingChoices): StartingSelection {
  const options: Record<number, string> = {}
  for (const block of choices.blocks)
    if (block.options.length > 0) options[block.index] = block.options[0].key
  return { options, picks: {} }
}

/** The coin of a selection, in copper. */
export const selectionGold = (choices: StartingChoices, selection: StartingSelection) =>
  selection.gold ?? goldOf(selectedGear(choices, selection))

/** The picks a selection has yet to make. */
export const unpickedSlots = (
  choices: StartingChoices,
  selection: StartingSelection,
): GearPick[] =>
  selectedGear(choices, selection).filter(
    (g): g is GearPick => g.kind === 'pick' && !selection.picks[g.slot],
  )

/** The stored form of what was taken: one option key per block that offers some. */
export function pickOf(
  choices: StartingChoices,
  selection: StartingSelection,
  gold: number,
): StartingPick {
  if (selection.gold !== undefined)
    return { source: choices.source, option: GOLD_OPTION, picks: {}, gold }
  const keys = choices.blocks
    .filter((b) => b.options.length > 0)
    .map((b) => selection.options[b.index])
  const slots = new Set(
    selectedGear(choices, selection).flatMap((g) => (g.kind === 'pick' ? [g.slot] : [])),
  )
  return {
    source: choices.source,
    option: keys.join(','),
    picks: Object.fromEntries(
      Object.entries(selection.picks).filter(([slot]) => slots.has(slot)),
    ),
    gold,
  }
}

/** The selection a stored pick was made from, so a change starts where the player left. */
export function selectionOf(
  choices: StartingChoices,
  pick: StartingPick | undefined,
): StartingSelection {
  const fresh = defaultSelection(choices)
  if (!pick) return fresh
  if (pick.option === GOLD_OPTION) return { ...fresh, gold: pick.gold ?? 0 }
  const keys = pick.option.split(',')
  const options = { ...fresh.options }
  choices.blocks
    .filter((b) => b.options.length > 0)
    .forEach((block, i) => {
      if (block.options.some((o) => o.key === keys[i])) options[block.index] = keys[i]
    })
  return { options, picks: { ...pick.picks } }
}

/** Copper as the gold, silver and copper pieces of a purse. */
export function coinParts(copper: number): Pick<Currency, 'gp' | 'sp' | 'cp'> {
  return {
    gp: Math.floor(copper / 100),
    sp: Math.floor((copper % 100) / 10),
    cp: copper % 10,
  }
}

/** A purse with coin added (a negative amount takes it back, never below nothing). */
export function addCoin(currency: Currency, copper: number): Currency {
  const parts = coinParts(Math.abs(copper))
  const sign = copper < 0 ? -1 : 1
  const next = { ...currency }
  for (const coin of ['gp', 'sp', 'cp'] as const)
    next[coin] = Math.max(0, next[coin] + sign * parts[coin])
  return next
}

/** The inventory stacks a selection gives (picks not made give nothing). */
export function stacksOf(
  choices: StartingChoices,
  selection: StartingSelection,
  catalog: readonly Item[],
  from: NonNullable<InventoryItem['from']>,
  existing: readonly InventoryItem[],
): InventoryItem[] {
  const index = indexItems(catalog)
  const stacks: InventoryItem[] = []
  const add = (stack: InventoryItem) => {
    const same = stacks.find((s) => s.name === stack.name && s.source === stack.source)
    if (same) same.quantity += stack.quantity
    else stacks.push(stack)
  }
  const ofItem = (item: Item, quantity: number, note?: string): InventoryItem => ({
    name: item.name,
    source: item.source,
    quantity,
    from,
    ...(note ? { note } : {}),
  })
  for (const gear of selectedGear(choices, selection)) {
    if (gear.kind === 'item') add(ofItem(gear.item, gear.quantity, gear.note))
    else if (gear.kind === 'custom') {
      const name = uniqueCustomName([...existing, ...stacks], gear.name)
      add({
        name,
        source: 'Custom',
        quantity: gear.quantity,
        from,
        custom: { kind: 'gear', description: '', value: gear.value },
      })
    } else if (gear.kind === 'pick') {
      const chosen = index.get(selection.picks[gear.slot] ?? '')
      if (chosen) add(ofItem(chosen, 1))
    }
  }
  return stacks
}

/** The option stored when the player leaves a source's starting equipment alone. */
export const SKIP_OPTION = 'none'

/**
 * The equipment with what an earlier take of a source gave replaced: its items go and
 * its coin comes out of the purse (never below nothing); the new items and coin are
 * added and the pick is kept.
 */
function replaced(
  equipment: EquipmentState,
  which: keyof EquipmentState['starting'],
  pick: StartingPick,
  made: (kept: InventoryItem[]) => InventoryItem[],
): EquipmentState {
  const kept = equipment.items.filter((s) => s.from !== which)
  const items = kept.map((s) => ({ ...s }))
  for (const stack of made(kept)) {
    const same = items.find((s) => s.name === stack.name && s.source === stack.source)
    if (same) same.quantity += stack.quantity
    else items.push(stack)
  }
  const taken = equipment.starting[which]?.gold ?? 0
  return {
    items,
    currency: addCoin(addCoin(equipment.currency, -taken), pick.gold ?? 0),
    starting: { ...equipment.starting, [which]: pick },
  }
}

/** The equipment once a selection is taken from a source (what it gave before is replaced). */
export function takeStarting(
  equipment: EquipmentState,
  which: keyof EquipmentState['starting'],
  choices: StartingChoices,
  selection: StartingSelection,
  catalog: readonly Item[],
): EquipmentState {
  const pick = pickOf(choices, selection, selectionGold(choices, selection))
  return replaced(equipment, which, pick, (kept) =>
    stacksOf(choices, selection, catalog, which, kept),
  )
}

/** The equipment once the player leaves a source's starting equipment alone. */
export const skipStarting = (
  equipment: EquipmentState,
  which: keyof EquipmentState['starting'],
  source: string,
): EquipmentState =>
  replaced(
    equipment,
    which,
    { source, option: SKIP_OPTION, picks: {}, gold: 0 },
    () => [],
  )
