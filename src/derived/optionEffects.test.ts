import { describe, expect, it } from 'vitest'
import type { Character } from '../character/model'
import type { LoadedClass } from '../data/class'
import type { ClassOption } from '../data/classOptions'
import type { PlayableRace } from '../data/race'
import { ITEMS, build, deps, loadedClass, stack } from '../test/derivedFixtures'
import { makeItem } from '../test/itemFixtures'
import { featurePickCards } from './featurePicks'
import { deriveSheet } from './index'
import { collectSources } from './sources'

/** A class whose table gives options of one type: one at 1st level and one more at 10th. */
const optionClass = (
  name: string,
  types: string[],
  spellcastingAbility?: string,
): LoadedClass => {
  const base = loadedClass(name, ['light', 'medium', 'shield'], ['simple', 'martial'])
  return {
    entry: {
      ...base.entry,
      ...(spellcastingAbility && { spellcastingAbility, casterProgression: 'artificer' }),
      optionalfeatureProgression: types.map((t) => ({
        name: t,
        featureType: [t],
        progression: { '1': 3, '10': 4 },
      })),
    },
    file: {},
  }
}

const option = (key: string, types: string[]): ClassOption => {
  const [name, source] = key.split('|')
  return { key, name, source, types, entries: [`${name} text.`] }
}

const WARLOCK = optionClass('Warlock', ['EI', 'PB'])
const ARTIFICER = optionClass('Artificer', ['AI'], 'int')
const FIGHTER = optionClass('Fighter', ['MV:B'])

const CATALOG: ClassOption[] = [
  option('Agonizing Blast|PHB', ['EI']),
  option('Agonizing Blast|XPHB', ['EI']),
  option('Improved Pact Weapon|XGE', ['EI']),
  option('Lifedrinker|PHB', ['EI']),
  option('Eldritch Mind|TCE', ['EI']),
  option('Eldritch Spear|PHB', ['EI']),
  option('Eldritch Spear|XPHB', ['EI']),
  option('Pact of the Blade|PHB', ['PB']),
  option('Enhanced Defense|TCE', ['AI']),
  option('Enhanced Arcane Focus|TCE', ['AI']),
  option('Arcane Propulsion Armor|TCE', ['AI']),
  option('Helm of Awareness|TCE', ['AI']),
  option('Trip Attack|PHB', ['MV:B']),
]

const WAND = makeItem({ name: 'Wand', kind: 'wand' })
const HELM = makeItem({ name: 'Helmet', kind: 'gear' })

const HUMAN: PlayableRace = {
  key: 'human|phb',
  name: 'Human',
  baseName: 'Human',
  source: 'PHB',
  baseSource: 'PHB',
  speed: { walk: 30 },
  abilityOptions: [],
  featGrants: [],
}

const sheetOf = (c: Character, cls: LoadedClass) => {
  c.race = {
    name: 'Human',
    baseName: 'Human',
    source: 'PHB',
    abilityFixed: {},
    abilityChoices: {},
  }
  const items = [...ITEMS, WAND, HELM]
  const d = { ...deps([cls], items), optionCatalog: CATALOG, race: HUMAN }
  return { sheet: deriveSheet(c, d), sources: collectSources(c, d), items }
}

const of = (
  className: string,
  level: number,
  scores: Parameters<typeof build>[2],
  stacks: Parameters<typeof build>[3],
  classOptions: Record<string, string[]>,
) => {
  const c = build(className, level, scores, stacks)
  c.selectedBooks = ['PHB', 'XGE', 'TCE', 'XPHB']
  c.classOptions = classOptions
  return c
}

const BLADE = 'option:Pact of the Blade|PHB|pick:Pact weapon'

describe('a pact weapon', () => {
  const warlock = (picks: Record<string, string[]>, stacks = [stack('Longsword')]) =>
    sheetOf(
      of('Warlock', 9, { str: 10, cha: 18 }, stacks, {
        'class:Warlock|PHB|EI': [
          'Agonizing Blast|PHB',
          'Improved Pact Weapon|XGE',
          'Lifedrinker|PHB',
        ],
        'class:Warlock|PHB|PB': ['Pact of the Blade|PHB'],
        ...picks,
      }),
      WARLOCK,
    )

  it('adds Improved Pact Weapon and Lifedrinker to the attacks with the picked weapon', () => {
    const { sheet } = warlock({ [BLADE]: ['longsword|phb'] })
    const row = sheet.attacks.find((a) => a.name === 'Longsword')
    const hit = row?.toHit.lines.find((l) => l.label === 'Improved Pact Weapon')
    expect(hit).toMatchObject({ op: 'add', amount: 1, status: 'applied' })
    const damage = row?.damage.bonus.lines.filter((l) => l.id.includes('|option|'))
    expect(damage?.map((l) => [l.label, l.amount])).toEqual([
      ['Improved Pact Weapon', 1],
      ['Lifedrinker', 4],
    ])
    expect(row?.notes.some((n) => n.startsWith('Pact of the Blade:'))).toBe(true)
  })

  it('leaves a weapon that is not the pact weapon alone, and a magic one without the +1', () => {
    const { sheet } = warlock({ [BLADE]: ['+1 longsword|phb'] }, [
      stack('Longsword'),
      stack('+1 Longsword'),
    ])
    const plain = sheet.attacks.find((a) => a.name === 'Longsword')
    expect(plain?.toHit.lines.some((l) => l.id.includes('|option|'))).toBe(false)
    const magic = sheet.attacks.find((a) => a.name === '+1 Longsword')
    expect(
      magic?.toHit.lines.find((l) => l.label === 'Improved Pact Weapon'),
    ).toMatchObject({
      status: 'inactive',
      why: 'The weapon already has a magic bonus to those rolls.',
    })
  })

  it("puts Agonizing Blast's Charisma on its row, and flags an unpicked pact weapon", () => {
    const { sheet } = warlock({})
    const blast = sheet.features.find((f) => f.name === 'Agonizing Blast')
    expect(blast?.lines?.[0]).toMatchObject({ amount: 4 })
    expect(blast?.lines?.[0].how).toContain('Eldritch Blast')
    const pact = sheet.features.find((f) => f.name === 'Pact of the Blade')
    expect(pact?.lines?.some((l) => l.status === 'flag')).toBe(true)
  })

  it('gives Eldritch Spear (2014) a 300 foot eldritch blast on its row', () => {
    const { sheet } = warlock({ 'class:Warlock|PHB|EI': ['Eldritch Spear|PHB'] })
    const spear = sheet.features.find((f) => f.name === 'Eldritch Spear')
    expect(spear?.lines?.[0].how).toBe('Range of Eldritch Blast is 300 feet')
  })

  it('adds 30 feet per Warlock level to the cantrip picked for Eldritch Spear (2024)', () => {
    const { sheet } = warlock({
      'class:Warlock|PHB|EI': ['Eldritch Spear|XPHB'],
      'option:Eldritch Spear|XPHB|pick:Eldritch Spear cantrip': ['eldritch blast|phb'],
    })
    const spear = sheet.features.find((f) => f.name === 'Eldritch Spear')
    expect(spear?.lines?.[0]).toMatchObject({ op: 'add', amount: 30 * 9 })
    expect(spear?.lines?.[0].how).toContain('Eldritch Blast')
  })

  it("lists each option's effect on the spell it changes, for that spell's own row", () => {
    const { sheet } = warlock({
      'class:Warlock|PHB|EI': ['Agonizing Blast|PHB', 'Eldritch Spear|PHB'],
    })
    expect(Object.keys(sheet.spellEffects)).toEqual(['eldritch blast|phb'])
    const [damage, range] = sheet.spellEffects['eldritch blast|phb']
    expect(damage).toMatchObject({
      label: 'Agonizing Blast',
      amount: 4,
      how: 'Charisma modifier to the damage of this spell',
    })
    expect(range).toMatchObject({
      label: 'Eldritch Spear',
      op: 'base',
      amount: 300,
      on: 'range',
      how: 'Range of this spell is 300 feet',
    })
    expect(damage.on).toBe('damage')
  })

  it('lists the riders of Repelling Blast, Grasp of Hadar and Lance of Lethargy on the spell', () => {
    const { sheet } = warlock({
      'class:Warlock|PHB|EI': [
        'Repelling Blast|PHB',
        'Grasp of Hadar|XGE',
        'Lance of Lethargy|XGE',
      ],
    })
    const lines = sheet.spellEffects['eldritch blast|phb']
    expect(lines.map((l) => [l.label, l.op, l.on])).toEqual([
      ['Repelling Blast', 'note', undefined],
      ['Grasp of Hadar', 'note', undefined],
      ['Lance of Lethargy', 'note', undefined],
    ])
    expect(lines[1].how).toBe('once a turn, pull the creature hit 10 feet closer')
  })

  it('lists the 2024 range the picked cantrip gets, and nothing while none is picked', () => {
    const picked = warlock({
      'class:Warlock|PHB|EI': ['Eldritch Spear|XPHB'],
      'option:Eldritch Spear|XPHB|pick:Eldritch Spear cantrip': ['eldritch blast|phb'],
    })
    expect(picked.sheet.spellEffects['eldritch blast|phb']?.[0]).toMatchObject({
      amount: 270,
      how: 'feet added to the range of this spell (30 feet times 9 class levels)',
    })
    const none = warlock({ 'class:Warlock|PHB|EI': ['Eldritch Spear|XPHB'] })
    expect(none.sheet.spellEffects).toEqual({})
  })

  it('flags Eldritch Spear (2024) with no cantrip picked', () => {
    const { sheet } = warlock({ 'class:Warlock|PHB|EI': ['Eldritch Spear|XPHB'] })
    const spear = sheet.features.find((f) => f.name === 'Eldritch Spear')
    expect(spear?.lines?.[0].status).toBe('flag')
  })

  it('offers the weapons of the inventory on the pact weapon card', () => {
    const { sources, items } = warlock({}, [stack('Longsword'), stack('Longbow')])
    const card = featurePickCards(sources, { items }).find((c) => c.tag === BLADE)
    const chips = card?.chips.map((c) => [c.value, c.unmet]) ?? []
    expect(chips).toContainEqual(['longsword|phb', undefined])
    // A bow only with Improved Pact Weapon, which this warlock has.
    expect(chips).toContainEqual(['longbow|phb', undefined])
  })
})

describe('infusions', () => {
  const INFUSED = (name: string) => `option:${name}|TCE|pick:Infused item`
  const artificer = (
    level: number,
    extra: Record<string, string[]> = {},
    attuned = true,
    more: ReturnType<typeof stack>[] = [],
  ) =>
    sheetOf(
      of(
        'Artificer',
        level,
        { dex: 14, int: 16 },
        [
          stack('Leather Armor', { attuned }),
          stack('Shield'),
          stack('Wand', { attuned }),
          stack('Helmet', { attuned }),
          ...more,
        ],
        {
          'class:Artificer|PHB|AI': [
            'Enhanced Defense|TCE',
            'Enhanced Arcane Focus|TCE',
            'Arcane Propulsion Armor|TCE',
            'Helm of Awareness|TCE',
          ],
          [INFUSED('Enhanced Defense')]: ['shield|phb'],
          [INFUSED('Enhanced Arcane Focus')]: ['wand|phb'],
          [INFUSED('Arcane Propulsion Armor')]: ['leather armor|phb'],
          [INFUSED('Helm of Awareness')]: ['helmet|phb'],
          ...extra,
        },
      ),
      ARTIFICER,
    )

  it('adds Enhanced Defense to armor class, +2 from the 10th level', () => {
    const at = (level: number) =>
      artificer(level).sheet.ac.lines.find((l) => l.label === 'Enhanced Defense')
    expect(at(2)).toMatchObject({
      amount: 1,
      status: 'applied',
      how: 'Infused into Shield',
    })
    expect(at(10)?.amount).toBe(2)
  })

  it('adds Enhanced Arcane Focus to the spell attack, and nothing without attunement', () => {
    const lineOf = (attuned: boolean) =>
      artificer(2, {}, attuned)
        .sheet.spellStats.flatMap((r) => r.attack.lines)
        .find((l) => l.label === 'Enhanced Arcane Focus')
    expect(lineOf(true)).toMatchObject({ amount: 1, status: 'applied' })
    expect(lineOf(false)).toMatchObject({
      status: 'inactive',
      why: 'The infused item needs attunement, and you are not attuned.',
    })
  })

  it('adds the propulsion armor to the walking speed and the helm to initiative', () => {
    const { sheet } = artificer(2)
    expect(
      sheet.speed.lines.find((l) => l.label === 'Arcane Propulsion Armor'),
    ).toMatchObject({
      amount: 5,
    })
    expect(
      sheet.combat.initiative.lines.find((l) => l.label === 'Helm of Awareness'),
    ).toMatchObject({ op: 'note', status: 'conditional' })
  })

  it('flags an infusion without its item on its row', () => {
    const { sheet } = artificer(2, { [INFUSED('Enhanced Defense')]: [] })
    const row = sheet.features.find((f) => f.name === 'Enhanced Defense')
    expect(row?.lines?.[0]).toMatchObject({ status: 'flag' })
  })

  it('marks a magic item on the infused item card as needing the DM', () => {
    const { sources, items } = artificer(2, {}, true, [stack('+1 Shield')])
    const card = featurePickCards(sources, { items }).find(
      (c) => c.tag === INFUSED('Enhanced Defense'),
    )
    const chips = card?.chips.map((c) => [c.value, c.unmet])
    expect(chips).toContainEqual(['shield|phb', undefined])
    expect(chips).toContainEqual([
      '+1 shield|phb',
      'An infusion goes into a nonmagical object - allowed with DM approval',
    ])
    // Not a suit of armor's pick: a shield is not one.
    const armor = featurePickCards(sources, { items }).find(
      (c) => c.tag === INFUSED('Arcane Propulsion Armor'),
    )
    expect(armor?.chips.map((c) => c.value)).toEqual(['leather armor|phb'])
  })
})

describe('advantage and superiority dice', () => {
  it('notes Eldritch Mind on the Constitution save', () => {
    const { sheet } = sheetOf(
      of('Warlock', 2, {}, [], { 'class:Warlock|PHB|EI': ['Eldritch Mind|TCE'] }),
      WARLOCK,
    )
    expect(
      sheet.saves.con.total.lines.find((l) => l.label === 'Eldritch Mind'),
    ).toMatchObject({
      op: 'note',
      status: 'conditional',
      when: 'to maintain concentration',
    })
  })

  it('shows the superiority die on a maneuver row only with dice to fuel it', () => {
    const { sheet } = sheetOf(
      of('Fighter', 3, {}, [], { 'class:Fighter|PHB|MV:B': ['Trip Attack|PHB'] }),
      FIGHTER,
    )
    const row = sheet.features.find((f) => f.name === 'Trip Attack')
    // This fighter has no Battle Master's Combat Superiority: no dice, no line.
    expect(row?.lines ?? []).toEqual([])
  })
})
