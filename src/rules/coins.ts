// The purse: adding coins, paying a price and changing coins for others. Pure functions on
// a `Currency`; the sheet shows what they work out and never blocks (a price the purse
// cannot meet is paid with all of it and reported as short).

import type { Currency } from '../character/model'
import { lookup } from '../data/glossary'
import { COIN_COPPER, purseValue } from './equipment'

export type Coin = keyof Currency

/** The coins from the most valuable down. */
export const COIN_ORDER: readonly Coin[] = ['pp', 'gp', 'ep', 'sp', 'cp']

/** The coins change is given in: shops do not hand out electrum or platinum. */
const CHANGE_COINS: readonly Coin[] = ['gp', 'sp', 'cp']

/** The purse with `amount` more coins of one kind (a negative amount leaves none below 0). */
export function addCoins(purse: Currency, coin: Coin, amount: number): Currency {
  return { ...purse, [coin]: Math.max(0, purse[coin] + amount) }
}

/** An amount in copper as coins: whole gold, then silver, then copper. */
export function coinsFor(copper: number): Partial<Currency> {
  const gp = Math.floor(copper / COIN_COPPER.gp)
  const sp = Math.floor((copper % COIN_COPPER.gp) / COIN_COPPER.sp)
  const cp = copper % COIN_COPPER.sp
  return { ...(gp > 0 && { gp }), ...(sp > 0 && { sp }), ...(cp > 0 && { cp }) }
}

/** The purse with those coins put in it. */
export function receiveCoins(purse: Currency, coins: Partial<Currency>): Currency {
  const next = { ...purse }
  for (const coin of COIN_ORDER) next[coin] += coins[coin] ?? 0
  return next
}

/** The coin a price is quoted in: the largest that makes it a whole number (not platinum). */
export function priceCoin(copper: number): Coin {
  if (copper > 0 && copper % COIN_COPPER.gp === 0) return 'gp'
  if (copper > 0 && copper % COIN_COPPER.sp === 0) return 'sp'
  return 'cp'
}

/** What paying a price did to a purse. */
export interface Payment {
  purse: Currency
  /** Copper the purse could not cover: it was paid empty. 0 when it covered the price. */
  short: number
  /** The coin that had to be broken to make the price, when one was. */
  broke?: Coin
  /** The change given back for it. */
  change: Partial<Currency>
}

/**
 * Pays `copper` from the purse. Coins of `prefer` go first, then the smaller coins from the
 * largest down, then the larger ones from the nearest up; a coin too big for what is left
 * is broken and the change goes back in gold, silver and copper. A purse worth less than
 * the price is paid out whole, and `short` says by how much.
 */
export function spendCoins(purse: Currency, copper: number, prefer: Coin): Payment {
  const total = purseValue(purse)
  if (total <= copper) {
    const empty = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 }
    return { purse: empty, short: copper - total, change: {} }
  }
  const at = COIN_ORDER.indexOf(prefer)
  const order = [
    prefer,
    ...COIN_ORDER.slice(at + 1),
    ...COIN_ORDER.slice(0, at).reverse(),
  ]
  const next = { ...purse }
  let owed = copper
  for (const coin of order) {
    const taken = Math.min(next[coin], Math.floor(owed / COIN_COPPER[coin]))
    next[coin] -= taken
    owed -= taken * COIN_COPPER[coin]
  }
  if (owed === 0) return { purse: next, short: 0, change: {} }
  // What is left is held by coins worth more than the rest of the price: break the smallest.
  const broken = [...COIN_ORDER].reverse().find((coin) => next[coin] > 0) as Coin
  next[broken] -= 1
  let back = COIN_COPPER[broken] - owed
  const change: Partial<Currency> = {}
  for (const coin of CHANGE_COINS) {
    const n = Math.floor(back / COIN_COPPER[coin])
    if (n > 0) change[coin] = n
    back -= n * COIN_COPPER[coin]
  }
  return { purse: receiveCoins(next, change), short: 0, broke: broken, change }
}

/** What changing coins of one kind for another did. */
export interface Exchange {
  purse: Currency
  /** Coins of the kind given up, and of the kind taken. */
  gave: number
  got: number
}

/**
 * Changes up to `amount` coins of `from` for `to`, only in whole coins: 25 silver for gold
 * is 2 gold for 20 silver, the 5 left over stay silver. Nothing changes when the purse has
 * none of `from` or the amount is too small for one coin of `to`.
 */
export function exchangeCoins(
  purse: Currency,
  from: Coin,
  to: Coin,
  amount: number,
): Exchange {
  const have = Math.min(Math.max(0, Math.floor(amount)), purse[from])
  const got = Math.floor((have * COIN_COPPER[from]) / COIN_COPPER[to])
  const gave = (got * COIN_COPPER[to]) / COIN_COPPER[from]
  if (from === to || got === 0) return { purse, gave: 0, got: 0 }
  return {
    purse: { ...purse, [from]: purse[from] - gave, [to]: purse[to] + got },
    gave,
    got,
  }
}

/** Coins as words: "2 gp 5 cp", "0 cp" for none. */
export function coinListText(coins: Partial<Currency>): string {
  const parts = COIN_ORDER.filter((coin) => coins[coin]).map(
    (coin) => `${coins[coin]} ${coin}`,
  )
  return parts.length > 0 ? parts.join(' ') : '0 cp'
}

/** An amount in copper as the coins it is made of: "2 gp 5 cp". */
export const coinsText = (copper: number) => coinListText(coinsFor(copper))

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** "Gold pieces": a coin spelled out, from the glossary the tooltips use. */
export const coinName = (coin: Coin) => capitalize(lookup(coin, 'currency')?.full ?? coin)
