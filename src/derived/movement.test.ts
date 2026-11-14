import { describe, expect, it } from 'vitest'
import { deriveSheet } from '.'
import type { Item } from '../data/items'
import type { PlayableRace } from '../data/race'
import { build, deps, featOf, loadedClass, stack } from '../test/derivedFixtures'
import { makeItem } from '../test/itemFixtures'
import { characterEdition } from './edition'
import { hitDice } from './hitDice'
import { senseRows } from './senses'
import { deriveSlots } from './slots'
import { collectSources } from './sources'
import { speedQuantity } from './speed'
import type { SourceRef } from './types'

const feature = (name: string, className: string, level: number, source = 'PHB') => ({
  name,
  source,
  className,
  classSource: source,
  level,
  entries: [],
})

const elf: PlayableRace = {
  key: 'wood elf|phb',
  name: 'Wood Elf',
  baseName: 'Elf',
  source: 'PHB',
  speed: { walk: 35, fly: 30 },
  darkvision: 60,
  abilityOptions: [],
  featGrants: [],
}

const barbarian = loadedClass('Barbarian', [], [], {
  classFeature: [feature('Fast Movement', 'Barbarian', 5)],
})
const monk = loadedClass('Monk', [], [], {
  classFeature: [feature('Unarmored Movement', 'Monk', 2)],
})

function sourcesOf(
  c: ReturnType<typeof build>,
  classes = [barbarian],
  race?: PlayableRace,
  feats: string[] = [],
) {
  const base = collectSources(c, { ...deps(classes), race })
  return {
    ...base,
    feats: feats.map((name) => {
      const [n, source] = name.split('|')
      const ref: SourceRef = { kind: 'feat', tag: `feat:${name}`, label: n }
      return { feat: featOf(n, source), source: ref }
    }),
  }
}

describe('speed', () => {
  it('starts from the species and lists the other ways of moving as notes', () => {
    const c = build('Barbarian', 1, {}, [])
    const speed = speedQuantity(sourcesOf(c, [barbarian], elf))
    expect(speed.value).toBe(35)
    expect(speed.lines.map((l) => l.label)).toEqual(['Walking speed', 'Fly 30 ft.'])
    expect(speed.lines[1].op).toBe('note')
  })

  it('has no lines without a species', () => {
    const c = build('Barbarian', 1, {}, [])
    expect(speedQuantity(sourcesOf(c)).lines).toEqual([])
  })

  it('adds Unarmored Movement to no speed when the species is not found', () => {
    // A multiclass Barbarian 3, Bard 3, Monk 2 showed a speed of 10 ft.: the bonus alone.
    const c = build('Monk', 2, {}, [])
    const speed = speedQuantity(sourcesOf(c, [monk]))
    expect(speed.value).toBe(0)
    expect(speed.lines).toEqual([])
  })

  it('adds Fast Movement unless heavy armor is worn', () => {
    const open = build('Barbarian', 5, {}, [])
    expect(speedQuantity(sourcesOf(open, [barbarian], elf)).value).toBe(45)
    const heavy = build('Barbarian', 5, {}, [stack('Chain Mail')])
    const worn = speedQuantity(sourcesOf(heavy, [barbarian], elf))
    expect(worn.value).toBe(35)
    expect(worn.lines.at(-1)).toMatchObject({
      status: 'inactive',
      why: 'You are wearing heavy armor.',
    })
    const light = build('Barbarian', 5, {}, [stack('Leather Armor')])
    expect(speedQuantity(sourcesOf(light, [barbarian], elf)).value).toBe(45)
  })

  it('grows Unarmored Movement with the Monk level and stops with armor or a shield', () => {
    const at = (level: number, items: ReturnType<typeof stack>[] = []) =>
      speedQuantity(sourcesOf(build('Monk', level, {}, items), [monk], elf)).value
    expect(at(2)).toBe(45)
    expect(at(6)).toBe(50)
    expect(at(18)).toBe(65)
    expect(at(6, [stack('Leather Armor')])).toBe(35)
    expect(at(6, [stack('Shield')])).toBe(35)
  })

  it('adds the feats Mobile and Speedy', () => {
    const c = build('Barbarian', 1, {}, [])
    expect(speedQuantity(sourcesOf(c, [barbarian], elf, ['Mobile|PHB'])).value).toBe(45)
    expect(speedQuantity(sourcesOf(c, [barbarian], elf, ['Speedy|XPHB'])).value).toBe(45)
  })
})

describe('speed from items', () => {
  const attune = { required: true, optional: false, classes: [] }
  const speedItem = (
    name: string,
    source: string,
    speed: Partial<NonNullable<Item['speed']>>,
    extra: Partial<Item> = {},
  ) =>
    makeItem({
      name,
      source,
      kind: 'wondrous',
      speed: { static: {}, equal: {}, bonus: {}, multiply: {}, ...speed },
      ...extra,
    })
  const striding = speedItem(
    'Boots of Striding and Springing',
    'DMG',
    { static: { walk: 30 } },
    { attunement: attune },
  )
  const bootsOfSpeed = speedItem(
    'Boots of Speed',
    'XDMG',
    { multiply: { walk: 2 } },
    { attunement: attune },
  )
  const slippers = speedItem(
    'Slippers of Spider Climbing',
    'DMG',
    { equal: { climb: 'walk' } },
    { attunement: attune },
  )
  const ring = speedItem('Ring of Swimming', 'XDMG', { static: { swim: 40 } })
  const wings = speedItem(
    'Wings of Flying',
    'XDMG',
    { static: { fly: 60 } },
    { attunement: attune },
  )
  const pennant = speedItem('Pennant of the Vind Rune', 'SKT', { bonus: { '*': 5 } })
  const whistle = speedItem('Eagle Whistle', 'TftYP', {
    equal: { fly: 'walk' },
    multiply: { fly: 2 },
  })
  const catalog = [striding, bootsOfSpeed, slippers, ring, wings, pennant, whistle]
  const dwarf: PlayableRace = { ...elf, name: 'Dwarf', speed: 25 }
  const held = (name: string, source: string, attuned = true) =>
    stack(name, { source, attuned })
  const speedOf = (race: PlayableRace, ...stacks: ReturnType<typeof stack>[]) => {
    const c = build('Barbarian', 1, {}, stacks)
    return speedQuantity(collectSources(c, { ...deps([barbarian], catalog), race }))
  }

  it('raises a walking speed below 30 to 30 with Boots of Striding and Springing', () => {
    const speed = speedOf(dwarf, held('Boots of Striding and Springing', 'DMG'))
    expect(speed.value).toBe(30)
    expect(speed.lines.at(-1)).toMatchObject({
      label: 'Boots of Striding and Springing',
      source: { kind: 'item' },
      amount: 5,
      status: 'applied',
    })
  })

  it('leaves a walking speed of 30 or more alone, and says why', () => {
    const speed = speedOf(elf, held('Boots of Striding and Springing', 'DMG'))
    expect(speed.value).toBe(35)
    expect(speed.lines.at(-1)).toMatchObject({
      status: 'inactive',
      why: 'Your walking speed is already 30 ft. or more.',
    })
  })

  it('needs the attunement the item asks for', () => {
    const speed = speedOf(dwarf, held('Boots of Striding and Springing', 'DMG', false))
    expect(speed.value).toBe(25)
    expect(speed.lines.at(-1)).toMatchObject({
      status: 'inactive',
      why: 'Needs attunement, and you are not attuned.',
    })
  })

  it('shows the doubling of Boots of Speed as holding only while the heels are clicked', () => {
    const speed = speedOf(elf, held('Boots of Speed', 'XDMG'))
    expect(speed.value).toBe(35)
    expect(speed.lines.at(-1)).toMatchObject({
      amount: 35,
      status: 'conditional',
      when: "while the boots' heels are clicked together (a Bonus Action)",
    })
  })

  it('gives a climb speed equal to the walking speed and a swim speed of its own', () => {
    const speed = speedOf(
      dwarf,
      held('Boots of Striding and Springing', 'DMG'),
      held('Slippers of Spider Climbing', 'DMG'),
      stack('Ring of Swimming', { source: 'XDMG' }),
    )
    const notes = speed.lines.filter((l) => l.source.kind === 'item' && l.op === 'note')
    expect(notes.map((l) => [l.label, l.status, l.how])).toEqual([
      ['Climb 30 ft.', 'applied', 'Equal to your walking speed'],
      ['Swim 40 ft.', 'applied', undefined],
    ])
  })

  it('shows a fly speed that needs an action as holding only after it', () => {
    const speed = speedOf(elf, held('Wings of Flying', 'XDMG'))
    expect(speed.lines.at(-1)).toMatchObject({
      label: 'Fly 60 ft.',
      op: 'note',
      status: 'conditional',
    })
  })

  it('adds a bonus to every speed, and multiplies a speed equal to walking', () => {
    const bonus = speedOf(elf, stack('Pennant of the Vind Rune', { source: 'SKT' }))
    expect(bonus.lines.at(-1)).toMatchObject({
      amount: 5,
      how: '5 ft. to every speed',
      status: 'conditional',
    })
    const whistled = speedOf(elf, stack('Eagle Whistle', { source: 'TftYP' }))
    expect(whistled.lines.at(-1)).toMatchObject({
      label: 'Fly 70 ft.',
      how: 'Walking speed times 2',
    })
  })

  it('names a multiplied speed the character may not have', () => {
    const odd = speedItem('Odd Charm', 'PHB', { multiply: { swim: 2 } })
    const c = build('Barbarian', 1, {}, [stack('Odd Charm')])
    const speed = speedQuantity(
      collectSources(c, { ...deps([barbarian], [odd]), race: elf }),
    )
    expect(speed.lines.at(-1)?.label).toBe('Swim speed times 2')
  })

  it('needs a species to move at all', () => {
    const c = build('Barbarian', 1, {}, [held('Boots of Striding and Springing', 'DMG')])
    expect(speedQuantity(collectSources(c, deps([barbarian], catalog))).lines).toEqual([])
  })
})

describe('senses', () => {
  it('reads darkvision from the species with its source', () => {
    const c = build('Barbarian', 1, {}, [])
    const [dark] = senseRows(sourcesOf(c, [barbarian], elf))
    expect(dark).toMatchObject({ key: 'darkvision', label: 'Darkvision' })
    expect(dark.range.value).toBe(60)
    expect(dark.range.lines[0].source).toMatchObject({ kind: 'race', label: 'Wood Elf' })
  })

  it('uses the larger range of the same sense, and adds a bonus sense', () => {
    const c = build('Barbarian', 1, {}, [])
    const sources = sourcesOf(c, [barbarian], elf)
    const feat = (name: string, extra: object) => ({
      feat: { ...featOf(name, 'XPHB'), ...extra },
      source: { kind: 'feat' as const, tag: `feat:${name}`, label: name },
    })
    const bigger = senseRows({
      ...sources,
      feats: [feat('Far Eyes', { senses: [{ darkvision: 120 }] })],
    })
    expect(bigger[0].range.value).toBe(120)
    expect(bigger[0].range.lines.find((l) => l.label === 'Wood Elf')).toMatchObject({
      status: 'inactive',
    })
    const bonus = senseRows({
      ...sources,
      feats: [feat('Keenness', { bonusSenses: [{ darkvision: 60 }] })],
    })
    expect(bonus[0].range.value).toBe(120)
  })

  it('gives blindsight to the Blind Fighting style', () => {
    const c = build('Barbarian', 1, {}, [])
    const sources = { ...sourcesOf(c), options: new Set(['Blind Fighting|TCE']) }
    expect(senseRows(sources)).toMatchObject([{ key: 'blindsight' }])
    expect(senseRows(sources)[0].range.value).toBe(10)
  })

  it('is empty for a character with none', () => {
    expect(senseRows(sourcesOf(build('Barbarian', 1, {}, [])))).toEqual([])
  })
})

describe('senses from features and options', () => {
  const subFeature = (
    className: string,
    shortName: string,
    source: string,
    name: string,
    level: number,
  ) => ({
    name,
    source,
    className,
    classSource: 'PHB',
    subclassShortName: shortName,
    subclassSource: source,
    level,
    entries: [],
  })
  const ranger = (source: 'XGE' | 'XPHB') =>
    loadedClass('Ranger', [], [], {
      subclassFeature: [subFeature('Ranger', 'Gloom Stalker', source, 'Umbral Sight', 3)],
    })
  const gloomStalker = (level: number, source: 'XGE' | 'XPHB') => {
    const c = build('Ranger', level, {}, [])
    c.classes[0].subclass = { name: 'Gloom Stalker', shortName: 'Gloom Stalker', source }
    return c
  }
  const darkvision = (rows: ReturnType<typeof senseRows>) =>
    rows.find((r) => r.key === 'darkvision')

  it('gives Umbral Sight darkvision 60 to a character without it', () => {
    const rows = senseRows(sourcesOf(gloomStalker(3, 'XGE'), [ranger('XGE')]))
    expect(darkvision(rows)?.range.value).toBe(60)
    expect(darkvision(rows)?.range.lines[0]).toMatchObject({
      label: 'Umbral Sight',
      op: 'base',
      source: { kind: 'subclass', label: 'Ranger, Gloom Stalker' },
    })
  })

  it('adds 30 feet to the darkvision of the species with the 2014 Umbral Sight', () => {
    const rows = senseRows(sourcesOf(gloomStalker(3, 'XGE'), [ranger('XGE')], elf))
    expect(darkvision(rows)?.range.value).toBe(90)
    expect(darkvision(rows)?.range.lines[1]).toMatchObject({
      op: 'add',
      amount: 30,
      how: '30 ft. more, as you already have darkvision from your species',
    })
  })

  it('counts only the species darkvision as already had in the 2014 rules', () => {
    const sources = sourcesOf(gloomStalker(3, 'XGE'), [ranger('XGE')], undefined, [
      'Far Eyes|XPHB',
    ])
    sources.feats[0].feat = { ...sources.feats[0].feat, senses: [{ darkvision: 60 }] }
    expect(darkvision(senseRows(sources))?.range.value).toBe(60)
  })

  it('adds 60 feet to any darkvision already had with the 2024 Umbral Sight', () => {
    const rows = senseRows(sourcesOf(gloomStalker(3, 'XPHB'), [ranger('XPHB')], elf))
    expect(darkvision(rows)?.range.value).toBe(120)
  })

  it('waits for the level of the feature', () => {
    expect(senseRows(sourcesOf(gloomStalker(2, 'XGE'), [ranger('XGE')]))).toEqual([])
  })

  it('gives a 2024 Ranger blindsight at level 18 with Feral Senses', () => {
    const xRanger = loadedClass('Ranger', [], [], {
      classFeature: [feature('Feral Senses', 'Ranger', 18, 'XPHB')],
    })
    const c = build('Ranger', 18, {}, [])
    c.classes[0].source = 'XPHB'
    const loaded = { ...xRanger, entry: { ...xRanger.entry, source: 'XPHB' } }
    const rows = senseRows(sourcesOf(c, [loaded]))
    expect(rows).toMatchObject([{ key: 'blindsight', label: 'Blindsight' }])
    expect(rows[0].range.value).toBe(30)
  })

  it("lists Devil's Sight as a sense of its own when the invocation is held", () => {
    const sources = { ...sourcesOf(build('Warlock', 2, {}, [])) }
    const rows = senseRows({ ...sources, options: new Set(["Devil's Sight|XPHB"]) })
    expect(rows).toMatchObject([{ key: "devil's sight", label: "Devil's Sight" }])
    expect(rows[0].range.value).toBe(120)
  })

  it('gives two senses from one feature, each in its own row', () => {
    const sorcerer = loadedClass('Sorcerer', [], [], {
      subclassFeature: [subFeature('Sorcerer', 'Shadow', 'RHW', 'Power of Shadow', 3)],
    })
    const c = build('Sorcerer', 3, {}, [])
    c.classes[0].subclass = { name: 'Shadow Sorcery', shortName: 'Shadow', source: 'RHW' }
    const rows = senseRows(sourcesOf(c, [sorcerer]))
    expect(rows.map((r) => [r.key, r.range.value])).toEqual([
      ['darkvision', 120],
      ['blindsight', 10],
    ])
  })
})

describe('hit dice', () => {
  it('count the levels of each die size with a line for each class', () => {
    const wizard = loadedClass('Wizard', [], [])
    wizard.entry.hd = { number: 1, faces: 6 }
    const fighter = loadedClass('Fighter', [], [])
    fighter.entry.hd = { number: 1, faces: 10 }
    const c = build('Fighter', 3, {}, [])
    c.classes = [...c.classes, { name: 'Wizard', source: 'PHB', level: 2 }]
    const dice = hitDice(c, deps([fighter, wizard]).classByKey)
    expect(dice.map((d) => [d.faces, d.count.value])).toEqual([
      [10, 3],
      [6, 2],
    ])
    expect(dice[0].count.lines[0].source.label).toBe('Fighter')
  })

  it('sum classes that share a die size', () => {
    const cleric = loadedClass('Cleric', [], [])
    const rogue = loadedClass('Rogue', [], [])
    const c = build('Cleric', 2, {}, [])
    c.classes = [...c.classes, { name: 'Rogue', source: 'PHB', level: 3 }]
    const dice = hitDice(c, deps([cleric, rogue]).classByKey)
    expect(dice).toHaveLength(1)
    expect(dice[0].count.value).toBe(5)
    expect(dice[0].count.lines).toHaveLength(2)
  })
})

describe('slots', () => {
  const caster = (name: string, progression: string, ability = 'int') => {
    const lc = loadedClass(name, [], [])
    lc.entry.casterProgression = progression
    lc.entry.spellcastingAbility = ability
    return lc
  }

  it('uses the combined caster level for several spellcasting classes', () => {
    const wizard = caster('Wizard', 'full')
    const paladin = caster('Paladin', '1/2', 'cha')
    const c = build('Wizard', 5, {}, [])
    c.classes = [...c.classes, { name: 'Paladin', source: 'PHB', level: 4 }]
    const d = deps([wizard, paladin])
    const slots = deriveSlots(c, d.classByKey, collectSources(c, d))
    // 5 + floor(4 / 2) = caster level 7.
    expect(slots.casterLevel.value).toBe(7)
    expect(slots.standard).toEqual([4, 3, 3, 1, 0, 0, 0, 0, 0])
    expect(slots.casterLevel.lines.map((l) => l.amount)).toEqual([5, 2])
    expect(slots.maxSpellLevel).toBe(4)
  })

  it('uses the own table of a single class and shows its contribution as not used', () => {
    const paladin = caster('Paladin', '1/2', 'cha')
    const c = build('Paladin', 5, {}, [])
    const d = deps([paladin])
    const slots = deriveSlots(c, d.classByKey, collectSources(c, d))
    expect(slots.standard.slice(0, 2)).toEqual([4, 2])
    expect(slots.casterLevel.value).toBe(0)
    expect(slots.casterLevel.lines[0].status).toBe('inactive')
  })

  it('keeps Pact Magic apart from the combined level', () => {
    const wizard = caster('Wizard', 'full')
    const warlock = caster('Warlock', 'pact', 'cha')
    const c = build('Wizard', 3, {}, [])
    c.classes = [...c.classes, { name: 'Warlock', source: 'PHB', level: 5 }]
    const d = deps([wizard, warlock])
    const slots = deriveSlots(c, d.classByKey, collectSources(c, d))
    expect(slots.standard.slice(0, 2)).toEqual([4, 2])
    expect(slots.pact).toEqual({ slots: 2, level: 3 })
    expect(slots.maxSpellLevel).toBe(3)
    expect(slots.casters).toHaveLength(2)
  })
})

describe('edition', () => {
  const one = (source: string) =>
    source === 'XPHB' ? ('one' as const) : ('classic' as const)

  it('follows the first class book, then the species, then the selected books', () => {
    const c = build('Fighter', 1, {}, [])
    expect(characterEdition(c, one)).toBe('classic')
    c.classes = [{ name: 'Fighter', source: 'XPHB', level: 1 }]
    expect(characterEdition(c, one)).toBe('one')
    c.classes = []
    c.race = {
      name: 'Human',
      baseName: 'Human',
      source: 'XPHB',
      abilityFixed: {},
      abilityChoices: {},
    }
    expect(characterEdition(c, one)).toBe('one')
    c.race = undefined
    c.selectedBooks = ['XPHB']
    expect(characterEdition(c, one)).toBe('one')
    c.selectedBooks = ['XPHB', 'PHB']
    expect(characterEdition(c, one)).toBe('classic')
  })

  it('knows the 2024 books by name when the books list is not loaded', () => {
    const c = build('Fighter', 1, {}, [])
    expect(characterEdition(c)).toBe('classic')
    c.classes = [{ name: 'Fighter', source: 'XPHB', level: 1 }]
    expect(characterEdition(c)).toBe('one')
  })

  it('is on the derived sheet, from the editions the dependencies give', () => {
    const c = build('Fighter', 1, {}, [])
    const sheet = deriveSheet(c, {
      ...deps([loadedClass('Fighter', [], [])]),
      editionOf: () => 'one',
    })
    expect(sheet.edition).toBe('one')
    expect(sheet.speed.lines).toEqual([])
    expect(sheet.slots.maxSpellLevel).toBe(0)
  })
})
