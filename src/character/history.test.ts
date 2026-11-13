import { describe, expect, it } from 'vitest'
import { appConfig } from '../config/app'
import { changesBetween, characterChanges, edited } from './history'
import { createCharacter, type Character, type HistoryEntry } from './model'
import { newRoll, rollAction } from './rollHistory'

const T0 = 1_000_000
const WINDOW = appConfig.history.mergeWindowMs

/** A character whose history starts empty, so a test sees only what it records. */
const blank = (): Character => ({ ...createCharacter('Tordek'), history: [] })
const last = (character: Character) => character.history.at(-1) as HistoryEntry

describe('changesBetween', () => {
  it('finds nothing between equal values, also when they are other objects', () => {
    expect(changesBetween({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toEqual([])
    const shared = { a: 1 }
    expect(changesBetween(shared, shared)).toEqual([])
  })

  it('reports a changed, an added and a removed value by its path', () => {
    expect(
      changesBetween(
        { hp: { flatBonus: 0, method: 'average' }, gone: 1 },
        { hp: { flatBonus: 3, method: 'average' }, came: 'x' },
      ),
    ).toEqual([
      { path: ['hp', 'flatBonus'], before: 0, after: 3 },
      { path: ['gone'], before: 1 },
      { path: ['came'], after: 'x' },
    ])
  })

  it('reports a list of plain values as a whole', () => {
    expect(changesBetween({ books: ['PHB'] }, { books: ['PHB', 'XGE'] })).toEqual([
      { path: ['books'], before: ['PHB'], after: ['PHB', 'XGE'] },
    ])
    expect(changesBetween({ rolls: [[1, 2]] }, { rolls: [[1, 3]] })).toEqual([
      { path: ['rolls'], before: [[1, 2]], after: [[1, 3]] },
    ])
    expect(changesBetween([1, 2], [1, 2, 3])).toHaveLength(1)
  })

  it('reports the entries of a list of named things by who they are', () => {
    const rope = { name: 'Rope', source: 'PHB', quantity: 1 }
    const torch = { name: 'Torch', source: 'PHB', quantity: 5 }
    const sword = { name: 'Vorpal Sword', source: 'DMG', quantity: 1 }
    expect(
      changesBetween(
        { items: [rope, torch] },
        { items: [{ ...torch, quantity: 4 }, sword] },
      ),
    ).toEqual([
      { path: ['items', 'Rope|PHB'], before: rope },
      { path: ['items', 'Torch|PHB', 'quantity'], before: 5, after: 4 },
      { path: ['items', 'Vorpal Sword|DMG'], after: sword },
    ])
  })

  it('names an entry without a source by its name alone', () => {
    expect(changesBetween([{ name: 'A', n: 1 }], [{ name: 'A', n: 2 }])).toEqual([
      { path: ['A', 'n'], before: 1, after: 2 },
    ])
  })

  it('reports the same named entries in another order', () => {
    const fighter = { name: 'Fighter', source: 'PHB', level: 1 }
    const wizard = { name: 'Wizard', source: 'PHB', level: 1 }
    expect(changesBetween([fighter, wizard], [wizard, fighter])).toEqual([
      {
        path: [],
        before: ['Fighter|PHB', 'Wizard|PHB'],
        after: ['Wizard|PHB', 'Fighter|PHB'],
      },
    ])
    // One swapped for another is a removal and an addition, not a reordering.
    expect(changesBetween([fighter], [wizard])).toHaveLength(2)
  })

  it('reports a list as a whole when two entries share a name, or one has none', () => {
    const twice = [
      { name: 'Rope', source: 'PHB' },
      { name: 'Rope', source: 'PHB' },
    ]
    expect(changesBetween(twice, [twice[0]])).toEqual([
      { path: [], before: twice, after: [twice[0]] },
    ])
    expect(changesBetween([{ total: 9 }], [{ total: 12 }])).toEqual([
      { path: [], before: [{ total: 9 }], after: [{ total: 12 }] },
    ])
  })

  it('reports a value that changed kind as a whole', () => {
    expect(changesBetween({ race: undefined }, { race: { name: 'Elf' } })).toEqual([
      { path: ['race'], after: { name: 'Elf' } },
    ])
    expect(changesBetween({ matrix: { scores: [] } }, { matrix: null })).toEqual([
      { path: ['matrix'], before: { scores: [] }, after: null },
    ])
  })
})

describe('characterChanges', () => {
  it('leaves out what the app itself keeps', () => {
    const before = blank()
    const after: Character = {
      ...before,
      id: 'other',
      schemaVersion: 99,
      rollCursors: { ability: 'x' },
      portrait: 'data:image/webp;base64,AAAA',
      history: [],
      createdAt: 1,
      updatedAt: 2,
      name: 'Tordek the Bold',
    }
    expect(characterChanges(before, after)).toEqual([
      { path: ['name'], before: 'Tordek', after: 'Tordek the Bold' },
    ])
  })
})

describe('edited', () => {
  it('applies the patch, moves updatedAt on and records what changed', () => {
    const before = blank()
    const after = edited(before, { name: 'Mialee' }, undefined, T0)

    expect(after.name).toBe('Mialee')
    expect(after.updatedAt).toBe(T0)
    expect(after.history).toHaveLength(1)
    expect(last(after)).toMatchObject({
      at: T0,
      by: 'device',
      changes: [{ path: ['name'], before: 'Tordek', after: 'Mialee' }],
    })
    expect(last(after).action).toBeUndefined()
    expect(before.history).toEqual([]) // the character before is left as it was
  })

  it('records nothing for an edit that changes nothing recorded', () => {
    const before = blank()
    const after = edited(before, { name: 'Tordek', rollCursors: {} }, undefined, T0)
    expect(after.history).toBe(before.history)
    expect(after.updatedAt).toBe(T0)
  })

  it('records edits of the same value that follow each other as one', () => {
    let c = blank()
    c = edited(c, { name: 'M' }, undefined, T0)
    c = edited(c, { name: 'Mi' }, undefined, T0 + 500)
    c = edited(c, { name: 'Mia' }, undefined, T0 + 900)

    expect(c.history).toHaveLength(1)
    expect(last(c)).toMatchObject({
      at: T0 + 900,
      changes: [{ path: ['name'], before: 'Tordek', after: 'Mia' }],
    })
  })

  it('drops an entry whose edits ended where they began', () => {
    let c = blank()
    c = edited(c, { name: 'Tordekk' }, undefined, T0)
    c = edited(c, { name: 'Tordek' }, undefined, T0 + 500)
    expect(c.history).toEqual([])

    // A thing added and taken away again leaves nothing either.
    const wolf = { name: 'Wolf', source: 'MM' }
    c = edited(c, { wildShapes: [wolf] }, undefined, T0 + 600)
    c = edited(c, { wildShapes: [] }, undefined, T0 + 700)
    expect(c.history).toEqual([])
  })

  it('keeps edits apart when they are of other values or further apart in time', () => {
    let c = blank()
    c = edited(c, { name: 'Mialee' }, undefined, T0)
    c = edited(c, { hp: { ...c.hp, flatBonus: 2 } }, undefined, T0 + 100)
    c = edited(c, { hp: { ...c.hp, flatBonus: 3 } }, undefined, T0 + 100 + WINDOW + 1)
    // The name together with something else is not the name alone.
    c = edited(c, { name: 'M', statPool: [1] }, undefined, T0 + 100 + WINDOW + 2)
    expect(
      c.history.map((e) => e.changes.map((change) => change.path.join('.'))),
    ).toEqual([['name'], ['hp.flatBonus'], ['hp.flatBonus'], ['name', 'statPool']])
  })

  it('never folds an edit into an entry of another kind', () => {
    const roll = newRoll({ stream: 'hitDie', kind: 'hit-die', rolls: [6] })
    let c = blank()
    c = edited(c, { hp: { ...c.hp, rolls: [6] } }, rollAction(roll), T0)
    c = edited(c, { hp: { ...c.hp, rolls: [8] } }, undefined, T0 + 1)
    expect(c.history).toHaveLength(2)

    // Nor into an entry the server recorded.
    const server: Character = {
      ...blank(),
      history: [
        { id: 's', at: T0, by: 'server', changes: [{ path: ['name'], after: 'Tordek' }] },
      ],
    }
    expect(edited(server, { name: 'T' }, undefined, T0 + 1).history).toHaveLength(2)
  })

  it('records a roll with what it changed, and makes it the roll in use', () => {
    const scores = [15, 14, 13, 12, 10, 8]
    const roll = newRoll({
      stream: 'ability',
      kind: 'stat-pool',
      config: { dice: 4, rerolls: 0 },
      scores,
    })
    const before = blank()
    const after = edited(before, { statPool: scores }, rollAction(roll), T0)

    expect(last(after)).toMatchObject({
      at: T0,
      action: { type: 'roll', roll },
      changes: [{ path: ['statPool'], before: [], after: scores }],
    })
    expect(after.rollCursors).toEqual({ ability: roll.id })
  })

  it('records every roll, however fast they follow each other', () => {
    let c = blank()
    for (let i = 0; i < 50; i++) {
      const roll = newRoll({ stream: 'hitDie', kind: 'hit-die', rolls: [i] })
      c = edited(c, { hp: { ...c.hp, rolls: [i] } }, rollAction(roll), T0 + i)
    }
    expect(c.history).toHaveLength(50)
  })

  it('stamps the present moment when none is given', () => {
    const before = Date.now()
    const after = edited(blank(), { name: 'Now' })
    expect(after.updatedAt).toBeGreaterThanOrEqual(before)
    expect(last(after).at).toBe(after.updatedAt)
  })
})

describe('the inventory in the history', () => {
  const rope = { name: 'Rope', source: 'PHB', quantity: 1 }
  const sword = { name: 'Vorpal Sword', source: 'DMG', quantity: 1 }
  const withItems = (items: Character['equipment']['items']): Character => {
    const c = blank()
    return { ...c, equipment: { ...c.equipment, items } }
  }
  const setItems = (c: Character, items: Character['equipment']['items']) =>
    edited(c, { equipment: { ...c.equipment, items } }, undefined, T0)

  it('records an item that is added as the whole stack', () => {
    const after = setItems(withItems([]), [sword])
    expect(last(after).changes).toEqual([
      { path: ['equipment', 'items', 'Vorpal Sword|DMG'], after: sword },
    ])
  })

  it('records one more of an item as a change of its quantity', () => {
    const after = setItems(withItems([rope]), [{ ...rope, quantity: 2 }])
    expect(last(after).changes).toEqual([
      { path: ['equipment', 'items', 'Rope|PHB', 'quantity'], before: 1, after: 2 },
    ])
  })

  it('records an item that is removed as the stack it was', () => {
    const after = setItems(withItems([rope, sword]), [rope])
    expect(last(after).changes).toEqual([
      { path: ['equipment', 'items', 'Vorpal Sword|DMG'], before: sword },
    ])
  })

  it('records equipping and attuning as the one field that changed', () => {
    const equipped = setItems(withItems([sword]), [{ ...sword, equipped: true }])
    expect(last(equipped).changes).toEqual([
      { path: ['equipment', 'items', 'Vorpal Sword|DMG', 'equipped'], after: true },
    ])
    const attuned = setItems(withItems([{ ...sword, equipped: true }]), [
      { ...sword, equipped: true, attuned: true },
    ])
    expect(last(attuned).changes).toEqual([
      { path: ['equipment', 'items', 'Vorpal Sword|DMG', 'attuned'], after: true },
    ])
  })

  it('records a change of coins by the coin', () => {
    const c = blank()
    const after = edited(
      c,
      { equipment: { ...c.equipment, currency: { ...c.equipment.currency, gp: 15 } } },
      undefined,
      T0,
    )
    expect(last(after).changes).toEqual([
      { path: ['equipment', 'currency', 'gp'], before: 0, after: 15 },
    ])
  })

  it('records taking starting equipment as one entry: the items, the choice and the coin', () => {
    const c = blank()
    const pick = { source: 'Fighter|XPHB', option: 'A', picks: {}, gold: 400 }
    const after = edited(
      c,
      {
        equipment: {
          items: [{ ...rope, from: 'class' }],
          currency: { ...c.equipment.currency, gp: 4 },
          starting: { class: pick },
        },
      },
      undefined,
      T0,
    )
    expect(after.history).toHaveLength(1)
    expect(last(after).changes).toEqual([
      { path: ['equipment', 'items', 'Rope|PHB'], after: { ...rope, from: 'class' } },
      { path: ['equipment', 'currency', 'gp'], before: 0, after: 4 },
      { path: ['equipment', 'starting', 'class'], after: pick },
    ])
  })
})
