// The supernatural gifts of the books (DMG and XDMG, and others): blessings, charms, epic
// boons, piety traits and the rest of the data's rewards file, which a player adds to a
// character as the DM grants them. The free rules print none, so the list is empty
// without the full content.

import { memoizeContent } from '../content/epoch'
import type { Entry } from '../text/Entries'
import { fetchData } from './dataClient'
import { loadBookEditions, type Edition } from './edition'

export interface Reward {
  /** "Name|Source", as a character stores it. */
  key: string
  name: string
  source: string
  /** "Blessing", "Charm", "Boon"... */
  type: string
  edition: Edition
  entries: Entry[]
  /** The spells it lets the character cast, as the data lists them. */
  additionalSpells?: unknown[]
}

interface RawReward {
  name: string
  source: string
  type?: string
  entries?: Entry[]
  additionalSpells?: unknown[]
}

interface RewardsFile {
  reward?: RawReward[]
}

/** The key a reward is stored and found by. */
export const rewardKey = (reward: { name: string; source: string }) =>
  `${reward.name}|${reward.source}`

/** Every reward of every book, by name. */
export const loadRewards = memoizeContent(async (): Promise<Reward[]> => {
  const [data, editionOf] = await Promise.all([
    fetchData<RewardsFile>('rewards.json').catch((): RewardsFile => ({})),
    loadBookEditions().catch(() => () => 'classic' as const),
  ])
  return (data.reward ?? [])
    .map((r) => ({
      key: rewardKey(r),
      name: r.name,
      source: r.source,
      type: r.type ?? 'Other',
      edition: editionOf(r.source),
      entries: r.entries ?? [],
      ...(r.additionalSpells ? { additionalSpells: r.additionalSpells } : {}),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
})
