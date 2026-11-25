import { describe, expect, it } from 'vitest'
import { character } from '../test/cloudFixtures'
import { deletedRow, joinHistory, liveRow, planSync, readRows } from './merge'

/** A cloud copy, as the sync reads it. */
const there = (c: ReturnType<typeof character>) => ({
  id: c.id,
  character: c,
  updatedAt: c.updatedAt,
})
const gone = (id: string, at: number) => ({ id, character: null, updatedAt: at })

/** Two copies of one character that share their first history entry. */
function copies(
  localAt: number,
  localTimes: number[],
  remoteAt: number,
  remoteTimes: number[],
) {
  const local = character('a', localAt, localTimes)
  const remote = character('a', remoteAt, remoteTimes)
  remote.history[0] = local.history[0]
  return { local, remote }
}

describe('planSync: a character on one side', () => {
  it('sends one the cloud lacks, and stores one the device lacks', () => {
    const mine = character('mine', 10)
    const theirs = character('theirs', 10)
    const plan = planSync([mine], [there(theirs)], {})
    expect(plan.upload).toEqual([liveRow(mine)])
    expect(plan.writeLocal).toEqual([theirs])
    expect(plan.removeLocal).toEqual([])
  })

  it('does nothing for identical copies', () => {
    const same = character('a', 10, [5])
    expect(planSync([same], [there(same)], {})).toEqual({
      writeLocal: [],
      removeLocal: [],
      upload: [],
      settledRemovals: [],
    })
  })
})

describe('planSync: both sides have it', () => {
  it('lets the device win when it changed last, and sends it', () => {
    const local = character('a', 20, [], 'Newer')
    const remote = character('a', 10, [], 'Older')
    const plan = planSync([local], [there(remote)], {})
    expect(plan.writeLocal).toEqual([])
    expect(plan.upload).toEqual([liveRow(local)])
  })

  it('lets the cloud win when it changed last, and stores it', () => {
    const local = character('a', 10, [], 'Older')
    const remote = character('a', 20, [], 'Newer')
    const plan = planSync([local], [there(remote)], {})
    expect(plan.writeLocal).toEqual([remote])
    expect(plan.upload).toEqual([])
  })

  it('keeps every history entry from both sides, in order, when the device body wins', () => {
    const { local, remote } = copies(20, [100, 300], 10, [100, 200])
    const plan = planSync([local], [there(remote)], {})
    const [written] = plan.writeLocal
    expect(written.history.map((entry) => entry.at)).toEqual([100, 200, 300])
    expect(written.name).toBe(local.name)
    expect(written.updatedAt).toBe(20)
    expect(plan.upload[0].data.history?.map((entry) => entry.at)).toEqual([100, 200, 300])
  })

  it('keeps the entries of the device when the cloud body wins', () => {
    const { local, remote } = copies(10, [100, 150], 20, [100])
    const plan = planSync([local], [there(remote)], {})
    expect(plan.writeLocal[0].history.map((entry) => entry.at)).toEqual([100, 150])
    expect(plan.writeLocal[0].updatedAt).toBe(20)
    expect(plan.upload).toHaveLength(1)
  })

  it('on a tie, keeps the device body and still joins the history', () => {
    const local = character('a', 10, [100], 'Mine')
    const remote = character('a', 10, [200], 'Theirs')
    const plan = planSync([local], [there(remote)], {})
    expect(plan.writeLocal[0].name).toBe('Mine')
    expect(plan.writeLocal[0].history.map((entry) => entry.at)).toEqual([100, 200])
    expect(plan.upload).toHaveLength(1)
  })

  it('does not repeat an entry both sides have', () => {
    const { history } = character('a', 1, [5])
    expect(joinHistory(history, history)).toEqual(history)
  })
})

describe('planSync: deletions', () => {
  it('removes the device copy when the cloud deleted it later', () => {
    const plan = planSync([character('a', 10)], [gone('a', 20)], {})
    expect(plan.removeLocal).toEqual(['a'])
    expect(plan.upload).toEqual([])
  })

  it('keeps and restores a device copy changed after the cloud deleted it', () => {
    const local = character('a', 30)
    const plan = planSync([local], [gone('a', 20)], {})
    expect(plan.removeLocal).toEqual([])
    expect(plan.upload).toEqual([liveRow(local)])
  })

  it('tells the cloud of a deletion made here', () => {
    const plan = planSync([], [there(character('a', 10))], { a: 50 })
    expect(plan.upload).toEqual([deletedRow('a', 50)])
    expect(plan.writeLocal).toEqual([])
    expect(plan.settledRemovals).toEqual(['a'])
  })

  it('removes a device copy that a deletion made here covers', () => {
    const plan = planSync([character('a', 10)], [there(character('a', 10))], { a: 50 })
    expect(plan.removeLocal).toEqual(['a'])
    expect(plan.upload).toEqual([deletedRow('a', 50)])
  })

  it('lets a change in the cloud after the deletion keep the character', () => {
    const remote = character('a', 60)
    const plan = planSync([], [there(remote)], { a: 50 })
    expect(plan.writeLocal).toEqual([remote])
    expect(plan.upload).toEqual([])
    expect(plan.settledRemovals).toEqual(['a'])
  })

  it('lets a change here after the deletion keep the character', () => {
    const local = character('a', 60)
    const plan = planSync([local], [], { a: 50 })
    expect(plan.upload).toEqual([liveRow(local)])
    expect(plan.removeLocal).toEqual([])
  })

  it('has nothing to send when the cloud already has a later deletion', () => {
    const plan = planSync([], [gone('a', 70)], { a: 50 })
    expect(plan.upload).toEqual([])
    expect(plan.settledRemovals).toEqual(['a'])
  })
})

describe('readRows', () => {
  it('reads live rows as characters and deleted rows as none', () => {
    const rows = readRows([liveRow(character('a', 10)), deletedRow('b', 5)])
    expect(rows[0].character?.id).toBe('a')
    expect(rows[0].updatedAt).toBe(10)
    expect(rows[1]).toEqual({ id: 'b', updatedAt: 5, character: null })
  })
})
