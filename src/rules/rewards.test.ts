// The rewards of the books against the data in `.local/data` (skipped without it): every
// reward is offered to the player, and each effect its text states is applied through a
// rule table or the spell grants, played from its text, or excused with a reason.

import { describe, expect, it, vi } from 'vitest'
import { loadRewards } from '../data/rewards'
import { dataDir, records, recordId, textOf } from '../test/dataAudit'
import { HP_RULES } from './hpSources'
import { holderId } from './holder'
import { REWARD_EXCUSED } from './rewardExcused'
import { RESOURCE_RULES } from './resources'
import { SENSE_RULES } from './senseRules'
import { MOVE_RULES, SPEED_RULES } from './speedRules'

vi.mock('../data/dataClient', async () => {
  const { readFileSync: read } = await import('node:fs')
  return {
    fetchData: (path: string): Promise<unknown> =>
      Promise.resolve(JSON.parse(read(`.local/data/${path}`, 'utf8'))),
  }
})

// What a reward's words claim that a sheet number or a counter would carry.
const CLAIMS: readonly [string, RegExp][] = [
  ['hit points', /hit point maximum/i],
  ['speed', /\bspeed\b.{0,40}(increase|feet)|(increase|gain).{0,40}speed/i],
  ['senses', /darkvision|blindsight|truesight|tremorsense/i],
  [
    'uses',
    /once per (?!turn|round|rage|active|roll|combat|creature)|a number of times equal to|regains? [^.]{0,80}(short|long) rest|expended uses|until you (finish|complete) a (short|long)|(short|long) rest before|replenish|unavailable until|can't use (it|this) again|once, then|charm is gone/i,
  ],
]

const RULED = new Set([
  ...HP_RULES.map((r) => r.id),
  ...[...SPEED_RULES, ...MOVE_RULES, ...SENSE_RULES, ...RESOURCE_RULES].map((r) =>
    holderId(r.holder),
  ),
])

describe('reward excuses', () => {
  it('never both rule and excuse a reward', () => {
    expect(Object.keys(REWARD_EXCUSED).filter((id) => RULED.has(id))).toEqual([])
  })

  it('gives every excuse a reason', () => {
    expect(Object.values(REWARD_EXCUSED).filter((reason) => reason.length < 10)).toEqual(
      [],
    )
  })
})

describe.skipIf(!dataDir)('rewards against the data', () => {
  const found = records(dataDir ?? '').filter(({ collection }) => collection === 'reward')
  const byId = new Map(found.map(({ record }) => [recordId('reward', record), record]))

  it('offers every reward of the data', async () => {
    const offered = new Set((await loadRewards()).map((r) => `reward|${r.key}`))
    expect(
      found.filter(({ record }) => !offered.has(recordId('reward', record))),
    ).toEqual([])
    expect(offered.size).toBe(byId.size)
    expect(byId.size).toBeGreaterThan(300)
  })

  it('applies, or excuses, every effect a reward states', () => {
    const open: string[] = []
    for (const [id, record] of byId) {
      const claims = CLAIMS.filter(([kind, pattern]) => {
        if (!pattern.test(textOf(record))) return false
        // The casts of a spell the data lists are counted by the spell grants.
        return !(kind === 'uses' && record.additionalSpells)
      })
      if (claims.length > 0 && !RULED.has(id) && !(id in REWARD_EXCUSED))
        open.push(`${id}: ${claims.map(([kind]) => kind).join(', ')}`)
    }
    expect(open).toEqual([])
  })

  it('has every ruled and excused reward in the data', () => {
    const named = [...RULED, ...Object.keys(REWARD_EXCUSED)].filter((id) =>
      id.startsWith('reward|'),
    )
    expect(named.filter((id) => !byId.has(id))).toEqual([])
  })
})
