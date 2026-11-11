import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { _clearBookSources, registerBookSources } from '../../data/glossary'
import type { PlayableRace } from '../../data/race'
import type { Fact } from '../table/facts'
import {
  describeRaces,
  raceColumns,
  raceKey,
  raceName,
  raceSearchText,
  raceSummary,
  raceTags,
  SET_BY_BACKGROUND,
} from './raceFacts'

/** A race with nothing in it but what it must have. */
function bare(name: string, extra: Partial<PlayableRace> = {}): PlayableRace {
  return {
    key: `${name}|TST`,
    name,
    baseName: name,
    source: 'TST',
    abilityOptions: [],
    featGrants: [],
    ...extra,
  }
}

// A race with something in every fact.
const full = bare('Gnome (Deep)', {
  baseName: 'Gnome',
  subraceName: 'Deep',
  source: 'PHB',
  edition: 'classic',
  size: ['S', 'M'],
  speed: { walk: 30, fly: 50, hover: true },
  darkvision: 120,
  blindsight: 10,
  creatureTypes: ['humanoid', 'fey'],
  abilityOptions: [{ fixed: { int: 2, dex: 1 }, amounts: [], from: [] }],
  skillProficiencies: [{ perception: true }],
  skillToolLanguageProficiencies: [
    { choose: [{ from: ['anySkill', 'anyTool'], count: 1 }] },
  ],
  languageProficiencies: [{ common: true, gnomish: true, anyStandard: 1 }],
  toolProficiencies: [{ "tinker's tools": true }],
  weaponProficiencies: [{ martial: true }],
  armorProficiencies: [{ light: true }],
  resist: ['poison'],
  immune: ['disease'],
  conditionImmune: ['charmed'],
  vulnerable: ['cold'],
  additionalSpells: [{ innate: { '1': ['minor illusion#c'] } }],
  featGrants: [{ named: ['skill expert|xphb'], categories: [] }],
  entries: [
    'Deep gnomes live far below.',
    { type: 'entries', name: 'Age', entries: ['They live long.'] },
    { type: 'entries', name: 'Darkvision', entries: ['You see in the dark.'] },
    { type: 'entries', name: 'Gnome Cunning', entries: ['You resist magic.'] },
    { type: 'entries', name: 'Stone Camouflage', entries: ['You hide in rock.'] },
  ],
})

// A 2024 species with no increases of its own and an open choice of skills.
const species = bare('Human', {
  source: 'XPHB',
  edition: 'one',
  size: ['M'],
  speed: 30,
  skillProficiencies: [{ any: 1 }],
  featGrants: [{ named: [], categories: ['O'] }],
  entries: [
    { type: 'entries', name: 'gnome cunning', entries: ['A human with it too.'] },
    { type: 'entries', name: 'Resourceful', entries: ['You gain Heroic Inspiration.'] },
  ],
})

const empty = bare('Blank', { edition: 'classic' })

const basics = describeRaces([full])[0].facts
function fact(key: string): Fact<PlayableRace> {
  const found = basics.find((f) => f.key === key)
  if (!found) throw new Error(`no fact ${key}`)
  return found
}
const text = (key: string, race: PlayableRace) => fact(key).text(race)
const column = (key: string) => {
  const found = raceColumns.find((c) => c.key === key)
  if (!found) throw new Error(`no column ${key}`)
  return found
}

afterEach(() => _clearBookSources())

describe('race identity', () => {
  it('keys, names and tags a race by its edition year', () => {
    expect(raceKey(full)).toBe('Gnome (Deep)|TST')
    expect(raceName(full)).toBe('Gnome (Deep)')
    expect(raceTags(full)).toEqual(['2014'])
    expect(raceTags(species)).toEqual(['2024'])
    expect(raceTags(bare('Old'))).toEqual(['2014'])
  })
})

describe('race facts', () => {
  it('lists the basics in order', () => {
    expect(basics.map((f) => f.key)).toEqual([
      'size',
      'speed',
      'darkvision',
      'blindsight',
      'creatureType',
      'ability',
      'skills',
      'proficiencies',
      'languages',
      'tools',
      'weapons',
      'armor',
      'resist',
      'immune',
      'conditionImmune',
      'vulnerable',
      'spells',
      'feats',
      'source',
      'edition',
    ])
  })

  it('writes out the size, speed and senses, and nothing where there are none', () => {
    expect(text('size', full)).toBe('Small or Medium')
    expect(text('speed', full)).toBe('30 ft., fly 50 ft., hover 30 ft.')
    expect(text('speed', species)).toBe('30 ft.')
    expect(text('darkvision', full)).toBe('120 ft.')
    expect(text('blindsight', full)).toBe('10 ft.')
    for (const key of ['size', 'speed', 'darkvision', 'blindsight'])
      expect(text(key, empty)).toBe('')
  })

  it('names the creature type, a humanoid when the race names none', () => {
    expect(text('creatureType', full)).toBe('Humanoid or Fey')
    expect(text('creatureType', empty)).toBe('Humanoid')
    expect(text('creatureType', bare('Typeless', { creatureTypes: [] }))).toBe('Humanoid')
  })

  it('sums up the ability increases, with where a 2024 species gets its own', () => {
    expect(text('ability', full)).toBe('DEX +1, INT +2')
    expect(text('ability', species)).toBe(SET_BY_BACKGROUND)
    expect(SET_BY_BACKGROUND).toBe('Set by background')
    expect(text('ability', empty)).toBe('')
  })

  it('draws the ability codes with their full names on hand', () => {
    const { container } = render(<>{fact('ability').render?.(full)}</>)
    expect(container).toHaveTextContent('DEX +1, INT +2')
    expect(container.querySelectorAll('abbr')).toHaveLength(2)
  })

  it('lists each grant in words, and nothing for a race without it', () => {
    expect(text('skills', full)).toBe('Perception')
    expect(text('skills', species)).toBe('1 skill of your choice')
    expect(text('proficiencies', full)).toBe('1 skill or tool of your choice')
    expect(text('languages', full)).toBe(
      'Common, Gnomish, 1 standard language of your choice',
    )
    expect(text('tools', full)).toBe("Tinker's Tools")
    expect(text('weapons', full)).toBe('Martial weapons')
    expect(text('armor', full)).toBe('Light armor')
    expect(text('resist', full)).toBe('Poison')
    expect(text('immune', full)).toBe('Disease')
    expect(text('conditionImmune', full)).toBe('Charmed')
    expect(text('vulnerable', full)).toBe('Cold')
    for (const key of [
      'skills',
      'proficiencies',
      'languages',
      'tools',
      'weapons',
      'armor',
      'resist',
      'immune',
      'conditionImmune',
      'vulnerable',
    ])
      expect(text(key, empty)).toBe('')
  })

  it('names the spells and feats a race grants', () => {
    expect(text('spells', full)).toBe('Minor Illusion')
    expect(text('spells', empty)).toBe('')
    expect(text('feats', full)).toBe('Skill Expert')
    expect(text('feats', species)).toBe('1 Origin feat of your choice')
    expect(text('feats', empty)).toBe('')
  })

  it('gives the source book, spelled out where the book is known', () => {
    expect(text('source', full)).toBe('PHB')
    registerBookSources([{ source: 'PHB', name: "Player's Handbook" }])
    render(<>{fact('source').render?.(full)}</>)
    expect(screen.getByText('PHB').tagName).toBe('ABBR')
  })

  it('gives the edition as its year', () => {
    expect(text('edition', full)).toBe('2014')
    expect(text('edition', species)).toBe('2024')
    expect(text('edition', bare('Old'))).toBe('2014')
  })

  it('sums up a chosen race with the facts worth seeing at a glance', () => {
    expect(raceSummary.map((f) => f.key)).toEqual([
      'size',
      'speed',
      'darkvision',
      'languages',
      'skills',
      'resist',
      'feats',
    ])
  })
})

describe('race traits', () => {
  it('lists only the traits that set a race apart, for the table and the search', () => {
    expect(column('traits').render(full)).toBe('Gnome Cunning, Stone Camouflage')
    expect(column('traits').render(empty)).toBe('-')
    expect(raceSearchText(full)).toBe('Gnome (Deep) PHB Gnome Cunning, Stone Camouflage')
    expect(raceSearchText(empty)).toBe('Blank TST ')
  })

  it('lines up each trait once across the races, blank for a race without it', () => {
    const [basicsGroup, traits] = describeRaces([full, species])
    expect(basicsGroup).toMatchObject({ key: 'basics', title: 'Basics' })
    expect(traits).toMatchObject({
      key: 'traits',
      title: 'Traits',
      empty: 'No traits found.',
    })
    // The text before the traits leads, then every trait, named as first met.
    expect(traits.facts.map((f) => f.label)).toEqual([
      'About',
      'Age',
      'Darkvision',
      'Gnome Cunning',
      'Stone Camouflage',
      'Resourceful',
    ])
    const cunning = traits.facts[3]
    expect(cunning.key).toBe('trait-gnome cunning')
    expect(cunning.text(full)).toBe(JSON.stringify(['You resist magic.']))
    // The same trait under another case is the same line.
    expect(cunning.text(species)).toBe(JSON.stringify(['A human with it too.']))
    const resourceful = traits.facts[5]
    expect(resourceful.text(full)).toBe('')

    render(<>{resourceful.render?.(species)}</>)
    expect(screen.getByText('You gain Heroic Inspiration.')).toBeInTheDocument()
  })

  it('shows what a race says outside its traits, blank for one that says nothing more', () => {
    const about = describeRaces([full, species])[1].facts[0]
    expect(about.key).toBe('about')
    expect(about.text(full)).toBe(JSON.stringify(['Deep gnomes live far below.']))
    expect(about.text(species)).toBe('')
    render(<>{about.render?.(full)}</>)
    expect(screen.getByText('Deep gnomes live far below.')).toBeInTheDocument()
  })

  it('has no About line when no race says anything outside its traits', () => {
    const traits = describeRaces([species])[1]
    expect(traits.facts.map((f) => f.key)).toEqual([
      'trait-gnome cunning',
      'trait-resourceful',
    ])
  })

  it('reads an entry that is not a whole trait as text about the race', () => {
    const odd = bare('Odd', {
      entries: [
        { type: 'entries', name: 'Unfinished' },
        { type: 'list', items: ['A list.'] },
        { name: 'Loose', entries: 'Text that is not a list.' },
        { name: 3, entries: ['A number for a name.'] },
        7,
      ],
    })
    const traits = describeRaces([odd])[1]
    expect(traits.facts.map((f) => f.key)).toEqual(['about'])
    expect(column('traits').render(odd)).toBe('-')
    // A trait without text draws nothing for a race without it.
    const withTrait = describeRaces([full])[1].facts.find((f) => f.label === 'Age')
    const { container } = render(<>{withTrait?.render?.(odd)}</>)
    expect(container).toBeEmptyDOMElement()
  })

  it('has no traits for a race without text', () => {
    expect(describeRaces([empty])[1].facts).toEqual([])
  })
})

describe('race columns', () => {
  it('leads with the name, then the stats, the rarer ones hidden to start', () => {
    expect(raceColumns.map((c) => c.key)).toEqual([
      'name',
      'source',
      'edition',
      'size',
      'speed',
      'darkvision',
      'ability',
      'traits',
      'resist',
      'skills',
      'languages',
      'spells',
      'feats',
      'tools',
      'weapons',
      'armor',
      'proficiencies',
      'immune',
      'conditionImmune',
      'vulnerable',
      'blindsight',
      'creatureType',
    ])
    expect(raceColumns.filter((c) => c.defaultHidden).map((c) => c.key)).toEqual([
      'tools',
      'weapons',
      'armor',
      'proficiencies',
      'immune',
      'conditionImmune',
      'vulnerable',
      'blindsight',
      'creatureType',
    ])
  })

  it('shows the name in bold, sorted by name and not filtered', () => {
    const name = column('name')
    expect(name.header).toBe('Race')
    expect(name.sortValue?.(full)).toBe('Gnome (Deep)')
    expect(name.filterable).toBe(false)
    expect(column('traits').filterable).toBe(false)
    render(<>{name.render(full)}</>)
    expect(screen.getByText('Gnome (Deep)').tagName).toBe('STRONG')
  })

  it('filters a grant by each thing granted, and by Choice for an open one', () => {
    expect(column('languages').filterValue?.(full)).toEqual([
      'Common',
      'Gnomish',
      'Choice',
    ])
    expect(column('skills').filterValue?.(full)).toEqual(['Perception'])
    expect(column('skills').filterValue?.(species)).toEqual(['Choice'])
    expect(column('spells').filterValue?.(full)).toEqual(['Minor Illusion'])
    expect(column('resist').filterValue?.(full)).toEqual(['Poison'])
    expect(column('proficiencies').filterValue?.(full)).toEqual(['Choice'])
    for (const key of ['languages', 'skills', 'spells', 'resist', 'tools', 'vulnerable'])
      expect(column(key).filterValue?.(empty)).toEqual(['-'])
  })

  it('filters the ability scores by each ability raised outright, and by Choice', () => {
    const ability = column('ability')
    expect(ability.filterValue?.(full)).toEqual(['Dexterity', 'Intelligence'])
    const placed = bare('Placed', {
      abilityOptions: [
        { fixed: { cha: 2 }, amounts: [1, 1], from: ['str', 'dex', 'con'] },
        { fixed: {}, amounts: [2], from: ['str', 'dex'] },
      ],
    })
    expect(ability.filterValue?.(placed)).toEqual(['Charisma', 'Choice'])
    expect(ability.filterValue?.(species)).toEqual([SET_BY_BACKGROUND])
    expect(ability.filterValue?.(empty)).toEqual(['-'])
  })

  it('sorts speed and the senses as numbers, none as zero', () => {
    expect(column('speed').sortValue?.(full)).toBe(30)
    expect(column('speed').sortValue?.(species)).toBe(30)
    expect(column('speed').sortValue?.(empty)).toBe(0)
    expect(column('darkvision').sortValue?.(full)).toBe(120)
    expect(column('darkvision').sortValue?.(empty)).toBe(0)
    expect(column('blindsight').sortValue?.(full)).toBe(10)
    expect(column('blindsight').sortValue?.(empty)).toBe(0)
  })

  it('shows a dash in a cell the race has nothing for', () => {
    expect(column('speed').render(empty)).toBe('-')
    expect(column('feats').render(empty)).toBe('-')
    expect(column('ability').render(empty)).toBe('-')
  })
})
