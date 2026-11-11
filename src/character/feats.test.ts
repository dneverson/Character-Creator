import { describe, expect, it } from 'vitest'
import type { ClassFeatureEntry, LoadedClass } from '../data/class'
import type { PlayableBackground } from '../data/background'
import { ASI_OPTIONS, type FeatGrant } from '../data/feats'
import { parseAbilityOptions } from '../data/abilityOptions'
import type { PlayableRace } from '../data/race'
import { makeFeat } from '../test/featFixtures'
import { createCharacter, type Character, type ClassRef, type FeatChoice } from './model'
import { featRuleFlags, featSlots, resolveFeats, type FeatContext } from './feats'

// ---- Fixtures ---------------------------------------------------------------

const poolEntry = (
  name: string,
  level: number,
  entries: ClassFeatureEntry['entries'],
) => ({
  name,
  source: 'XPHB',
  className: 'Fighter',
  classSource: 'XPHB',
  level,
  entries,
})

const fighter: LoadedClass = {
  entry: {
    name: 'Fighter',
    source: 'XPHB',
    hd: { number: 1, faces: 10 },
    classFeatures: [
      'Fighting Style|Fighter|XPHB|1',
      'Action Surge|Fighter|XPHB|2',
      'Ability Score Improvement|Fighter|XPHB|4',
      'Ability Score Improvement|Fighter|XPHB|6',
      'Epic Boon|Fighter|XPHB|19',
    ],
  },
  file: {
    classFeature: [
      poolEntry('Fighting Style', 1, [
        'You gain a {@filter Fighting Style feat|feats|category=FS;FS:P} of your choice.',
        // A filter link without a category adds nothing.
        'See {@filter the list|feats|source=XPHB}.',
        { type: 'refFeat', feat: 'Archery|XPHB' },
        { type: 'entries', entries: [{ type: 'refFeat', feat: 'Archery|XPHB' }] },
      ]),
      poolEntry('Action Surge', 2, ['Take one additional action.']),
    ],
  },
}

const wizard: LoadedClass = {
  entry: {
    name: 'Wizard',
    source: 'XPHB',
    hd: { number: 1, faces: 6 },
    classFeatures: ['Ability Score Improvement|Wizard|XPHB|4'],
  },
  file: {},
}

// A feature listed twice at one level gets distinct slot ids.
const twin: LoadedClass = {
  entry: {
    name: 'Twin',
    source: 'X',
    classFeatures: [
      'Ability Score Improvement|Twin|X|1',
      'Ability Score Improvement|Twin|X|1',
    ],
  },
  file: {},
}

const classByKey = new Map([
  ['Fighter|XPHB', fighter],
  ['Wizard|XPHB', wizard],
  ['Twin|X', twin],
])

function race(featGrants: FeatGrant[]): PlayableRace {
  return {
    key: 'human|xphb',
    name: 'Human',
    baseName: 'Human',
    source: 'XPHB',
    size: ['M'],
    abilityOptions: [],
    featGrants,
  }
}

function background(featGrants: FeatGrant[]): PlayableBackground {
  return {
    key: 'soldier|xphb',
    name: 'Soldier',
    source: 'XPHB',
    edition: 'one',
    abilityOptions: [],
    storyTables: [],
    featGrants,
    entries: [],
  }
}

const alert = makeFeat({ name: 'Alert', category: 'O' })
const archery = makeFeat({ name: 'Archery', category: 'FS' })
const grappler = makeFeat({
  name: 'Grappler',
  category: 'G',
  abilityOptions: parseAbilityOptions([{ choose: { from: ['str', 'dex'] } }]),
})
const tough = makeFeat({ name: 'Tough', category: 'O', hp: { perLevel: 2, flat: 0 } })
const skilled = makeFeat({
  name: 'Skilled',
  category: 'O',
  repeatable: true,
  skills: { fixed: ['athletics'], choices: [] },
  hp: { perLevel: 0, flat: 3 },
})
const fire = makeFeat({
  name: 'Elemental Adept; Fire',
  label: 'Elemental Adept (Fire)',
  baseName: 'Elemental Adept',
  repeatable: true,
})
const cold = makeFeat({
  name: 'Elemental Adept; Cold',
  label: 'Elemental Adept (Cold)',
  baseName: 'Elemental Adept',
  repeatable: true,
})
const feats = [alert, archery, grappler, tough, skilled, fire, cold]

function character(
  classes: ClassRef[] = [],
  choices: Record<string, FeatChoice> = {},
  bonusSlots: string[] = [],
): Character {
  const c = createCharacter('Tester')
  c.classes = classes
  c.race = {
    name: 'Human',
    baseName: 'Human',
    source: 'XPHB',
    abilityFixed: {},
    abilityChoices: {},
  }
  c.background = { name: 'Soldier', source: 'XPHB', abilityChoices: {} }
  c.feats = { choices, bonusSlots }
  return c
}

const ctx = (over: Partial<FeatContext> = {}): FeatContext => ({
  feats,
  classByKey,
  ...over,
})

const pick = (feat: { name: string; source: string }, extra: Partial<FeatChoice> = {}) =>
  ({
    kind: 'feat',
    feat: { name: feat.name, source: feat.source },
    ...extra,
  }) as FeatChoice

const RACE_SLOT = 'race:Human||XPHB:0'
const BG_SLOT = 'bg:Soldier|XPHB:0'
const STYLE_SLOT = 'class:Fighter|XPHB:1:Fighting Style'
const ASI4_SLOT = 'class:Fighter|XPHB:4:Ability Score Improvement'

// ---- Slots ------------------------------------------------------------------

describe('featSlots', () => {
  it('lists race, background, class, then bonus slots in the order gained', () => {
    const c = character(
      [
        { name: 'Fighter', source: 'XPHB', level: 19 },
        { name: 'Wizard', source: 'XPHB', level: 4 },
        { name: 'Ghost', source: 'ZZZ', level: 3 },
      ],
      {},
      ['bonus:a', 'bonus:b'],
    )
    const slots = featSlots(
      c,
      ctx({
        race: race([
          { named: [], categories: 'any' },
          { named: [], categories: ['O'] },
        ]),
        background: background([{ named: ['alert|xphb'], categories: [] }]),
      }),
    )
    expect(slots.map((s) => s.label)).toEqual([
      'Human - Feat 1',
      'Human - Feat 2',
      'Soldier background - Feat',
      'Fighter level 1 - Fighting Style',
      'Fighter level 4 - Ability Score Improvement',
      'Wizard level 4 - Ability Score Improvement',
      'Fighter level 6 - Ability Score Improvement',
      'Fighter level 19 - Epic Boon',
      'Bonus feat 1',
      'Bonus feat 2',
    ])
    expect(slots.map((s) => s.id).slice(0, 4)).toEqual([
      RACE_SLOT,
      'race:Human||XPHB:1',
      BG_SLOT,
      STYLE_SLOT,
    ])
    expect(slots[0]).toMatchObject({
      origin: 'race',
      allowsAsi: false,
      preferred: [],
      level: 1,
    })
    expect(slots[1].preferred).toEqual(['O'])
    expect(slots[2]).toMatchObject({ origin: 'background', named: ['alert|xphb'] })
    // Fighting Style: the linked categories, and each named feat once.
    expect(slots[3]).toMatchObject({
      allowsAsi: false,
      categories: ['FS', 'FS:P'],
      named: ['archery|xphb'],
      preferred: ['FS', 'FS:P'],
    })
    expect(slots[4]).toMatchObject({ allowsAsi: true, categories: 'any', preferred: [] })
    expect(slots[7]).toMatchObject({
      allowsAsi: true,
      categories: 'any',
      preferred: ['EB'],
    })
    expect(slots[8]).toMatchObject({
      id: 'bonus:a',
      origin: 'bonus',
      allowsAsi: true,
      level: 0,
    })
  })

  it('numbers a single bonus slot plainly and skips unset race or background', () => {
    const c = character([], {}, ['bonus:a'])
    c.race = undefined
    c.background = undefined
    const slots = featSlots(
      c,
      ctx({ race: race([{ named: [], categories: 'any' }]), background: background([]) }),
    )
    expect(slots.map((s) => s.label)).toEqual(['Bonus feat'])
  })

  it('gives a repeated feature at one level distinct ids', () => {
    const slots = featSlots(character([{ name: 'Twin', source: 'X', level: 1 }]), ctx())
    expect(slots.map((s) => s.id)).toEqual([
      'class:Twin|X:1:Ability Score Improvement',
      'class:Twin|X:1:Ability Score Improvement#2',
    ])
  })
})

// ---- Resolution -------------------------------------------------------------

describe('resolveFeats', () => {
  const fighter4 = { name: 'Fighter', source: 'XPHB', level: 4 }

  it('flags empty slots and fills a single named grant automatically', () => {
    const summary = resolveFeats(
      character([fighter4]),
      ctx({
        race: race([{ named: [], categories: 'any' }]),
        background: background([{ named: ['alert|xphb'], categories: [] }]),
      }),
    )
    const [raceSlot, bgSlot, style, asi] = summary.slots
    expect(raceSlot.flags).toEqual([
      { kind: 'incomplete', message: 'No choice made yet' },
    ])
    expect(bgSlot).toMatchObject({ kind: 'feat', auto: true, feat: alert, flags: [] })
    expect(style.flags[0].message).toBe('No choice made yet')
    expect(asi.flags[0].message).toBe('No choice made yet')
  })

  it('flags an automatic grant whose feat is not in the data', () => {
    const summary = resolveFeats(
      character(),
      ctx({ background: background([{ named: ['ghost|zzz'], categories: [] }]) }),
    )
    expect(summary.slots[0]).toMatchObject({ auto: true, missing: 'ghost|zzz' })
    expect(summary.slots[0].flags).toEqual([
      { kind: 'missing', message: 'Feat not found in the data: ghost|zzz' },
    ])
  })

  it('ignores a stale Ability Score Improvement on a feat-only slot', () => {
    const summary = resolveFeats(
      character([], { [RACE_SLOT]: { kind: 'asi', abilityChoices: { str: 2 } } }),
      ctx({ race: race([{ named: [], categories: 'any' }]) }),
    )
    expect(summary.slots[0].kind).toBeUndefined()
    expect(summary.slots[0].flags[0].message).toBe('No choice made yet')
  })

  it('applies an Ability Score Improvement and flags missing picks and the cap', () => {
    const c = character([fighter4], {
      [ASI4_SLOT]: { kind: 'asi', abilityOption: 0, abilityChoices: { str: 2 } },
    })
    c.abilities.str = { base: 19, other: 0 }
    const asi = resolveFeats(c, ctx()).slots[1]
    expect(asi.option).toBe(ASI_OPTIONS[0])
    expect(asi.increases).toEqual({ str: 2 })
    expect(asi.flags).toEqual([{ kind: 'cap', message: 'Raises Strength above 20' }])

    c.feats.choices[ASI4_SLOT] = {
      kind: 'asi',
      abilityOption: 1,
      abilityChoices: { dex: 1 },
    }
    const split = resolveFeats(c, ctx())
    expect(split.slots[1].flags).toEqual([
      { kind: 'incomplete', message: 'Choose 2 ability scores to increase' },
    ])
    expect(split.abilityBonus).toEqual({ dex: 1 })

    // An out-of-range option falls back to the first; no picks yet.
    c.feats.choices[ASI4_SLOT] = { kind: 'asi', abilityOption: 9 }
    const fallback = resolveFeats(c, ctx()).slots[1]
    expect(fallback.option).toBe(ASI_OPTIONS[0])
    expect(fallback.flags[0].message).toBe('Choose 1 ability score to increase')
  })

  it('flags a feat slot with no feat, and a saved feat missing from the data', () => {
    const c = character(
      [],
      { 'bonus:a': { kind: 'feat' }, 'bonus:b': pick({ name: 'Ghost', source: 'ZZZ' }) },
      ['bonus:a', 'bonus:b'],
    )
    const [empty, ghost] = resolveFeats(c, ctx()).slots
    expect(empty.flags).toEqual([{ kind: 'incomplete', message: 'No feat chosen yet' }])
    expect(ghost.missing).toBe('Ghost (ZZZ)')
    expect(ghost.option).toBeUndefined()
    expect(ghost.flags).toEqual([
      { kind: 'missing', message: 'Feat not found in the data: Ghost (ZZZ)' },
    ])
  })

  it('applies a feat ability option', () => {
    const c = character(
      [],
      { 'bonus:a': pick(grappler, { abilityChoices: { dex: 1, wis: 1 } }) },
      ['bonus:a'],
    )
    const summary = resolveFeats(c, ctx())
    expect(summary.slots[0].increases).toEqual({ dex: 1 })
    expect(summary.abilityBonus).toEqual({ dex: 1 })
    expect(summary.slots[0].flags).toEqual([])
  })

  it('checks prerequisites at the slot level, with earlier feats and class features', () => {
    const late = makeFeat({ name: 'Late', prerequisites: [{ level: 4 }] })
    const styled = makeFeat({
      name: 'Styled',
      prerequisites: [{ feature: ['Fighting Style'], featCategory: ['FS'] }],
    })
    const odd = makeFeat({ name: 'Odd', prerequisites: [{ campaign: ['Eberron'] }] })
    const c = character(
      [fighter4, { name: 'Ghost', source: 'ZZZ', level: 1 }],
      {
        [RACE_SLOT]: pick(late),
        [STYLE_SLOT]: pick(archery),
        [ASI4_SLOT]: pick(late),
        'bonus:a': pick(styled),
        'bonus:b': pick(odd),
      },
      ['bonus:a', 'bonus:b'],
    )
    const all = [...feats, late, styled, odd]
    const slots = resolveFeats(
      c,
      ctx({ feats: all, race: race([{ named: [], categories: 'any' }]) }),
    ).slots
    // Race slots are gained at level 1, so "Level 4" fails there.
    expect(slots[0].flags).toEqual([
      { kind: 'prerequisite', message: 'Prerequisite not met: Level 4' },
    ])
    expect(slots[1].flags).toEqual([])
    // At character level 5 it passes (the repeat is flagged separately).
    expect(slots[2].flags.map((f) => f.kind)).toEqual(['repeat'])
    expect(slots[3].flags).toEqual([])
    expect(slots[4].flags).toEqual([
      {
        kind: 'unchecked',
        message: 'Prerequisite could not be checked: Eberron campaign',
      },
    ])
  })

  it('gives each slot the character as it stands before it (level 1 for race and background)', () => {
    const c = character([fighter4], { [STYLE_SLOT]: pick(archery) })
    const slots = resolveFeats(
      c,
      ctx({
        race: race([{ named: [], categories: 'any' }]),
        background: background([{ named: ['alert|xphb'], categories: [] }]),
      }),
    ).slots
    const byId = new Map(slots.map((sl) => [sl.slot.id, sl.context]))
    expect(byId.get(RACE_SLOT)?.level).toBe(1)
    expect(byId.get(BG_SLOT)?.level).toBe(1)
    expect(byId.get(ASI4_SLOT)?.level).toBe(4)
    expect(byId.get(ASI4_SLOT)?.priorFeats.map((f) => f.name)).toEqual([
      'Alert',
      'Archery',
    ])
  })

  it('checks a feat against feats of later slots as well, for a table of rows', () => {
    const c = character([], { 'bonus:a': pick(alert), 'bonus:b': pick(fire) }, [
      'bonus:a',
      'bonus:b',
    ])
    const [first, second] = resolveFeats(c, ctx()).slots
    // Offered in the first slot, with the later slots' feats taken.
    const later = [
      { feat: alert, slotLabel: 'Bonus feat 1' },
      { feat: fire, slotLabel: 'Bonus feat 2' },
    ]
    expect(featRuleFlags(fire, first.slot, first.context, later)).toEqual([
      {
        kind: 'repeat',
        message: 'Already taken with this option',
        takenIn: 'Bonus feat 2',
      },
    ])
    expect(featRuleFlags(alert, first.slot, first.context, later)[0]).toMatchObject({
      kind: 'repeat',
      takenIn: 'Bonus feat 1',
    })
    expect(featRuleFlags(cold, second.slot, second.context, later)).toEqual([])
    expect(featRuleFlags(skilled, second.slot, second.context, later)).toEqual([])
  })

  it('flags repeats of a non-repeatable feat and of the same version', () => {
    const c = character(
      [],
      {
        'bonus:a': pick(alert),
        'bonus:b': pick(alert),
        'bonus:c': pick(fire),
        'bonus:d': pick(cold),
        'bonus:e': pick(fire),
        'bonus:f': pick(skilled),
        'bonus:g': pick(skilled),
      },
      ['bonus:a', 'bonus:b', 'bonus:c', 'bonus:d', 'bonus:e', 'bonus:f', 'bonus:g'],
    )
    const flags = resolveFeats(c, ctx()).slots.map((s) => s.flags.map((f) => f.message))
    expect(flags).toEqual([
      [],
      ['Already taken; this feat is not repeatable'],
      [],
      [],
      ['Already taken with this option'],
      [],
      [],
    ])
  })

  it('flags a feat outside the slot categories or named grant', () => {
    const c = character([fighter4], {
      [BG_SLOT]: pick(tough),
      [STYLE_SLOT]: pick(grappler, { abilityChoices: { str: 1 } }),
    })
    const slots = resolveFeats(
      c,
      ctx({ background: background([{ named: ['alert|xphb'], categories: [] }]) }),
    ).slots
    expect(slots[0].flags).toEqual([
      { kind: 'category', message: 'Not the feat this slot grants' },
    ])
    expect(slots[1].flags).toEqual([
      {
        kind: 'category',
        message:
          'Not in the Fighting Style or Fighting Style Replacement (Paladin) feat category',
      },
    ])
  })

  it('totals hit points and lists feat skill sources', () => {
    const c = character([], { 'bonus:a': pick(tough), 'bonus:b': pick(skilled) }, [
      'bonus:a',
      'bonus:b',
    ])
    const summary = resolveFeats(c, ctx())
    expect(summary.hp).toEqual({ perLevel: 2, flat: 3 })
    expect(summary.skillSources).toEqual([
      {
        tag: 'feat:bonus:b',
        label: 'Feat · Skilled',
        kind: 'feat',
        fixed: ['athletics'],
        choices: [],
      },
    ])
  })
})
