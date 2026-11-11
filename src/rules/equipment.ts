// What a character carries, worked out from the inventory: weight, worth, how much
// can be carried, how many items are attuned to. Pure functions; the app measures
// against these and flags, it never blocks (see compliance.ts).

import { appConfig } from '../config/app'
import type { Currency, InventoryItem } from '../character/model'

/** What a stack of the inventory comes to: how many, and its weight and worth if listed. */
export interface Stack {
  quantity: number
  /** Pounds for one; absent when the book prints none. */
  weight?: number
  /** Copper pieces for one; absent when the book prints no price. */
  value?: number
}

/** Copper in one coin of each kind. */
export const COIN_COPPER: Record<keyof Currency, number> = {
  pp: 1000,
  gp: 100,
  ep: 50,
  sp: 10,
  cp: 1,
}

/** The multiplier of carrying capacity for each size (the size codes of the data). */
const SIZE_CAPACITY: Record<string, number> = { T: 0.5, S: 1, M: 1, L: 2, H: 3, G: 4 }

/** Pounds the coins of a purse weigh. */
export function coinWeight(currency: Currency): number {
  const coins = Object.values(currency).reduce((sum, n) => sum + n, 0)
  return coins / appConfig.rules.coinsPerPound
}

/** What a purse is worth, in copper. */
export function purseValue(currency: Currency): number {
  return (Object.keys(COIN_COPPER) as (keyof Currency)[]).reduce(
    (sum, coin) => sum + currency[coin] * COIN_COPPER[coin],
    0,
  )
}

/** The weight of what is carried, and how many stacks have no weight to count. */
export interface CarriedWeight {
  /** Pounds, items and coins together. */
  pounds: number
  /** Stacks whose book prints no weight: counted as nothing, and said so. */
  unlisted: number
}

/**
 * The weight carried: each stack's weight times its quantity, and the coins of the
 * purse. A container's contents are stacks of their own, so nothing nests.
 */
export function carriedWeight(stacks: Stack[], currency: Currency): CarriedWeight {
  let pounds = coinWeight(currency)
  let unlisted = 0
  for (const stack of stacks) {
    if (stack.weight === undefined) unlisted += 1
    else pounds += stack.weight * stack.quantity
  }
  return { pounds, unlisted }
}

/** The worth of what is carried, and how many stacks have no price to count. */
export interface CarriedValue {
  /** Copper pieces, the items only (the purse is `purseValue`). */
  copper: number
  /** Stacks that have no price: counted as nothing. */
  unlisted: number
}

export function totalValue(stacks: Stack[]): CarriedValue {
  let copper = 0
  let unlisted = 0
  for (const stack of stacks) {
    if (stack.value === undefined) unlisted += 1
    else copper += stack.value * stack.quantity
  }
  return { copper, unlisted }
}

/**
 * The pounds a character can carry: Strength times 15, times 2, 3 or 4 for a Large,
 * Huge or Gargantuan creature and half for a Tiny one. The encumbrance variant is
 * not applied.
 */
export function carryingCapacity(strength: number, size = 'M'): number {
  return strength * appConfig.rules.carryingPerStrength * (SIZE_CAPACITY[size] ?? 1)
}

/** How many items the character is attuned to. */
export function attunedCount(items: InventoryItem[]): number {
  return items.filter((item) => item.attuned === true).length
}

/**
 * The Strength a suit of armor asks for when the character has less, else nothing. A
 * Strength of 0 is one not set yet, which asks nothing of the armor.
 */
export function strengthNeeded(required: number | undefined, strength: number) {
  return required !== undefined && strength > 0 && strength < required
    ? required
    : undefined
}

/** Whether an item is for classes (lower case names) none of which the character has. */
export const lacksClass = (required: readonly string[], have: readonly string[]) =>
  required.length > 0 && !required.some((name) => have.includes(name))
