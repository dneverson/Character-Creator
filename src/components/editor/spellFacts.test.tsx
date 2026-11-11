import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Spell } from '../../data/spells'
import { listsOf, makeSpell } from '../../test/spellFixtures'
import type { Fact } from '../table/facts'
import {
  describeSpells,
  spellCantripColumns,
  spellCantripSummaryColumns,
  spellColumns,
  spellKey,
  spellName,
  spellSearchText,
  spellSummaryColumns,
  spellTags,
  withVersions,
} from './spellFacts'

const fireball = makeSpell({
  name: 'Fireball',
  source: 'XPHB',
  edition: 'one',
  level: 3,
  school: 'V',
  casting: '1 action',
  castingUnit: 'Action',
  range: '150 ft.',
  rangeFeet: 150,
  components: { v: true, s: true, m: true, royalty: false },
  material: { text: 'a ball of bat guano', costGp: 50, consumed: true },
  duration: 'Instantaneous',
  durationKind: 'Instantaneous',
  damage: '8d6 Fire; 1d6 Cold; 2d4 Acid',
  damageTypes: ['Fire', 'Cold', 'Acid'],
  save: ['Dexterity'],
  area: '20-ft. radius sphere',
  tags: ['Affects objects'],
  upcast: '+1d6 per slot level above 3rd',
  creatureTypes: ['Dragon'],
  conditions: ['Frightened'],
  aliases: ['Fire Ball'],
  srdName: 'Fireball',
  entries: ['A bright streak flashes.'],
  entriesHigherLevel: [
    { type: 'entries', name: 'Using a Higher-Level Spell Slot', entries: ['More.'] },
  ],
  lists: listsOf('Wizard|XPHB', 'Sorcerer|XPHB'),
})
const fireBolt = makeSpell({
  name: 'Fire Bolt',
  level: 0,
  ritual: true,
  concentration: true,
  attack: 'Ranged',
  damage: '1d10 Fire',
  damageTypes: ['Fire'],
  cantripScaling: '1d10, 2d10 at 5',
  healing: 'Yes',
  entriesHigherLevel: [{ type: 'entries', name: 'Cantrip Upgrade', entries: ['Grows.'] }],
})
const blank = makeSpell({
  name: 'Blank',
  components: { v: false, s: false, m: false, royalty: false },
  range: 'Self (30-ft. cone)',
  rangeFeet: 0,
})
const touch = makeSpell({ name: 'Touchy', range: 'Touch', rangeFeet: 5 })
const sight = makeSpell({ name: 'Sighty', range: 'Unlimited' })
const special = makeSpell({ name: 'Odd', range: 'Special' })
const cheap = makeSpell({
  name: 'Cheap',
  material: { text: 'a pebble', consumed: false },
})
const royal = makeSpell({
  name: 'Royal',
  components: { v: true, s: false, m: false, royalty: true },
})
const twoDamage = makeSpell({
  name: 'Two',
  damage: '1d6 Fire; 2d6 Cold',
  damageTypes: ['Fire'],
})

const groups = describeSpells([fireball])
const basics = groups[0].facts
const factOf = (key: string) => {
  const found: Fact<Spell> | undefined = [...basics, ...groups[1].facts].find(
    (f) => f.key === key,
  )
  if (!found) throw new Error(`no fact ${key}`)
  return found
}
const column = (key: string) => {
  const found = spellColumns.find((c) => c.key === key)
  if (!found) throw new Error(`no column ${key}`)
  return found
}
const filterOf = (key: string, spell: Spell) => column(key).filterValue?.(spell)

describe('spell identity', () => {
  it('keys a spell, names it and tags its edition year', () => {
    expect(spellKey(fireball)).toBe('fireball|xphb')
    expect(spellName(fireball)).toBe('Fireball')
    expect(spellTags(fireball)).toEqual(['2024'])
    expect(spellTags(fireBolt)).toEqual(['2014'])
  })
})

describe('spell facts', () => {
  it('states every stat of a spell as text', () => {
    const text = (key: string) => factOf(key).text(fireball)
    expect(text('level')).toBe('3rd level')
    expect(text('school')).toBe('Evocation')
    expect(text('casting')).toBe('1 action')
    expect(text('range')).toBe('150 ft.')
    expect(text('area')).toBe('20-ft. radius sphere')
    expect(text('components')).toBe('V, S, M')
    expect(text('material')).toBe('a ball of bat guano (worth 50 gp, consumed)')
    expect(text('duration')).toBe('Instantaneous')
    expect(text('damage')).toBe('8d6 Fire; 1d6 Cold; 2d4 Acid')
    expect(text('damageTypes')).toBe('Fire, Cold, Acid')
    expect(text('save')).toBe('Dexterity')
    expect(text('conditions')).toBe('Frightened')
    expect(text('affects')).toBe('Dragon')
    expect(text('tags')).toBe('Affects objects')
    expect(text('upcast')).toBe('+1d6 per slot level above 3rd')
    expect(text('classLists')).toBe('Wizard, Sorcerer')
    expect(text('source')).toBe('XPHB')
    expect(text('edition')).toBe('2024')
    expect(text('concentration')).toBe('')
    expect(text('ritual')).toBe('')
  })

  it('states a cantrip, its concentration, ritual, attack, healing and scaling', () => {
    const text = (key: string) => factOf(key).text(fireBolt)
    expect(text('level')).toBe('Cantrip')
    expect(text('concentration')).toBe('Yes')
    expect(text('ritual')).toBe('Yes')
    expect(text('attack')).toBe('Ranged attack')
    expect(text('healing')).toBe('Yes')
    expect(text('cantripScaling')).toBe('1d10, 2d10 at 5')
  })

  it('keeps higher-level text and the cantrip upgrade apart', () => {
    expect(factOf('higher').text(fireball)).toContain('Using a Higher-Level Spell Slot')
    expect(factOf('upgrade').text(fireball)).toBe('')
    expect(factOf('higher').text(fireBolt)).toBe('')
    expect(factOf('upgrade').text(fireBolt)).toContain('Cantrip Upgrade')
    expect(factOf('description').text(blank)).toBe('')
  })

  it('draws the description, the higher-level text and the components in full', () => {
    render(
      <>
        {factOf('description').render?.(fireball)}
        {factOf('higher').render?.(fireball)}
        {factOf('upgrade').render?.(fireBolt)}
        {factOf('components').render?.(fireball)}
      </>,
    )
    expect(screen.getByText('A bright streak flashes.')).toBeInTheDocument()
    expect(screen.getByText('More.')).toBeInTheDocument()
    expect(screen.getByText('Grows.')).toBeInTheDocument()
    expect(screen.getAllByText(/^[VSM]$/)).toHaveLength(3)
  })
})

describe('spell versions', () => {
  const name = (columns: typeof spellColumns, spell: Spell) => {
    const column = columns.find((c) => c.key === 'name')
    if (!column) throw new Error('no name column')
    render(<>{column.render(spell)}</>)
  }

  it('puts the edition year by the name of a spell printed in both editions only', () => {
    const twins = new Set([fireball.key])
    expect(withVersions(spellColumns, new Set())).toBe(spellColumns)
    expect(withVersions(spellColumns, undefined)).toBe(spellColumns)
    name(withVersions(spellColumns, twins), fireball)
    expect(screen.getByText('2024')).toBeInTheDocument()
  })

  it('leaves a spell with no namesake alone and keeps the other columns', () => {
    const columns = withVersions(spellColumns, new Set(['other|phb']))
    expect(columns.map((c) => c.key)).toEqual(spellColumns.map((c) => c.key))
    name(columns, fireball)
    expect(screen.queryByText('2024')).not.toBeInTheDocument()
  })
})

describe('spell columns', () => {
  it('hides the Level column in the cantrip tier only, and from its picks', () => {
    const level = (columns: typeof spellColumns) => columns.find((c) => c.key === 'level')
    expect(level(spellColumns)?.defaultHidden).toBeUndefined()
    expect(level(spellCantripColumns)?.defaultHidden).toBe(true)
    expect(spellCantripColumns.map((c) => c.key)).toEqual(spellColumns.map((c) => c.key))
    expect(spellCantripSummaryColumns.map((c) => c.key)).not.toContain('level')
  })

  it('shows what players compare first and hides the rest', () => {
    const shown = spellColumns.filter((c) => !c.defaultHidden).map((c) => c.key)
    expect(shown).toEqual([
      'name',
      'level',
      'school',
      'casting',
      'range',
      'duration',
      'components',
      'damage',
      'saveOrAttack',
      'source',
      'edition',
    ])
    const hidden = spellColumns.filter((c) => c.defaultHidden).map((c) => c.key)
    expect(hidden).toEqual(
      expect.arrayContaining([
        'material',
        'concentration',
        'ritual',
        'damageTypes',
        'healing',
        'save',
        'attack',
        'conditions',
        'area',
        'affects',
        'tags',
        'upcast',
        'cantripScaling',
        'classLists',
      ]),
    )
  })

  it('draws the name with ritual and concentration written out', () => {
    render(<>{column('name').render(fireBolt)}</>)
    expect(screen.getByText('Ritual')).toBeInTheDocument()
    expect(screen.getByText('Concentration')).toBeInTheDocument()
    expect(column('name').sortValue?.(fireBolt)).toBe('Fire Bolt')
  })

  it('sorts by level, casting time and range as numbers', () => {
    expect(column('level').sortValue?.(fireball)).toBe(3)
    expect(column('casting').sortValue?.(fireball)).toBe(0)
    expect(column('range').sortValue?.(fireball)).toBe(150)
  })

  it('filters by the words players use', () => {
    expect(filterOf('level', fireball)).toBe('3rd level')
    expect(filterOf('casting', fireball)).toBe('Action')
    expect(filterOf('duration', fireball)).toBe('Instantaneous')
    expect(filterOf('range', fireball)).toBe('Ranged')
    expect(filterOf('range', blank)).toBe('Self')
    expect(filterOf('range', touch)).toBe('Touch')
    expect(filterOf('range', sight)).toBe('Sight or unlimited')
    expect(filterOf('range', special)).toBe('Special')
    expect(filterOf('components', fireball)).toEqual(['Verbal', 'Somatic', 'Material'])
    expect(filterOf('components', royal)).toEqual(['Verbal', 'Royalty'])
    expect(filterOf('components', blank)).toEqual(['-'])
    expect(filterOf('material', fireball)).toEqual(['Costs gold', 'Consumed'])
    expect(filterOf('material', cheap)).toEqual(['Cheap and kept'])
    expect(filterOf('material', blank)).toEqual(['No material'])
    expect(filterOf('damage', fireball)).toEqual(['Fire', 'Cold', 'Acid'])
    expect(filterOf('damage', blank)).toEqual(['-'])
    expect(filterOf('damageTypes', fireball)).toEqual(['Fire', 'Cold', 'Acid'])
    expect(filterOf('damageTypes', blank)).toEqual(['-'])
    expect(filterOf('saveOrAttack', fireball)).toEqual(['Dexterity'])
    expect(filterOf('saveOrAttack', fireBolt)).toEqual(['Attack roll'])
    expect(filterOf('saveOrAttack', blank)).toEqual(['-'])
    expect(filterOf('save', fireball)).toEqual(['Dexterity'])
    expect(filterOf('save', blank)).toEqual(['-'])
    expect(filterOf('attack', fireBolt)).toBe('Ranged')
    expect(filterOf('attack', blank)).toBe('-')
    expect(filterOf('concentration', fireBolt)).toBe('Yes')
    expect(filterOf('concentration', fireball)).toBe('No')
    expect(filterOf('ritual', fireBolt)).toBe('Yes')
    expect(filterOf('ritual', fireball)).toBe('No')
    expect(filterOf('healing', fireBolt)).toBe('Yes')
    expect(filterOf('healing', fireball)).toBe('No')
    expect(filterOf('upcast', fireball)).toBe('Yes')
    expect(filterOf('upcast', blank)).toBe('No')
    expect(filterOf('conditions', fireball)).toEqual(['Frightened'])
    expect(filterOf('conditions', blank)).toEqual(['-'])
    expect(filterOf('affects', fireball)).toEqual(['Dragon'])
    expect(filterOf('affects', blank)).toEqual(['-'])
    expect(filterOf('tags', fireball)).toEqual(['Affects objects'])
    expect(filterOf('tags', blank)).toEqual(['-'])
    expect(filterOf('classLists', fireball)).toEqual(['Wizard', 'Sorcerer'])
    expect(filterOf('classLists', blank)).toEqual(['-'])
  })

  it('shows the first two damage amounts and the rest on a tooltip', () => {
    render(
      <>
        <div data-testid="three">{column('damage').render(fireball)}</div>
        <div data-testid="two">{column('damage').render(twoDamage)}</div>
        <div data-testid="none">{column('damage').render(blank)}</div>
      </>,
    )
    expect(screen.getByTestId('three')).toHaveTextContent('8d6 Fire; 1d6 Cold +1 more')
    expect(screen.getByTestId('two')).toHaveTextContent('1d6 Fire; 2d6 Cold')
    expect(screen.getByTestId('none')).toHaveTextContent('-')
  })

  it('shortens the picks table to the stats played with', () => {
    expect(spellSummaryColumns.map((c) => c.key)).toEqual([
      'name',
      'level',
      'casting',
      'range',
      'duration',
      'components',
      'damage',
      'saveOrAttack',
    ])
  })
})

describe('spell search text', () => {
  it('finds a spell by name, alias, school, class, what it does and where it is from', () => {
    const text = spellSearchText(fireball)
    for (const word of [
      'Fireball',
      'Fire Ball',
      'Evocation',
      'Wizard',
      'Frightened',
      'XPHB',
    ])
      expect(text).toContain(word)
    expect(text).toContain('Affects objects')
    expect(text).toContain('bright streak')
    expect(text).toContain('Using a Higher-Level Spell Slot')
  })
})
