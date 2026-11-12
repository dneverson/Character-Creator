import { describe, expect, it } from 'vitest'
import { deriveSheet } from '.'
import { BONUS_SLOT_PREFIX, createCharacter, type Character } from '../character/model'
import type { LoadedClass } from '../data/class'
import type { ClassOption } from '../data/classOptions'
import { build, deps, FIGHTER, loadedClass } from '../test/derivedFixtures'
import type { DeriveDeps } from './sources'
import { SECTION_TITLES } from './checklist'

const guild = {
  key: 'g|phb',
  name: 'Guild Artisan',
  source: 'PHB',
  abilityOptions: [],
  featGrants: [],
  storyTables: [],
  entries: [],
  toolProficiencies: [{ anyArtisansTool: 1 }],
  languageProficiencies: [{ anyStandard: 2 }],
}

const human = {
  baseName: 'Human',
  source: 'PHB',
  name: 'Human',
  abilityFixed: {},
  abilityChoices: {},
}

/** A built Fighter with a species and a background: nothing is open. */
function finished(): Character {
  const c = build('Fighter', 1, {}, [])
  c.race = human
  c.background = { name: 'Guild Artisan', source: 'PHB', abilityChoices: {} }
  return c
}

const itemsOf = (c: Character, d: DeriveDeps = deps([FIGHTER])) =>
  deriveSheet(c, d).checklist.items

const idsOf = (c: Character, d?: DeriveDeps) => itemsOf(c, d).map((i) => i.id)

describe('the build checklist', () => {
  it('lists everything a new character still needs, pointing at the section or the name', () => {
    const { items } = deriveSheet(createCharacter(), deps([])).checklist
    expect(items).toEqual([
      { id: 'name', section: 'name', count: 1, label: 'Name your character' },
      { id: 'class', section: 'class', count: 1, label: 'Choose a class' },
      { id: 'race', section: 'race', count: 1, label: 'Choose a race or species' },
      {
        id: 'background',
        section: 'background',
        count: 1,
        label: 'Choose a background',
      },
      {
        id: 'abilities',
        section: 'abilities',
        count: 6,
        label: '6 ability scores not assigned',
      },
    ])
  })

  it('is empty for a finished build', () => {
    expect(deriveSheet(finished(), deps([FIGHTER])).checklist.items).toEqual([])
  })

  it('counts ability scores that have no value', () => {
    const c = finished()
    c.abilities = { ...c.abilities, str: { base: null, other: 0 } }
    expect(itemsOf(c)).toEqual([
      expect.objectContaining({
        id: 'abilities',
        count: 1,
        label: '1 ability score not assigned',
      }),
    ])
  })

  it('asks for the subclass once it is due, only when a book offers one', () => {
    const subclass = {
      name: 'Champion',
      shortName: 'Champion',
      source: 'PHB',
      className: 'Fighter',
      classSource: 'PHB',
      subclassFeatures: [],
    }
    const withSubclass: LoadedClass = { ...FIGHTER, file: { subclass: [subclass] } }
    const c = finished()
    expect(idsOf(c, deps([withSubclass]))).toEqual(['subclass'])
    expect(idsOf(c, deps([FIGHTER]))).toEqual([])
    c.classes = [
      {
        ...c.classes[0],
        subclass: { name: 'Champion', shortName: 'Champion', source: 'PHB' },
      },
    ]
    expect(idsOf(c, deps([withSubclass]))).toEqual([])
    c.classes = [{ ...c.classes[0], subclass: undefined, level: 0 }]
    expect(idsOf(c, deps([withSubclass]))).toEqual(['class'])
  })

  it('counts empty feat slots, and not a slot with an Ability Score Improvement', () => {
    const c = finished()
    c.feats = { choices: {}, bonusSlots: [`${BONUS_SLOT_PREFIX}one`] }
    expect(itemsOf(c)).toEqual([
      expect.objectContaining({ id: 'feats', section: 'feats', count: 1 }),
    ])
    c.feats = {
      choices: {
        [`${BONUS_SLOT_PREFIX}one`]: { kind: 'asi', abilityChoices: { str: 2 } },
      },
      bonusSlots: [`${BONUS_SLOT_PREFIX}one`],
    }
    expect(idsOf(c)).toEqual([])
  })

  it('splits the open picks into skills and the other proficiencies', () => {
    const d: DeriveDeps = { ...deps([FIGHTER]), background: guild }
    const c = finished()
    expect(itemsOf(c, d)).toEqual([
      expect.objectContaining({
        id: 'proficiencies',
        section: 'proficiencies',
        count: 3,
      }),
    ])
    c.grantPicks = { language: { dwarvish: 'bg', elvish: 'bg' }, tool: { x: 'bg' } }
    expect(idsOf(c, d)).toEqual([])
    const skilled: DeriveDeps = {
      ...d,
      background: { ...guild, skillProficiencies: [{ any: 2 }] },
    }
    expect(itemsOf(finished(), skilled)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'skills', section: 'skills', count: 2 }),
      ]),
    )
  })

  it('counts the fighting styles still to choose', () => {
    const fighter = loadedClass('Fighter', [], [])
    fighter.entry.optionalfeatureProgression = [
      { name: 'Fighting Style', featureType: ['FS:F'], progression: { '1': 1 } },
    ]
    const style: ClassOption = {
      key: 'Defense|PHB',
      name: 'Defense',
      source: 'PHB',
      types: ['FS:F'],
      entries: ['Text.'],
    }
    const d: DeriveDeps = { ...deps([fighter]), fightingStyles: [style] }
    const c = finished()
    expect(itemsOf(c, d)).toEqual([
      expect.objectContaining({ id: 'class-options', section: 'combat', count: 1 }),
    ])
    c.classOptions = { 'class:Fighter|PHB|FS:F': ['Defense|PHB'] }
    expect(idsOf(c, d)).toEqual([])
  })

  it('counts the cantrips and spells a caster has not chosen', () => {
    const sorcerer = loadedClass('Sorcerer', [], [])
    sorcerer.entry.casterProgression = 'full'
    sorcerer.entry.cantripProgression = [4]
    sorcerer.entry.spellsKnownProgression = [2]
    sorcerer.entry.spellcastingAbility = 'cha'
    const c = build('Sorcerer', 1, {}, [])
    c.race = human
    c.background = { name: 'Guild Artisan', source: 'PHB', abilityChoices: {} }
    expect(itemsOf(c, deps([sorcerer]))).toEqual([
      expect.objectContaining({ id: 'spells', section: 'spells', count: 6 }),
    ])
    const ref = (name: string, level = 0) => ({ name, source: 'PHB', level })
    c.spells = {
      'Sorcerer|PHB': {
        cantrips: ['A', 'B', 'C', 'D'].map((n) => ref(n)),
        spells: [ref('E', 1)],
      },
    }
    expect(itemsOf(c, deps([sorcerer]))).toEqual([
      expect.objectContaining({ id: 'spells', count: 1 }),
    ])
  })

  it('asks for the starting equipment of the first class and of the background', () => {
    const fighter: LoadedClass = {
      ...FIGHTER,
      entry: {
        ...FIGHTER.entry,
        startingEquipment: { defaultData: [{ _: ['dagger'] }] },
      },
    }
    const d: DeriveDeps = {
      ...deps([fighter]),
      background: { ...guild, startingEquipment: [{ _: ['dagger'] }] },
    }
    const c = finished()
    c.background = { name: 'Guild Artisan', source: 'PHB', abilityChoices: {} }
    // The background's tool and language picks are open too; look at the equipment only.
    const equipment = () => itemsOf(c, d).find((i) => i.id === 'equipment')
    expect(equipment()).toMatchObject({
      count: 2,
      label: 'Starting equipment not taken: class and background',
    })
    c.equipment.starting = { class: { source: 'Fighter|PHB', option: 'A', picks: {} } }
    expect(equipment()).toMatchObject({ count: 1 })
    c.equipment.starting = {
      class: { source: 'Fighter|PHB', option: 'A', picks: {} },
      background: { source: 'g|phb', option: 'none', picks: {} },
    }
    expect(equipment()).toBeUndefined()
  })
})

describe('the status of each section', () => {
  it('marks a section open while it has an item and done when it has none', () => {
    const { status } = deriveSheet(finished(), deps([FIGHTER])).checklist
    expect(status).toMatchObject({
      class: 'done',
      race: 'done',
      background: 'done',
      abilities: 'done',
      skills: 'done',
      proficiencies: 'done',
    })
    const fresh = deriveSheet(createCharacter(), deps([])).checklist.status
    expect(fresh).toMatchObject({
      class: 'open',
      race: 'open',
      background: 'open',
      abilities: 'open',
    })
  })

  it('shows nothing for a section that has nothing to do for this character', () => {
    const { status } = deriveSheet(createCharacter(), deps([])).checklist
    expect(status.feats).toBeUndefined()
    expect(status.spells).toBeUndefined()
    expect(status.combat).toBeUndefined()
    expect(status.equipment).toBeUndefined()
    expect(status.skills).toBeUndefined()
  })

  it('names every section once', () => {
    expect(Object.keys(SECTION_TITLES)).toHaveLength(13)
  })
})
