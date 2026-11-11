import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeBeast } from '../../test/beastFixtures'
import {
  attackText,
  beastAttacks,
  beastColumns,
  beastSearchText,
  beastSummaryColumns,
  describeBeasts,
} from './beastFacts'
import { factValue } from '../table/facts'

const bear = makeBeast({
  name: 'Brown Bear',
  cr: '1',
  crValue: 1,
  size: ['L'],
  tags: ['bear'],
  ac: 11,
  acFrom: 'natural armor',
  hp: 34,
  hpFormula: '4d10 + 12',
  speed: { walk: 40, climb: 30 },
  abilities: { str: 19, dex: 10, con: 16, int: 2, wis: 13, cha: 7 },
  passive: 13,
  senses: ['darkvision 60 ft.'],
  skills: { perception: '+3' },
  traits: [{ name: 'Keen Smell', entries: ['Advantage on smell checks.'] }],
  actions: [
    { name: 'Multiattack', entries: ['The bear makes two attacks.'] },
    {
      name: 'Bite',
      entries: [
        '{@atk mw} {@hit 6} to hit, reach 5 ft. {@h}8 ({@damage 1d8 + 4}) piercing damage.',
      ],
    },
    { name: 'Slam', entries: ['{@atk mw} {@hit -1} to hit, {@h}1 bludgeoning damage.'] },
  ],
})

describe('attackText', () => {
  it('writes the bonus, damage dice and damage type', () => {
    expect(attackText(bear.actions[1])).toBe('Bite +6, 1d8 + 4 piercing')
  })
  it('keeps a bonus without readable damage and skips actions that are not attacks', () => {
    expect(attackText(bear.actions[2])).toBe('Slam -1')
    expect(attackText(bear.actions[0])).toBe('')
    expect(beastAttacks(bear)).toEqual(['Bite +6, 1d8 + 4 piercing', 'Slam -1'])
  })
})

describe('beast columns', () => {
  it('has a column for every stat, the played ones shown and the rest in the chooser', () => {
    const keys = beastColumns.map((c) => c.key)
    for (const key of [
      'name',
      'cr',
      'size',
      'kind',
      'ac',
      'hp',
      'speed',
      'source',
      'edition',
      'speed-walk',
      'speed-fly',
      'speed-swim',
      'speed-climb',
      'speed-burrow',
      'str',
      'dex',
      'con',
      'int',
      'wis',
      'cha',
      'passive',
      'senses',
      'skills',
      'attacks',
      'traits',
    ]) {
      expect(keys).toContain(key)
    }
    expect(beastSummaryColumns.map((c) => c.key)).toEqual([
      'name',
      'cr',
      'size',
      'ac',
      'hp',
      'speed',
    ])
    expect(beastColumns.find((c) => c.key === 'attacks')?.defaultHidden).toBe(true)
    expect(beastColumns.find((c) => c.key === 'cr')?.defaultHidden).toBeUndefined()
  })

  it('reads each stat of a beast', () => {
    const text = (key: string) => {
      const column = beastColumns.find((c) => c.key === key)
      return column?.filterValue?.(bear) ?? column?.sortValue?.(bear)
    }
    expect(text('speed-climb')).toBe('Yes')
    expect(text('speed-fly')).toBe('No')
    expect(text('speed')).toEqual(['Climbs', 'Land only'])
    expect(beastColumns.find((c) => c.key === 'str')?.sortValue?.(bear)).toBe(19)
    expect(beastColumns.find((c) => c.key === 'hp')?.sortValue?.(bear)).toBe(34)
    expect(
      beastColumns
        .find((c) => c.key === 'cr')
        ?.sortValue?.(makeBeast({ name: 'X', hasCr: false })),
    ).toBe(Number.POSITIVE_INFINITY)
  })

  it('draws names, swarm badges and tooltipped armor and hit points', () => {
    const cell = (key: string, beast = bear) => {
      const column = beastColumns.find((c) => c.key === key)
      return render(<div>{column?.render(beast)}</div>).container
    }
    expect(cell('ac').querySelector('span')?.title).toBe('natural armor')
    expect(cell('hp').querySelector('span')?.title).toBe('4d10 + 12')
    expect(cell('ac', makeBeast({ name: 'X', ac: 0 })).textContent).toBe('-')
    expect(cell('hp', makeBeast({ name: 'X', hp: 0 })).textContent).toBe('-')
    expect(cell('cr', makeBeast({ name: 'X', hasCr: false })).textContent).toBe('-')
    expect(cell('name', makeBeast({ name: 'Rats', swarm: true })).textContent).toBe(
      'Rats2014Swarm',
    )
  })
})

describe('describeBeasts', () => {
  it('states the stat block and the text of the traits and actions', () => {
    const groups = describeBeasts([bear])
    const facts = groups.flatMap((g) => g.facts)
    const shown = (key: string) => {
      const fact = facts.find((f) => f.key === key)
      return fact
        ? render(<div>{factValue(fact, bear)}</div>).container.textContent
        : undefined
    }
    expect(shown('ac')).toBe('11 (natural armor)')
    expect(shown('hp')).toBe('34 (4d10 + 12)')
    expect(shown('abilities')).toBe(
      'STR 19 (+4), DEX 10 (+0), CON 16 (+3), INT 2 (-4), WIS 13 (+1), CHA 7 (-2)',
    )
    expect(shown('speed')).toBe('40 ft., climb 30 ft.')
    expect(shown('senses')).toBe('Darkvision 60 ft.')
    expect(shown('skills')).toBe('Perception +3')
    expect(shown('traitText')).toContain('Keen Smell')
    expect(shown('actionText')).toContain('Multiattack')
  })

  it('searches by name, type, trait and action names', () => {
    expect(beastSearchText(bear)).toContain('Keen Smell')
    expect(beastSearchText(bear)).toContain('Bite')
    expect(beastSearchText(bear)).toContain('Bear')
  })
})
