import { describe, expect, it } from 'vitest'
import type { PickChip } from '../../character/picks'
import { makeItem } from '../../test/itemFixtures'
import { pickDetailOf } from './pickDetails'

const chip = (kind: PickChip['kind'], value: string): PickChip => ({
  kind,
  value,
  label: value,
  state: 'available',
})

const TOOL = makeItem({
  name: "Smith's Tools",
  category: "Artisan's tools",
  entries: ["Smith's tools allow you to work metal."],
})

const SWORD = makeItem({
  name: 'Longsword',
  category: 'Martial melee weapon',
  weapon: {
    category: 'martial',
    melee: true,
    damage: { text: '1d8', average: 4.5 },
    versatile: { text: '1d10', average: 5.5 },
    damageTypes: ['Slashing'],
    properties: [
      { code: 'V', name: 'Versatile', label: 'Versatile (1d10)', rule: 'Two hands.' },
    ],
    mastery: [],
  },
})

const detail = pickDetailOf({
  items: [TOOL, SWORD],
  languages: [
    {
      name: 'Dwarvish',
      entries: [{ source: 'PHB', type: 'standard' }],
      script: 'Dwarvish',
      speakers: ['Dwarves', '{@creature duergar}'],
    },
    { name: 'Signs', entries: [{ source: 'PHB', type: 'weird' }] },
  ],
  skills: new Map([
    ['stealth', [{ edition: 'classic', entries: ['Hide.'] }]],
    [
      'arcana',
      [
        { edition: 'classic', entries: ['Recall.'] },
        { edition: 'one', entries: ['Recall, 2024.'] },
      ],
    ],
  ]),
})

describe('pick details', () => {
  it('describes a tool by its category and text', () => {
    expect(detail(chip('tool', "smith's tools"))).toEqual({
      facts: [{ label: 'Category', value: "Artisan's tools" }],
      entries: ["Smith's tools allow you to work metal."],
    })
  })

  it('gives a tool printed in both editions one block of text per edition', () => {
    const lute = (source: string, edition: 'classic' | 'one', entries: string[]) =>
      makeItem({ name: 'Lute', source, edition, category: 'Musical instrument', entries })
    const both = pickDetailOf({
      items: [
        lute('PHB', 'classic', ['Play a tune.']),
        lute('XPHB', 'one', ['Ability: Charisma.']),
        lute('FRHoF', 'one', ['Another 2024 printing.']),
      ],
      languages: [],
    })
    expect(both(chip('tool', 'lute'))?.entries).toEqual([
      { type: 'entries', name: '2014 rules', entries: ['Play a tune.'] },
      { type: 'entries', name: '2024 rules', entries: ['Ability: Charisma.'] },
    ])
    // A 2014 printing with no text of its own still shows the other edition's text.
    const one = pickDetailOf({
      items: [lute('PHB', 'classic', []), lute('XPHB', 'one', ['Ability: Charisma.'])],
      languages: [],
    })
    expect(one(chip('tool', 'lute'))?.entries).toEqual(['Ability: Charisma.'])
  })

  it('names each typical speaker once, however the books tag them', () => {
    const d = pickDetailOf({
      items: [],
      languages: [
        {
          name: 'Draconic',
          entries: [{ source: 'PHB', type: 'standard' }],
          speakers: ['Dragons', '{@creature dragon|MM|dragons}', 'dragonborn'],
        },
      ],
    })
    expect(d(chip('language', 'draconic'))?.facts).toContainEqual({
      label: 'Typical speakers',
      value: 'Dragons, dragonborn',
    })
  })

  it('describes a weapon by its damage and properties, with each rule', () => {
    const d = detail(chip('weapon', 'longsword'))
    expect(d?.facts).toEqual([
      { label: 'Category', value: 'Martial melee weapon' },
      { label: 'Damage', value: '1d8, versatile 1d10' },
      { label: 'Damage type', value: 'Slashing' },
      { label: 'Properties', value: 'Versatile (1d10)' },
    ])
    expect(d?.entries).toEqual([
      { type: 'list', items: ['Versatile (1d10): Two hands.'] },
    ])
  })

  it('describes a language by type, script and speakers', () => {
    expect(detail(chip('language', 'dwarvish'))?.facts).toEqual([
      { label: 'Type', value: 'Standard' },
      { label: 'Script', value: 'Dwarvish' },
      { label: 'Typical speakers', value: 'Dwarves, duergar' },
    ])
    expect(detail(chip('language', 'signs'))?.facts).toEqual([
      { label: 'Type', value: 'weird' },
    ])
  })

  it('gives a skill and expertise its text, one block per edition when they differ', () => {
    expect(detail(chip('skill', 'stealth'))?.entries).toEqual(['Hide.'])
    expect(detail(chip('expertise', 'arcana'))?.entries).toEqual([
      { type: 'entries', name: '2014 rules', entries: ['Recall.'] },
      { type: 'entries', name: '2024 rules', entries: ['Recall, 2024.'] },
    ])
  })

  it('falls back to the item for expertise in a tool, and to nothing without data', () => {
    expect(detail(chip('expertise', "smith's tools"))?.entries).toHaveLength(1)
    expect(detail(chip('armor', 'light'))).toBeUndefined()
    expect(detail(chip('tool', 'nothing'))).toBeUndefined()
    expect(detail(chip('language', 'nothing'))).toBeUndefined()
  })
})
