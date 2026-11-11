import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { parseAbilityOptions } from '../../data/abilityOptions'
import type { PlayableBackground, StoryTable } from '../../data/background'
import { parseFeatGrants } from '../../data/feats'
import { _clearBookSources, registerBookSources } from '../../data/glossary'
import type { Fact } from '../table/facts'
import {
  backgroundColumns,
  backgroundKey,
  backgroundName,
  backgroundSearchText,
  backgroundSummary,
  backgroundTags,
  describeBackgrounds,
  SET_BY_RACE,
} from './backgroundFacts'

/** A background with nothing in it but what it must have. */
function bare(name: string, extra: Partial<PlayableBackground> = {}): PlayableBackground {
  return {
    key: `${name}|TST`,
    name,
    source: 'TST',
    abilityOptions: [],
    featGrants: [],
    storyTables: [],
    entries: [],
    ...extra,
  }
}

function storyTable(title: string, texts: string[], extra: Partial<StoryTable> = {}) {
  return {
    key: title.toLowerCase(),
    title,
    label: title,
    field: 'backstory',
    count: 1,
    die: texts.length,
    rows: texts.map((text, i) => ({ min: i + 1, max: i + 1, text })),
    ...extra,
  } satisfies StoryTable
}

const feature = (name: string, text: string) => ({
  type: 'entries',
  name,
  entries: [text],
  data: { isFeature: true },
})

// A 2014 background with something in most facts.
const acolyte = bare('Acolyte', {
  source: 'PHB',
  skillProficiencies: [{ insight: true, religion: true }],
  languageProficiencies: [{ anyStandard: 2 }],
  toolProficiencies: [],
  startingEquipment: [
    { _: ['common clothes|phb', { item: 'pouch|phb', containsValue: 1500 }] },
  ],
  storyTables: [
    storyTable('Personality Trait', ['I idolize a hero.', 'I quote scripture.'], {
      field: 'personalityTraits',
      count: 2,
    }),
    storyTable('Ideal', ['Tradition. (Lawful)', 'Charity. (Good)']),
  ],
  entries: [
    {
      type: 'list',
      style: 'list-hang-notitle',
      items: [
        { type: 'item', name: 'Skill Proficiencies:', entry: 'Insight, Religion' },
        {
          type: 'item',
          name: 'Equipment:',
          entry: 'A {@item holy symbol|phb} and a belt pouch containing 15 gp',
        },
      ],
    },
    feature('Feature: Shelter of the Faithful', 'Temples shelter you.'),
    {
      type: 'entries',
      name: 'Suggested Characteristics',
      entries: [
        'Acolytes are shaped by faith.',
        {
          type: 'table',
          colLabels: ['d2', 'Ideal'],
          rows: [
            ['1', 'Tradition. (Lawful)'],
            ['2', 'Charity. (Good)'],
          ],
        },
      ],
    },
  ],
})

// A 2024 background: ability options, a feat, a tool, and gold either way.
const sage = bare('Sage', {
  source: 'XPHB',
  edition: 'one',
  abilityOptions: parseAbilityOptions([
    { choose: { weighted: { from: ['con', 'int', 'wis'], weights: [2, 1] } } },
    { choose: { weighted: { from: ['con', 'int', 'wis'], weights: [1, 1, 1] } } },
  ]),
  featGrants: parseFeatGrants([{ 'magic initiate; cleric|xphb': true }]),
  skillProficiencies: [{ arcana: true, history: true }],
  toolProficiencies: [{ "calligrapher's supplies": true }],
  startingEquipment: [{ A: [{ value: 805 }], B: [{ value: 5000 }] }],
})

// A background lent another's tables, with two features and spells.
const watch = bare("Baldur's Gate Watch", {
  source: 'SCAG',
  prerequisite: [{ campaign: ['Planescape'] }, { other: 'x' }],
  skillToolLanguageProficiencies: [{ anyLanguage: 1, anyTool: 1 }],
  additionalSpells: [{ expanded: { s1: ['bless'] } }, { innate: { '1': ['light#c'] } }],
  storyTables: [
    storyTable('Beat', ['Docks', 'Market']),
    storyTable('Personality Trait', ['Polite', 'Brave'], {
      field: 'personalityTraits',
      from: 'Soldier',
    }),
    storyTable('Object', ['A deed', 'A key', 'A coin'], {
      die: 4,
      rows: [
        { min: 1, max: 1, text: 'A deed' },
        { min: 2, max: 3, text: 'A key' },
        { min: 4, max: 4, text: 'A coin' },
      ],
    }),
  ],
  entries: [
    feature('Feature: Watcher’s Eye', 'You know the watch.'),
    feature("Baldur's Gate Feature: Shelter of the Faithful", 'The city knows you.'),
    // Marked as a feature but not a whole one, so it is text about the background.
    { type: 'entries', name: 'Half', data: { isFeature: true } },
    { type: 'entries', name: 'Plain', entries: ['Not a feature.'], data: 'odd' },
  ],
})

const empty = bare('Blank', { edition: 'one', prerequisite: ['odd'] })

const basics = describeBackgrounds([acolyte])[0].facts
function fact(key: string): Fact<PlayableBackground> {
  const found = basics.find((f) => f.key === key)
  if (!found) throw new Error(`no fact ${key}`)
  return found
}
const text = (key: string, bg: PlayableBackground) => fact(key).text(bg)
const column = (key: string) => {
  const found = backgroundColumns.find((c) => c.key === key)
  if (!found) throw new Error(`no column ${key}`)
  return found
}

afterEach(() => _clearBookSources())

describe('background identity', () => {
  it('keys, names and tags a background by its edition year', () => {
    expect(backgroundKey(acolyte)).toBe('Acolyte|TST')
    expect(backgroundName(acolyte)).toBe('Acolyte')
    expect(backgroundTags(acolyte)).toEqual(['2014'])
    expect(backgroundTags(sage)).toEqual(['2024'])
  })

  it('searches the name, book, features and tables', () => {
    expect(backgroundSearchText(acolyte)).toBe(
      'Acolyte PHB Shelter of the Faithful Personality Trait Ideal',
    )
    expect(backgroundSearchText(empty)).toBe('Blank TST ')
  })
})

describe('background facts', () => {
  it('lists the basics in order', () => {
    expect(basics.map((f) => f.key)).toEqual([
      'ability',
      'feat',
      'skills',
      'tools',
      'languages',
      'proficiencies',
      'feature',
      'gold',
      'equipment',
      'spells',
      'spellList',
      'storyTables',
      'prerequisite',
      'source',
      'edition',
    ])
  })

  it('sums up the ability increases, set by race under the 2014 rules', () => {
    expect(text('ability', sage)).toBe('CON, INT, WIS: +2, +1 or +1, +1, +1')
    expect(text('ability', acolyte)).toBe(SET_BY_RACE)
    expect(SET_BY_RACE).toBe('Set by race')
    expect(text('ability', empty)).toBe('')
    const { container } = render(<>{fact('ability').render?.(sage)}</>)
    expect(container.querySelectorAll('abbr')).toHaveLength(3)
  })

  it('names the feat a background grants, cleaned for display', () => {
    // Moved from background.test.ts: the feat label of a 2024 background.
    expect(text('feat', sage)).toBe('Magic Initiate; Cleric')
    expect(text('feat', acolyte)).toBe('')
  })

  it('lists each grant in words, and nothing for a background without it', () => {
    expect(text('skills', acolyte)).toBe('Insight, Religion')
    expect(text('languages', acolyte)).toBe('2 standard languages of your choice')
    expect(text('tools', sage)).toBe("Calligrapher's Supplies")
    expect(text('proficiencies', watch)).toBe(
      '1 language of your choice, 1 tool of your choice',
    )
    for (const key of ['skills', 'tools', 'languages', 'proficiencies'])
      expect(text(key, empty)).toBe('')
  })

  it('tells spells granted from spells added to a class list', () => {
    expect(text('spells', watch)).toBe('Light')
    expect(text('spellList', watch)).toBe('Bless')
    expect(text('spells', acolyte)).toBe('')
  })

  it('names the feature without its "Feature:" lead', () => {
    expect(text('feature', acolyte)).toBe('Shelter of the Faithful')
    expect(text('feature', watch)).toBe('Watcher’s Eye, Shelter of the Faithful')
    expect(text('feature', sage)).toBe('')
  })

  it('counts the gold of each way of taking the equipment', () => {
    expect(text('gold', acolyte)).toBe('15 gp')
    expect(text('gold', sage)).toBe('8 gp, 5 cp or 50 gp')
    expect(
      text('gold', bare('Coins', { startingEquipment: [{ _: [{ value: 1550 }] }] })),
    ).toBe('15 gp, 5 sp')
    expect(text('gold', bare('Kit', { startingEquipment: [{ _: ['rope|phb'] }] }))).toBe(
      '',
    )
    expect(text('gold', empty)).toBe('')
    const { container } = render(<>{fact('gold').render?.(acolyte)}</>)
    expect(within(container).getByText('gp').tagName).toBe('ABBR')
  })

  it('gives the equipment in the book’s words', () => {
    expect(text('equipment', acolyte)).toBe(
      'A holy symbol and a belt pouch containing 15 gp',
    )
    expect(text('equipment', watch)).toBe('')
    const listed = bare('Listed', {
      entries: [
        { type: 'list', items: ['Plain', { type: 'item', name: 'Equipment:' }] },
        { type: 'list' },
      ],
    })
    expect(text('equipment', listed)).toBe('')
    const { container } = render(<>{fact('equipment').render?.(acolyte)}</>)
    expect(within(container).getByText('gp').tagName).toBe('ABBR')
  })

  it('names the story tables, with the background any are lent from', () => {
    expect(text('storyTables', acolyte)).toBe('Personality Trait, Ideal')
    expect(text('storyTables', watch)).toBe(
      'Beat, Object; Personality Trait from Soldier',
    )
    expect(text('storyTables', empty)).toBe('')
  })

  it('says which campaign a background needs', () => {
    expect(text('prerequisite', watch)).toBe('Planescape campaign')
    expect(text('prerequisite', empty)).toBe('')
  })

  it('gives the source book and the edition year', () => {
    expect(text('source', acolyte)).toBe('PHB')
    expect(text('edition', acolyte)).toBe('2014')
    expect(text('edition', sage)).toBe('2024')
    registerBookSources([{ source: 'PHB', name: "Player's Handbook" }])
    render(<>{fact('source').render?.(acolyte)}</>)
    expect(screen.getByText('PHB').tagName).toBe('ABBR')
  })

  it('sums up a chosen background with the facts worth seeing at a glance', () => {
    expect(backgroundSummary.map((f) => f.key)).toEqual([
      'skills',
      'tools',
      'languages',
      'feat',
      'feature',
      'gold',
    ])
  })
})

describe('background detail', () => {
  it('groups the basics, the feature, the story tables and the rest', () => {
    const groups = describeBackgrounds([acolyte, sage])
    expect(groups.map((g) => [g.key, g.title, g.empty])).toEqual([
      ['basics', 'Basics', undefined],
      ['feature', 'Feature', undefined],
      ['storyTables', 'Story tables', 'No tables.'],
      ['about', 'About', undefined],
    ])
  })

  it('lines up each feature once, blank for a background without it', () => {
    const features = describeBackgrounds([acolyte, watch])[1].facts
    expect(features.map((f) => f.label)).toEqual([
      'Shelter of the Faithful',
      'Watcher’s Eye',
    ])
    const [shelter, eye] = features
    expect(shelter.key).toBe('feature-shelter of the faithful')
    expect(shelter.text(acolyte)).toBe(JSON.stringify(['Temples shelter you.']))
    expect(shelter.text(watch)).toBe(JSON.stringify(['The city knows you.']))
    expect(eye.text(acolyte)).toBe('')
    render(<>{eye.render?.(watch)}</>)
    expect(screen.getByText('You know the watch.')).toBeInTheDocument()
    const { container } = render(<>{eye.render?.(acolyte)}</>)
    expect(container).toBeEmptyDOMElement()
  })

  it('lines up each story table by its key, drawn as the book prints it', () => {
    const tables = describeBackgrounds([acolyte, watch])[2].facts
    expect(tables.map((f) => [f.key, f.label])).toEqual([
      ['table-personality trait', 'Personality Trait'],
      ['table-ideal', 'Ideal'],
      ['table-beat', 'Beat'],
      ['table-object', 'Object'],
    ])
    const [trait, ideal, , object] = tables
    expect(ideal.text(watch)).toBe('')
    expect(ideal.text(acolyte)).toBe(JSON.stringify(acolyte.storyTables[1].rows))

    const own = render(<>{trait.render?.(acolyte)}</>)
    expect(
      within(own.container).getByRole('columnheader', { name: 'd2' }),
    ).toBeInTheDocument()
    expect(within(own.container).getByText('I quote scripture.')).toBeInTheDocument()
    expect(own.container).not.toHaveTextContent('From the')
    own.unmount()

    const lent = render(<>{trait.render?.(watch)}</>)
    expect(lent.container).toHaveTextContent('From the Soldier background.')
    lent.unmount()

    // A row that covers several die values shows its range.
    render(<>{object.render?.(watch)}</>)
    expect(screen.getByText('2-3')).toBeInTheDocument()
    const none = render(<>{ideal.render?.(watch)}</>)
    expect(none.container).toBeEmptyDOMElement()
  })

  it('keeps what else a background says, without its feature or tables', () => {
    const about = describeBackgrounds([acolyte])[3].facts[0]
    const said = about.text(acolyte)
    expect(said).toContain('Acolytes are shaped by faith.')
    expect(said).not.toContain('Temples shelter you.')
    expect(said).not.toContain('Tradition. (Lawful)')
    expect(about.text(sage)).toBe('')
    // An entry marked as a feature without text of its own stays here.
    expect(about.text(watch)).toContain('Half')
    expect(about.text(watch)).toContain('Not a feature.')
    render(<>{about.render?.(acolyte)}</>)
    expect(screen.getByText('Acolytes are shaped by faith.')).toBeInTheDocument()
  })
})

describe('background columns', () => {
  it('leads with the name, book and edition, the rarer stats hidden to start', () => {
    expect(backgroundColumns.map((c) => c.key)).toEqual([
      'name',
      'source',
      'edition',
      'ability',
      'feat',
      'skills',
      'tools',
      'languages',
      'feature',
      'gold',
      'storyTables',
      'equipment',
      'spells',
      'spellList',
      'proficiencies',
      'prerequisite',
    ])
    expect(backgroundColumns.filter((c) => c.defaultHidden).map((c) => c.key)).toEqual([
      'storyTables',
      'equipment',
      'spells',
      'spellList',
      'proficiencies',
      'prerequisite',
    ])
  })

  it('shows the name in bold, sorted by name and not filtered', () => {
    const name = column('name')
    expect(name.header).toBe('Background')
    expect(name.sortValue?.(acolyte)).toBe('Acolyte')
    expect(name.filterable).toBe(false)
    expect(column('feature').filterable).toBe(false)
    expect(column('equipment').filterable).toBe(false)
    render(<>{name.render(acolyte)}</>)
    expect(screen.getByText('Acolyte').tagName).toBe('STRONG')
  })

  it('filters the ability scores by each ability a background can raise', () => {
    const ability = column('ability')
    expect(ability.filterValue?.(sage)).toEqual([
      'Constitution',
      'Intelligence',
      'Wisdom',
    ])
    const fixed = bare('Fixed', {
      abilityOptions: [{ fixed: { str: 1 }, amounts: [], from: [] }],
    })
    expect(ability.filterValue?.(fixed)).toEqual(['Strength'])
    expect(ability.filterValue?.(acolyte)).toEqual([SET_BY_RACE])
    expect(ability.filterValue?.(empty)).toEqual(['-'])
  })

  it('filters a grant by each thing granted, and the tables by title', () => {
    expect(column('skills').filterValue?.(acolyte)).toEqual(['Insight', 'Religion'])
    expect(column('languages').filterValue?.(acolyte)).toEqual(['Choice'])
    expect(column('storyTables').filterValue?.(watch)).toEqual([
      'Beat',
      'Personality Trait',
      'Object',
    ])
    for (const key of ['skills', 'tools', 'storyTables', 'spells'])
      expect(column(key).filterValue?.(empty)).toEqual(['-'])
  })

  it('sorts the gold by the most a background can come with', () => {
    expect(column('gold').sortValue?.(sage)).toBe(5000)
    expect(column('gold').sortValue?.(empty)).toBe(0)
  })

  it('shows a dash in a cell the background has nothing for', () => {
    expect(column('feat').render(acolyte)).toBe('-')
    expect(column('gold').render(empty)).toBe('-')
    expect(column('ability').render(empty)).toBe('-')
  })
})
