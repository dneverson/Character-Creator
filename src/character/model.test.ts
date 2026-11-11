import { describe, expect, it } from 'vitest'
import {
  BONUS_SLOT_PREFIX,
  CHARACTER_SCHEMA_VERSION,
  createCharacter,
  defaultPlayState,
  ensureCharacterDefaults,
  historyEntry,
  type Character,
  type StoredCharacter,
  DEFAULT_BOOKS,
  DEFAULT_STAT_METHOD,
} from './model'

describe('createCharacter', () => {
  it('builds a fresh character with defaults and a unique id', () => {
    const a = createCharacter('Aragorn')
    const b = createCharacter()
    expect(a.name).toBe('Aragorn')
    expect(b.name).toBe('New Character')
    expect(a.id).not.toBe(b.id)
    expect(a.selectedBooks).toEqual(DEFAULT_BOOKS)
    expect(a.selectedBooks).not.toBe(DEFAULT_BOOKS) // copied, not shared
    expect(a.statMethod).toBe(DEFAULT_STAT_METHOD)
    expect(a.abilities.str).toEqual({ base: null, other: 0 })
    expect(a.equipment.currency).toEqual({ pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 })
  })

  it('starts rested, at the current version, with its creation as its history', () => {
    const c = createCharacter()
    expect(c.schemaVersion).toBe(CHARACTER_SCHEMA_VERSION)
    expect(c.play).toEqual(defaultPlayState())
    expect(c.rollCursors).toEqual({})
    expect(c.history).toEqual([
      {
        id: expect.any(String),
        at: c.createdAt,
        by: 'device',
        action: { type: 'created' },
        changes: [],
      },
    ])
  })
})

describe('historyEntry', () => {
  it('is recorded on the device, with an action only when there is one', () => {
    const plain = historyEntry(5)
    expect(plain).toEqual({ id: expect.any(String), at: 5, by: 'device', changes: [] })
    expect('action' in plain).toBe(false)
    const changes = [{ path: ['name'], before: 'A', after: 'B' }]
    expect(historyEntry(6, { type: 'duplicated', from: 'x' }, changes)).toMatchObject({
      action: { type: 'duplicated', from: 'x' },
      changes,
    })
  })
})

describe('ensureCharacterDefaults', () => {
  it('fills a fully-defaulted character from undefined input', () => {
    const c = ensureCharacterDefaults(undefined)
    expect(c.name).toBe('New Character')
    expect(c.selectedBooks).toEqual(DEFAULT_BOOKS)
    expect(c.classes).toEqual([])
    expect(c.skillProficiencies).toEqual({})
    expect(c.spells).toEqual({})
    expect(c.wildShapes).toEqual([])
    expect(c.story.alignment).toBe('')
    expect(c.hp.method).toBe('average')
  })

  it('preserves supplied values and keeps the provided id/timestamps', () => {
    const raw = {
      id: 'fixed-id',
      name: 'Legolas',
      selectedBooks: ['XPHB'],
      statMethod: 'array' as const,
      statPool: [15, 14, 13],
      classes: [{ name: 'Ranger', source: 'PHB', level: 5 }],
      createdAt: 111,
      updatedAt: 222,
    }
    const c = ensureCharacterDefaults(raw)
    expect(c.id).toBe('fixed-id')
    expect(c.name).toBe('Legolas')
    expect(c.selectedBooks).toEqual(['XPHB'])
    expect(c.statMethod).toBe('array')
    expect(c.statPool).toEqual([15, 14, 13])
    expect(c.classes).toHaveLength(1)
    expect(c.createdAt).toBe(111)
    expect(c.updatedAt).toBe(222)
  })

  it('replaces non-array fields of the wrong type with defaults', () => {
    const c = ensureCharacterDefaults({
      selectedBooks: 'oops' as unknown as string[],
      statPool: 'nope' as unknown as number[],
      classes: null as unknown as [],
      skillProficiencies: 'bad' as unknown as Record<string, string>,
      spells: 42 as unknown as Record<string, never>,
      wildShapes: undefined,
    })
    expect(c.selectedBooks).toEqual(DEFAULT_BOOKS)
    expect(c.statPool).toEqual([])
    expect(c.classes).toEqual([])
    expect(c.skillProficiencies).toEqual({})
    expect(c.spells).toEqual({})
    expect(c.wildShapes).toEqual([])
  })

  it('merges partial ability, hp, currency, and story fields onto defaults', () => {
    const c = ensureCharacterDefaults({
      abilities: { str: { base: 15, other: 1 } } as never,
      hp: { flatBonus: 3 } as never,
      equipment: { currency: { gp: 50 } } as never,
      story: { backstory: 'Raised by wolves.' } as never,
    })
    expect(c.abilities.str).toEqual({ base: 15, other: 1 })
    expect(c.abilities.dex).toEqual({ base: null, other: 0 }) // default retained
    expect(c.hp.flatBonus).toBe(3)
    expect(c.hp.method).toBe('average') // default retained
    expect(c.equipment.currency).toEqual({ pp: 0, gp: 50, ep: 0, sp: 0, cp: 0 })
    expect(c.story.backstory).toBe('Raised by wolves.')
    expect(c.story.ideals).toBe('') // default retained
  })

  it('migrates the legacy Tough checkbox to a bonus Tough feat from the selected books', () => {
    // Schema 16 JSON, as an older save or import would supply it.
    const legacy: Partial<Character> = JSON.parse(
      '{"selectedBooks":["PHB"],"hp":{"method":"rolled","tough":true}}',
    )
    const c = ensureCharacterDefaults(legacy)
    expect(c.hp).toEqual({ method: 'rolled', perLevelBonus: 0, flatBonus: 0, rolls: [] })
    expect(c.feats.bonusSlots).toHaveLength(1)
    const id = c.feats.bonusSlots[0]
    expect(id.startsWith(BONUS_SLOT_PREFIX)).toBe(true)
    expect(c.feats.choices[id]).toEqual({
      kind: 'feat',
      feat: { name: 'Tough', source: 'PHB' },
    })

    const modern = ensureCharacterDefaults(
      JSON.parse('{"selectedBooks":["XPHB"],"hp":{"tough":true}}'),
    )
    expect(Object.values(modern.feats.choices)[0].feat?.source).toBe('XPHB')
  })

  it('drops an unchecked legacy Tough flag and malformed feat state', () => {
    const c = ensureCharacterDefaults(
      JSON.parse(
        '{"hp":{"tough":false},"feats":{"choices":null,"bonusSlots":["bonus:a",3]}}',
      ),
    )
    expect(c.feats).toEqual({ choices: {}, bonusSlots: ['bonus:a'] })
    expect(
      ensureCharacterDefaults(JSON.parse('{"feats":{"bonusSlots":"x"}}')).feats,
    ).toEqual({ choices: {}, bonusSlots: [] })
  })

  it('adds spell grant choices to a saved character and keeps its spells (schema 21)', () => {
    const spells = {
      'Wizard|XPHB': {
        cantrips: [{ name: 'Fire Bolt', source: 'XPHB', level: 0 }],
        spells: [{ name: 'Shield', source: 'XPHB', level: 1 }],
        spellbook: [{ name: 'Shield', source: 'XPHB', level: 1 }],
      },
    }
    const saved = JSON.parse(JSON.stringify({ schemaVersion: 20, spells }))
    const c = ensureCharacterDefaults(saved)
    expect(c.spellGrants).toEqual({})
    expect(c.spells).toEqual(spells)
    expect(c.schemaVersion).toBe(CHARACTER_SCHEMA_VERSION)
  })

  it('keeps supplied spell grant choices and replaces junk', () => {
    const spellGrants = {
      'feat:origin:known:0': {
        picks: [{ name: 'Guidance', source: 'XPHB', level: 0 }],
        ability: 'wis' as const,
        variant: 'Cleric Spells',
      },
    }
    expect(ensureCharacterDefaults({ spellGrants }).spellGrants).toEqual(spellGrants)
    for (const junk of [42, 'x', null, [1]])
      expect(
        ensureCharacterDefaults({
          spellGrants: junk as unknown as Record<string, never>,
        }).spellGrants,
      ).toEqual({})
  })

  it('preserves supplied skill, spell, and wild-shape collections', () => {
    const skillProficiencies = { stealth: 'class:Rogue|PHB' }
    const spells = { 'Wizard|PHB': { cantrips: [], spells: [] } }
    const wildShapes = [{ name: 'Wolf', source: 'MM' }]
    const c = ensureCharacterDefaults({ skillProficiencies, spells, wildShapes })
    expect(c.skillProficiencies).toEqual(skillProficiencies)
    expect(c.spells).toEqual(spells)
    expect(c.wildShapes).toEqual(wildShapes)
  })

  it('carries race and background through untouched', () => {
    const race = {
      name: 'Elf (High)',
      baseName: 'Elf',
      source: 'PHB',
      abilityFixed: { dex: 2 },
      abilityChoices: {},
    }
    const c = ensureCharacterDefaults({ race })
    expect(c.race).toEqual(race)
    expect(c.background).toBeUndefined()
  })

  it('names the background’s ability option as a race’s (schema 19)', () => {
    const stored: StoredCharacter = JSON.parse(
      JSON.stringify({
        schemaVersion: 18,
        background: {
          name: 'Acolyte',
          source: 'XPHB',
          spreadIndex: 1,
          abilityChoices: { wis: 1 },
        },
      }),
    )
    const c = ensureCharacterDefaults(stored)
    expect(c.schemaVersion).toBe(CHARACTER_SCHEMA_VERSION)
    expect(c.background).toEqual({
      name: 'Acolyte',
      source: 'XPHB',
      abilityOption: 1,
      abilityChoices: { wis: 1 },
    })
    // A background that names it already keeps its own; one without either has none.
    const both = { ...stored.background!, abilityOption: 0 }
    expect(ensureCharacterDefaults({ background: both }).background).toEqual({
      name: 'Acolyte',
      source: 'XPHB',
      abilityOption: 0,
      abilityChoices: { wis: 1 },
    })
    const plain = { name: 'Sage', source: 'PHB', abilityChoices: {} }
    expect(ensureCharacterDefaults({ background: plain }).background).toEqual(plain)
  })

  it('stores a feat’s placed increases as a map (schema 20)', () => {
    const stored: StoredCharacter = JSON.parse(
      JSON.stringify({
        schemaVersion: 19,
        feats: {
          bonusSlots: [],
          choices: {
            two: { kind: 'asi', abilityOption: 0, abilityChoices: ['str'] },
            split: { kind: 'asi', abilityOption: 1, abilityChoices: ['str', 'wis'] },
            feat: {
              kind: 'feat',
              feat: { name: 'Grappler', source: 'XPHB' },
              abilityChoices: ['dex', 'dex', 'luck'],
            },
            bare: { kind: 'asi' },
            mapped: { kind: 'feat', abilityChoices: { con: 1 } },
            junk: { kind: 'asi', abilityOption: 0, abilityChoices: ['nope'] },
          },
        },
      }),
    )
    const { choices } = ensureCharacterDefaults(stored).feats
    expect(choices.two.abilityChoices).toEqual({ str: 2 })
    expect(choices.split.abilityChoices).toEqual({ str: 1, wis: 1 })
    expect(choices.feat.abilityChoices).toEqual({ dex: 1 })
    expect(choices.bare.abilityChoices).toBeUndefined()
    expect(choices.mapped.abilityChoices).toEqual({ con: 1 })
    expect(choices.junk.abilityChoices).toEqual({})
    expect(choices.feat.feat).toEqual({ name: 'Grappler', source: 'XPHB' })
  })

  describe('a document from before version 18', () => {
    // As versions up to 17 stored it: the rolls apart, no version, no play state.
    const earlier: StoredCharacter = JSON.parse(
      JSON.stringify({
        id: 'old',
        name: 'Old Hero',
        rollHistory: {
          records: [
            {
              id: 'r1',
              stream: 'ability',
              at: 100,
              kind: 'stat-pool',
              method: '4d6k3r1',
              scores: [15, 14, 13, 12, 10, 8],
            },
            { id: 'r2', stream: 'hitDie', at: 200, kind: 'hit-die', rolls: [8, 5] },
          ],
          cursors: { ability: 'r1', hitDie: 'r2' },
        },
      }),
    )

    it('has its rolls moved into the history, in their place and time', () => {
      const c = ensureCharacterDefaults(earlier)
      expect(c.schemaVersion).toBe(CHARACTER_SCHEMA_VERSION)
      expect('rollHistory' in c).toBe(false)
      expect(c.rollCursors).toEqual({ ability: 'r1', hitDie: 'r2' })
      expect(c.history.slice(0, 2)).toEqual([
        {
          id: 'r1',
          at: 100,
          by: 'device',
          action: {
            type: 'roll',
            roll: {
              id: 'r1',
              stream: 'ability',
              at: 100,
              kind: 'stat-pool',
              // The roll method of version 15 and before, as a roll config.
              config: { dice: 4, rerolls: 1 },
              scores: [15, 14, 13, 12, 10, 8],
            },
          },
          changes: [],
        },
        {
          id: 'r2',
          at: 200,
          by: 'device',
          action: { type: 'roll', roll: earlier.rollHistory?.records?.[1] },
          changes: [],
        },
      ])
    })

    it('says from when its edits are recorded, and starts rested', () => {
      const c = ensureCharacterDefaults(earlier)
      expect(c.history).toHaveLength(3)
      expect(c.history[2]).toMatchObject({
        by: 'device',
        action: { type: 'tracking-started' },
        changes: [],
      })
      expect(c.play).toEqual(defaultPlayState())
    })

    it('gets an empty roll history when it has none, or a broken one', () => {
      const cases: StoredCharacter[] = [
        { ...earlier, rollHistory: undefined },
        { ...earlier, rollHistory: {} },
        JSON.parse(
          JSON.stringify({ ...earlier, rollHistory: { records: 'x', cursors: 'y' } }),
        ),
      ]
      for (const stored of cases) {
        const c = ensureCharacterDefaults(stored)
        expect(c.history.map((e) => e.action?.type)).toEqual(['tracking-started'])
        expect(c.rollCursors).toEqual({})
      }
    })
  })

  describe('a document of the current version', () => {
    it('keeps its history, play state and roll cursors as they are', () => {
      const made = createCharacter('Mialee')
      const stored: Character = {
        ...made,
        rollCursors: { hitDie: 'r9' },
        play: { ...made.play, damage: 7, conditions: ['Prone'] },
      }
      const c = ensureCharacterDefaults(JSON.parse(JSON.stringify(stored)))
      expect(c).toEqual(stored)
    })

    it('drops what is not a history entry, and completes a partial play state', () => {
      const made = createCharacter()
      const c = ensureCharacterDefaults(
        JSON.parse(
          JSON.stringify({
            ...made,
            history: [made.history[0], null, 'x', { id: 1 }, { id: 'a', at: 1 }],
            rollCursors: 'broken',
            play: { tempHp: 4, deathSaves: { failures: 2 }, conditions: 'none' },
          }),
        ),
      )
      expect(c.history).toEqual(made.history)
      expect(c.rollCursors).toEqual({})
      expect(c.play).toEqual({
        ...defaultPlayState(),
        tempHp: 4,
        deathSaves: { successes: 0, failures: 2 },
      })
    })

    it('keeps the number of a newer version of the model', () => {
      const newer = { ...createCharacter(), schemaVersion: CHARACTER_SCHEMA_VERSION + 1 }
      expect(ensureCharacterDefaults(newer).schemaVersion).toBe(
        CHARACTER_SCHEMA_VERSION + 1,
      )
    })
  })
})

const defaultCurrency = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 }

describe('schema 22: the inventory', () => {
  // A character saved at schema 21: stacks of the four fields, a purse, no `starting`.
  const saved: StoredCharacter = JSON.parse(
    JSON.stringify({
      schemaVersion: 21,
      name: 'Tordek',
      equipment: {
        items: [
          { name: 'Rope, Hempen (50 feet)', source: 'PHB', quantity: 2 },
          { name: 'Longsword', source: 'PHB', srdName: 'Longsword', quantity: 1 },
        ],
        currency: { pp: 0, gp: 15, ep: 0, sp: 4, cp: 0 },
      },
    }),
  )

  it('keeps the items and coins of a character saved at 21 and adds the starting equipment', () => {
    const c = ensureCharacterDefaults(saved)
    expect(c.schemaVersion).toBe(CHARACTER_SCHEMA_VERSION)
    expect(c.equipment.items).toEqual(saved.equipment?.items)
    expect(c.equipment.currency).toEqual({ pp: 0, gp: 15, ep: 0, sp: 4, cp: 0 })
    expect(c.equipment.starting).toEqual({})
  })

  it('leaves the new stack fields off, which means carried, not attuned and in no variant', () => {
    const [rope] = ensureCharacterDefaults(saved).equipment.items
    expect(rope.equipped).toBeUndefined()
    expect(rope.attuned).toBeUndefined()
    expect(rope.custom).toBeUndefined()
  })

  it('keeps the fields of a stack and the starting equipment that were saved', () => {
    const c = ensureCharacterDefaults({
      equipment: {
        items: [
          {
            name: 'Gift',
            source: 'Custom',
            quantity: 1,
            equipped: true,
            attuned: true,
            note: 'from the DM',
            custom: { kind: 'wondrous', description: 'Glows.' },
          },
        ],
        currency: defaultCurrency,
        starting: {
          class: { source: 'Fighter|XPHB', option: 'A', picks: {}, gold: 400 },
          background: { source: 'Soldier|XPHB', option: 'B', picks: { s: 'Dice|XPHB' } },
        },
      },
    })
    expect(c.equipment.items[0]).toMatchObject({
      equipped: true,
      attuned: true,
      note: 'from the DM',
    })
    expect(c.equipment.starting.class?.gold).toBe(400)
    expect(c.equipment.starting.background?.picks).toEqual({ s: 'Dice|XPHB' })
  })

  it('drops starting equipment that is not a pick, and an inventory that is not a list', () => {
    const c = ensureCharacterDefaults({
      equipment: {
        items: 'lots' as never,
        currency: defaultCurrency,
        starting: { class: 7, background: { source: 'x' } } as never,
      },
    })
    expect(c.equipment.items).toEqual([])
    expect(c.equipment.starting).toEqual({})
    expect(
      ensureCharacterDefaults({
        equipment: { items: [], currency: defaultCurrency, starting: [] as never },
      }).equipment.starting,
    ).toEqual({})
  })
})
