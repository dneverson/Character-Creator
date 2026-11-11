import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { parseAbilityOptions } from '../../data/abilityOptions'
import type { Feat } from '../../data/feats'
import { makeFeat } from '../../test/featFixtures'
import type { Fact } from '../table/facts'
import {
  describeFeats,
  featColumns,
  featKey,
  featName,
  featSearchText,
  featSummary,
  featTags,
} from './featFacts'

// A feat with something in every fact.
const full = makeFeat({
  name: 'Magic Initiate',
  label: 'Magic Initiate (Cleric)',
  source: 'XPHB',
  edition: 'one',
  category: 'O',
  repeatable: true,
  prerequisites: [{ level: 4 }, { level: { level: 8, class: { name: 'Fighter' } } }],
  abilityOptions: parseAbilityOptions([{ choose: { from: ['str', 'dex'] } }]),
  skillProficiencies: [{ perception: true }],
  expertise: [{ anyProficientSkill: 1 }],
  savingThrowProficiencies: [{ str: true }],
  toolProficiencies: [{ "thieves' tools": true }],
  languageProficiencies: [{ common: true }],
  weaponProficiencies: [{ martial: true }],
  armorProficiencies: [{ light: true }],
  resist: ['fire'],
  immune: ['poison'],
  conditionImmune: ['charmed'],
  senses: [{ blindsight: 10 }],
  bonusSenses: [{ darkvision: 60 }],
  additionalSpells: [
    { innate: { '1': ['misty step'] }, expanded: { s: { '1': ['shield'] } } },
  ],
  optionalfeatureProgression: [{ name: 'Maneuvers', progression: { '*': 2 } }, 'junk'],
  hp: { perLevel: 2, flat: 40 },
  entries: ['You gain a trick.'],
})
const empty = makeFeat({ name: 'Blank' })

const basics = describeFeats([full])[0].facts
const text = (key: string, feat: Feat) => {
  const found: Fact<Feat> | undefined = basics.find((f) => f.key === key)
  if (!found) throw new Error(`no fact ${key}`)
  return found.text(feat)
}
const column = (key: string) => {
  const found = featColumns.find((c) => c.key === key)
  if (!found) throw new Error(`no column ${key}`)
  return found
}

describe('feat identity', () => {
  it('keys, names and tags a feat by its edition year', () => {
    expect(featKey(full)).toBe('magic initiate|xphb')
    expect(featName(full)).toBe('Magic Initiate (Cleric)')
    expect(featTags(full)).toEqual(['2024'])
    expect(featTags(empty)).toEqual(['2014'])
  })
})

describe('feat facts', () => {
  it('describes the feat as basics and its text', () => {
    const groups = describeFeats([full])
    expect(groups.map((g) => g.key)).toEqual(['basics', 'text'])
    expect(groups[1].facts[0].text(full)).toContain('You gain a trick.')
    expect(groups[1].facts[0].text(empty)).toBe('')
    const { container } = render(<>{groups[1].facts[0].render?.(full)}</>)
    expect(container).toHaveTextContent('You gain a trick.')
  })

  it('states category, prerequisite and the lowest level asked', () => {
    expect(text('category', full)).toBe('Origin')
    expect(text('category', empty)).toBe('Uncategorized (2014 rules)')
    expect(text('prerequisite', full)).toBe('Level 4; or Fighter level 8')
    expect(text('prerequisite', empty)).toBe('')
    expect(text('minimumLevel', full)).toBe('4')
    expect(text('minimumLevel', empty)).toBe('')
    expect(
      text('minimumLevel', makeFeat({ name: 'Or', prerequisites: [{}, { level: 4 }] })),
    ).toBe('')
  })

  it('draws the category with a tooltip and the ability codes with their names', () => {
    const category = basics.find((f) => f.key === 'category')
    expect(render(<>{category?.render?.(full)}</>).container).toHaveTextContent('Origin')
    const ability = basics.find((f) => f.key === 'ability')
    const { container } = render(<>{ability?.render?.(full)}</>)
    expect(container).toHaveTextContent('+1 to STR or DEX')
    expect(container.querySelectorAll('abbr')).toHaveLength(2)
    expect(text('ability', empty)).toBe('')
  })

  it('lists each grant in words, and nothing for a feat without it', () => {
    expect(text('skills', full)).toBe('Perception')
    expect(text('expertise', full)).toBe('1 skill you are proficient in')
    expect(text('saves', full)).toBe('Strength')
    expect(text('tools', full)).toBe("Thieves' Tools")
    expect(text('languages', full)).toBe('Common')
    expect(text('weapons', full)).toBe('Martial weapons')
    expect(text('armor', full)).toBe('Light armor')
    expect(text('resist', full)).toBe('Fire')
    expect(text('immune', full)).toBe('Poison')
    expect(text('conditionImmune', full)).toBe('Charmed')
    expect(text('senses', full)).toBe('Blindsight 10 ft., Darkvision +60 ft.')
    expect(text('spells', full)).toBe('Misty Step')
    expect(text('spellList', full)).toBe('Shield')
    for (const f of basics.filter((b) => b.key !== 'category'))
      if (!['source', 'edition'].includes(f.key)) expect(f.text(empty)).toBe('')
  })

  it('states class options, hit points and repeating', () => {
    expect(text('classOptions', full)).toBe('Maneuvers: 2')
    expect(text('hitPoints', full)).toBe('+2 per level, +40')
    expect(text('repeatable', full)).toBe('Yes')
    expect(
      text(
        'classOptions',
        makeFeat({
          name: 'X',
          optionalfeatureProgression: [{ name: 'A', progression: {} }],
        }),
      ),
    ).toBe('')
  })

  it('gives the book and the edition year', () => {
    expect(text('source', full)).toBe('XPHB')
    expect(text('edition', full)).toBe('2024')
    expect(text('edition', empty)).toBe('2014')
  })

  it('summarises a chosen feat with the facts a player weighs', () => {
    expect(featSummary.map((f) => f.key)).toEqual([
      'category',
      'prerequisite',
      'skills',
      'tools',
      'spells',
      'hitPoints',
      'resist',
    ])
  })
})

describe('feat columns', () => {
  it('shows what a player compares on, and holds the rest in the chooser', () => {
    const shown = featColumns.filter((c) => !c.defaultHidden).map((c) => c.key)
    expect(shown).toEqual([
      'name',
      'source',
      'edition',
      'prerequisite',
      'ability',
      'skills',
      'spells',
      'category',
      'repeatable',
    ])
    expect(featColumns.some((c) => c.defaultHidden)).toBe(true)
  })

  it('filters by what each feat grants', () => {
    expect(column('ability').filterValue?.(full)).toEqual(['Strength', 'Dexterity'])
    expect(column('ability').filterValue?.(empty)).toEqual(['-'])
    expect(column('skills').filterValue?.(full)).toEqual(['Perception'])
    expect(column('spells').filterValue?.(full)).toEqual(['Yes'])
    expect(column('spells').filterValue?.(empty)).toEqual(['-'])
    expect(column('repeatable').filterValue?.(full)).toBe('Yes')
    expect(column('repeatable').filterValue?.(empty)).toBe('No')
    expect(column('senses').filterValue?.(full)).toEqual(['Blindsight', 'Darkvision'])
    expect(column('senses').filterValue?.(empty)).toEqual(['-'])
  })

  it('sorts the name and the minimum level', () => {
    expect(column('name').sortValue?.(full)).toBe('Magic Initiate (Cleric)')
    expect(column('minimumLevel').sortValue?.(full)).toBe(4)
    const { container } = render(<>{column('name').render(full)}</>)
    expect(container.querySelector('strong')).toHaveTextContent('Magic Initiate (Cleric)')
  })

  it('searches the name, book, category, prerequisite and text', () => {
    const found = featSearchText(full)
    for (const part of ['Magic Initiate (Cleric)', 'XPHB', 'Origin', 'Level 4', 'trick'])
      expect(found).toContain(part)
  })
})
