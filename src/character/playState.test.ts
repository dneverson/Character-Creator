import { describe, expect, it } from 'vitest'
import { edited } from './history'
import { createCharacter, defaultPlayState, ensureCharacterDefaults } from './model'

/** A stored copy of a character with this play state, as a file would hold it. */
const stored = (play: unknown) =>
  JSON.parse(JSON.stringify({ ...createCharacter(), play }))

describe('the play state of a stored document', () => {
  it('gives a document saved before the new play fields existed their defaults', () => {
    const old = stored({
      damage: 3,
      tempHp: 2,
      deathSaves: { successes: 1, failures: 0 },
      conditions: ['Prone'],
      exhaustion: 1,
      inspiration: true,
    })
    old.schemaVersion = 23
    expect(ensureCharacterDefaults(old).play).toEqual({
      ...defaultPlayState(),
      damage: 3,
      tempHp: 2,
      deathSaves: { successes: 1, failures: 0 },
      conditions: ['Prone'],
      exhaustion: 1,
      inspiration: true,
    })
  })

  it('keeps valid new fields and drops what is not valid', () => {
    const c = ensureCharacterDefaults(
      stored({
        damage: -4,
        tempHp: 'x',
        exhaustion: 2.7,
        inspiration: 'yes',
        conditions: ['Prone', 4, null],
        hitDiceSpent: { d8: 2, d6: -1, d10: 'x' },
        slotsSpent: [1, 'x', 2],
        pactSpent: 1,
        uses: { rage: 1, bad: null },
        concentration: { name: 'Bless', source: 'PHB' },
      }),
    )
    expect(c.play).toEqual({
      ...defaultPlayState(),
      exhaustion: 2,
      conditions: ['Prone'],
      hitDiceSpent: { d8: 2 },
      slotsSpent: [1, 0, 2],
      pactSpent: 1,
      uses: { rage: 1 },
      concentration: { name: 'Bless', source: 'PHB' },
    })
  })

  it('reads a broken concentration, record or list as the default', () => {
    const c = ensureCharacterDefaults(
      stored({
        concentration: { name: 4 },
        hitDiceSpent: [1],
        uses: 'x',
        slotsSpent: 'x',
      }),
    )
    expect(c.play).toEqual(defaultPlayState())
  })

  it('is complete for a document with no play state at all', () => {
    const old = stored(undefined)
    delete old.play
    expect(ensureCharacterDefaults(old).play).toEqual(defaultPlayState())
  })
})

describe('play edits in the history', () => {
  it('records a play change and merges quick ones on the same values', () => {
    const made = createCharacter()
    const a = edited(made, { play: { ...made.play, damage: 3 } }, undefined, 1000)
    const b = edited(a, { play: { ...a.play, damage: 8 } }, undefined, 2000)
    expect(b.history).toHaveLength(2)
    expect(b.history.at(-1)?.changes).toEqual([
      { path: ['play', 'damage'], before: 0, after: 8 },
    ])
  })

  it('records a spent slot as a change of the play state', () => {
    const made = createCharacter()
    const next = edited(made, { play: { ...made.play, slotsSpent: [1] } })
    expect(next.history.at(-1)?.changes[0].path).toEqual(['play', 'slotsSpent'])
  })
})
