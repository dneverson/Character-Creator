import { describe, expect, it } from 'vitest'
import {
  factText,
  readCard,
  readDeck,
  readItemGroup,
  readItemMastery,
  readItemProperty,
  readItemType,
  readObject,
  readRecipe,
  readVehicle,
  type Raw,
} from './readers'

const raw = (fields: Record<string, unknown>): Raw => ({ source: 'X', ...fields })
const fact = (read: { facts: { label: string; value: string }[] }, label: string) =>
  read.facts.find((f) => f.label === label)?.value
const names = (entries: unknown[]) =>
  entries.map((e) => (e as { name?: string }).name ?? e)

describe('factText', () => {
  it('writes a word, a number or a list of them, without tags', () => {
    expect(factText('a {@spell fireball}')).toBe('a fireball')
    expect(factText([1, 'b', {}])).toBe('1, b')
    expect(factText({})).toBe('')
  })
})

describe('reading an object', () => {
  it('writes its stats out and keeps its actions as text', () => {
    const read = readObject(
      raw({
        size: ['L'],
        ac: 17,
        hp: 50,
        speed: 0,
        str: 14,
        dex: 10,
        senses: ['blindsight 10 ft.'],
        immune: ['acid', 'poison'],
        resist: [{ resist: ['fire'], note: 'while lit' }],
        entries: ['A statue.'],
        actionEntries: [{ type: 'actions', name: 'Claw', entries: ['Hits.'] }],
      }),
    )
    expect(fact(read, 'Size')).toBe('Large')
    expect(fact(read, 'Armor Class')).toBe('17')
    expect(fact(read, 'Hit Points')).toBe('50')
    expect(fact(read, 'Speed')).toBeUndefined()
    expect(fact(read, 'Abilities')).toBe('Strength 14 (+2), Dexterity 10 (+0)')
    expect(fact(read, 'Damage Immunities')).toBe('Acid, poison')
    expect(fact(read, 'Damage Resistances')).toBe('Fire while lit')
    expect(names(read.entries)).toEqual(['A statue.', 'Actions'])
  })

  it('has no action block when it has no actions, and a speed when it moves', () => {
    const read = readObject(raw({ size: 'M', speed: 30 }))
    expect(read.entries).toEqual([])
    expect(fact(read, 'Speed')).toBe('30 ft.')
    expect(fact(read, 'Size')).toBe('Medium')
  })
})

describe('reading a vehicle', () => {
  it('writes out a ship: its hull, parts, weapons and actions', () => {
    const read = readVehicle(
      raw({
        vehicleType: 'SHIP',
        size: 'G',
        terrain: ['air'],
        dimensions: ['80 ft.', '20 ft.'],
        capCrew: 20,
        capPassenger: 10,
        capCreature: 2,
        capCargo: 1,
        hull: { ac: 15, acFrom: ['wood'], hp: 500, dt: 15 },
        control: [{ name: 'Helm', ac: 18, hp: 50, entries: ['Steers.'] }],
        movement: [
          {
            name: 'Propeller',
            ac: 12,
            hp: 100,
            hpNote: '-5 ft. per 25 damage',
            speed: [{ mode: 'air', entries: ['80 ft.'] }],
          },
        ],
        weapon: [
          {
            name: 'Harpoon',
            count: 3,
            ac: 15,
            hp: 50,
            action: [{ name: 'Fire', entries: ['Hits.'] }],
          },
          { name: 'Gun', count: 1 },
        ],
        actionStation: [{ name: 'Station', entries: ['Mans.'] }],
        action: ['The ship acts.'],
        reaction: [{ name: 'Brace', entries: ['Braces.'] }],
        trait: [{ name: 'Big', entries: ['Large.'] }],
        immune: ['poison'],
        conditionImmune: ['blinded'],
        str: 18,
        speed: { fly: 50 },
        entries: ['Intro.'],
      }),
    )
    expect(fact(read, 'Type')).toBe('Ship')
    expect(fact(read, 'Size')).toBe('Gargantuan')
    expect(fact(read, 'Terrain')).toBe('Air')
    expect(fact(read, 'Hull')).toBe(
      'Armor Class 15 (wood), Hit Points 500, Damage Threshold 15',
    )
    expect(fact(read, 'Cargo capacity')).toBe('1 tons')
    expect(fact(read, 'Speed')).toBe('fly 50 ft.')
    expect(names(read.entries)).toEqual([
      'Intro.',
      'Traits',
      'Control',
      'Movement',
      'Weapons',
      'Action stations',
      'Actions',
      'Reactions',
    ])
    const weapons = read.entries.find((e) => (e as { name?: string }).name === 'Weapons')
    expect(JSON.stringify(weapons)).toContain('Harpoon (3)')
    expect(JSON.stringify(weapons)).toContain('"Gun"')
    expect(JSON.stringify(read.entries)).toContain('-5 ft. per 25 damage')
  })

  it('reads the points of a war machine and an object that is a vehicle', () => {
    const machine = readVehicle(
      raw({ vehicleType: 'INFWAR', hp: { hp: 200, dt: 10, mt: 20 }, speed: 100, ac: 19 }),
    )
    expect(fact(machine, 'Hit Points')).toBe('200')
    expect(fact(machine, 'Damage Threshold')).toBe('10')
    expect(fact(machine, 'Mishap Threshold')).toBe('20')
    expect(fact(machine, 'Speed')).toBe('100 ft.')
    expect(fact(machine, 'Armor Class')).toBe('19')
    const plain = readVehicle(raw({ vehicleType: 'OBJECT', hp: 200, capCargo: 'x' }))
    expect(fact(plain, 'Hit Points')).toBe('200')
    expect(fact(plain, 'Cargo capacity')).toBeUndefined()
    expect(fact(readVehicle(raw({ vehicleType: 'LOST' })), 'Type')).toBeUndefined()
  })
})

describe('reading a recipe', () => {
  it('writes the amounts into the ingredients', () => {
    const read = readRecipe(
      raw({
        type: 'Ranger',
        dishTypes: ['entree'],
        makes: 'one casserole',
        serves: { exact: 6, note: 'as a snack' },
        allergenGroups: ['eggs', 'milk'],
        ingredients: [
          { type: 'ingredient', entry: '{=amount1/v} cups milk', amount1: 2 },
          { type: 'ingredient', entry: '{=amount1/v} cup parsley', amount1: 0.33 },
          { type: 'ingredient', entry: '{=amount1/v} cup oil', amount1: 1.5 },
          { type: 'ingredient', entry: '{=amount1/v} cup sugar', amount1: 0.04 },
          { type: 'ingredient', entry: '{=amount1/v} cup salt', amount1: 0.9 },
          { type: 'ingredient', entry: '{=amount2/v} nothing' },
          { type: 'ingredient' },
          'Salt and pepper',
        ],
        equipment: [{ type: 'ingredient', entry: '{=amount1/v} glasses', amount1: 2 }],
        instructions: ['Mix.'],
        noteCook: ['Fresh is best.'],
      }),
    )
    expect(fact(read, 'Dish')).toBe('Entree')
    expect(fact(read, 'Serves')).toBe('6 as a snack')
    expect(fact(read, 'Allergens')).toBe('Eggs, Milk')
    const text = JSON.stringify(read.entries)
    for (const line of [
      '2 cups milk',
      '1/3 cup parsley',
      '1 1/2 cup oil',
      '0.04 cup sugar',
      '0.9 cup salt',
      ' nothing',
      'Salt and pepper',
      '2 glasses',
      'Mix.',
      'Fresh is best.',
    ])
      expect(text, line).toContain(line)
  })

  it('reads a range of servings and a recipe with no equipment or notes', () => {
    const read = readRecipe(
      raw({ serves: { min: 4, max: 6 }, ingredients: [], instructions: [] }),
    )
    expect(fact(read, 'Serves')).toBe('4 to 6')
    expect(names(read.entries)).toEqual(['Ingredients', 'Instructions'])
    const none = readRecipe(raw({ ingredients: [], instructions: [] }))
    expect(fact(none, 'Serves')).toBeUndefined()
  })
})

describe('reading decks and cards', () => {
  it('counts the cards of a deck and knows a card by its deck', () => {
    const deck = readDeck(raw({ cards: [{ count: 3 }, {}], entries: ['A deck.'] }))
    expect(fact(deck, 'Cards')).toBe('4')
    expect(deck.entries).toEqual(['A deck.'])
    expect(fact(readDeck(raw({})), 'Cards')).toBeUndefined()
    const card = readCard(raw({ set: 'Tarokka', entries: ['A card.'] }))
    expect(card.context).toBe('Tarokka')
    expect(fact(card, 'Deck')).toBe('Tarokka')
    expect(readCard(raw({})).context).toBeUndefined()
  })
})

describe('reading item properties, masteries and types', () => {
  it('names a property by its text and keeps its abbreviation as another name', () => {
    const read = readItemProperty(
      raw({
        abbreviation: '2H',
        entries: [{ type: 'entries', name: 'Two-Handed', entries: ['x'] }],
      }),
    )
    expect(read.name).toBe('Two-Handed')
    expect(read.aliases).toEqual(['2H'])
    expect(fact(read, 'Abbreviation')).toBe('2H')
    expect(readItemProperty(raw({ abbreviation: 'S', entries: ['plain'] })).name).toBe(
      'S',
    )
    expect(readItemProperty(raw({})).aliases).toEqual([])
  })

  it('reads a mastery as its text, and a type with the text added to it', () => {
    expect(readItemMastery(raw({ entries: ['Cleaves.'] })).entries).toEqual(['Cleaves.'])
    expect(readItemMastery(raw({})).entries).toEqual([])
    const file = {
      itemTypeAdditionalEntries: [
        { appliesTo: 'GS|PHB', entries: ['More.'] },
        { appliesTo: 'AT|PHB', entries: ['Other.'] },
        { appliesTo: 'GS|PHB' },
      ],
    }
    const type = readItemType(
      raw({ abbreviation: 'GS', source: 'PHB', entries: ['Gaming.'] }),
      file,
    )
    expect(type.entries).toEqual(['Gaming.', 'More.'])
    expect(type.aliases).toEqual(['GS'])
    const bare = readItemType(raw({}), {})
    expect(bare.entries).toEqual([])
    expect(bare.aliases).toEqual([])
  })
})

describe('reading an item group', () => {
  it('names the items it stands for', () => {
    const read = readItemGroup(
      raw({
        items: ['Spell Scroll (Cantrip)', 'Gaming Set|PHB', { x: 1 }],
        entries: ['Many.'],
      }),
    )
    expect(fact(read, 'Includes')).toBe('Spell Scroll (Cantrip), Gaming Set')
    expect(read.entries).toEqual(['Many.'])
    expect(readItemGroup(raw({})).facts).toEqual([])
  })
})
