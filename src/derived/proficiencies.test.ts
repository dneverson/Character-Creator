import { describe, expect, it } from 'vitest'
import { armorProficiency, proficiencies, weaponProficiency } from './proficiencies'
import { collectSources, type HeldItem } from './sources'
import { createCharacter } from '../character/model'
import { FIGHTER, WIZARD, deps, featOf, item, loadedClass } from '../test/derivedFixtures'
import type { PlayableBackground } from '../data/background'
import type { PlayableRace } from '../data/race'
import { makeItem } from '../test/itemFixtures'

const held = (name: string, base = name): HeldItem => ({
  stack: { name, source: 'PHB', quantity: 1, equipped: true },
  item: item(base),
  source: { kind: 'item', tag: `item:${name}`, label: name },
  baseName: base,
  active: true,
})

describe('proficiencies', () => {
  it('takes the first class in full and a later class from what it gains', () => {
    const multi = loadedClass('Wizard', ['light'], [])
    multi.entry.multiclassing = {
      proficienciesGained: { armor: ['medium'], weapons: ['simple'] },
    }
    const c = createCharacter('Multi')
    c.classes = [
      { name: 'Fighter', source: 'PHB', level: 1 },
      { name: 'Wizard', source: 'PHB', level: 1 },
    ]
    const all = proficiencies(collectSources(c, deps([FIGHTER, multi])))
    expect(armorProficiency(all, 'heavy')?.label).toBe('Fighter')
    expect(armorProficiency(all, 'medium')?.label).toBe('Fighter')
    const wizardOnly = createCharacter('Wizard')
    wizardOnly.classes = [{ name: 'Wizard', source: 'PHB', level: 1 }]
    const w = proficiencies(collectSources(wizardOnly, deps([WIZARD])))
    expect(armorProficiency(w, 'light')).toBeUndefined()
  })

  it('knows a named weapon and a category', () => {
    const c = createCharacter('W')
    c.classes = [{ name: 'Wizard', source: 'PHB', level: 1 }]
    const all = proficiencies(collectSources(c, deps([WIZARD])))
    expect(weaponProficiency(all, held('Dagger'))).toBeDefined()
    expect(weaponProficiency(all, held('Longsword'))).toBeUndefined()
  })

  it('makes a Sun Blade proficient for a character proficient with the longsword', () => {
    const c = createCharacter('F')
    c.classes = [{ name: 'Fighter', source: 'PHB', level: 1 }]
    const sunBlade = makeItem({ name: 'Sun Blade', source: 'DMG', kind: 'weapon' })
    const heldBlade: HeldItem = {
      ...held('Sun Blade', 'Longsword'),
      item: sunBlade,
    }
    expect(
      weaponProficiency(proficiencies(collectSources(c, deps([FIGHTER]))), heldBlade),
    ).toBeDefined()
    c.classes = [{ name: 'Wizard', source: 'PHB', level: 1 }]
    expect(
      weaponProficiency(proficiencies(collectSources(c, deps([WIZARD]))), heldBlade),
    ).toBeUndefined()
  })

  describe('saving throws, tools and languages', () => {
    const background = (extra: Partial<PlayableBackground>): PlayableBackground => ({
      key: 'acolyte|phb',
      name: 'Acolyte',
      source: 'PHB',
      abilityOptions: [],
      featGrants: [],
      storyTables: [],
      entries: [],
      ...extra,
    })
    const race = (extra: Partial<PlayableRace>): PlayableRace => ({
      key: 'half-elf|phb',
      name: 'Half-Elf',
      baseName: 'Half-Elf',
      source: 'PHB',
      abilityOptions: [],
      featGrants: [],
      ...extra,
    })
    const wizardSources = () => {
      const c = createCharacter('W')
      c.classes = [{ name: 'Wizard', source: 'PHB', level: 1 }]
      return collectSources(
        c,
        deps([{ ...WIZARD, entry: { ...WIZARD.entry, proficiency: ['int', 'wis'] } }]),
      )
    }

    it('lists the first class saves with the class as the source', () => {
      const all = proficiencies(wizardSources())
      expect(all.listing.save.map((l) => l.value)).toEqual(['Intelligence', 'Wisdom'])
      expect(all.listing.save[0].sources[0].label).toBe('Wizard')
    })

    it('gives a later class no saving throws', () => {
      const multi = loadedClass('Wizard', [], [])
      multi.entry.proficiency = ['int', 'wis']
      const fighter = loadedClass('Fighter', [], [])
      fighter.entry.proficiency = ['str', 'con']
      const c = createCharacter('M')
      c.classes = [
        { name: 'Fighter', source: 'PHB', level: 1 },
        { name: 'Wizard', source: 'PHB', level: 1 },
      ]
      const all = proficiencies(collectSources(c, deps([fighter, multi])))
      expect(all.listing.save.map((l) => l.value)).toEqual(['Strength', 'Constitution'])
    })

    it('reads the tools and languages a background and a race give', () => {
      const sources = {
        ...wizardSources(),
        background: background({
          toolProficiencies: [{ "thieves' tools": true }],
          languageProficiencies: [{ anyStandard: 2 }],
        }),
        race: race({ languageProficiencies: [{ common: true, elvish: true }] }),
      }
      const all = proficiencies(sources)
      expect(all.listing.tool.map((l) => l.value)).toEqual(["Thieves' Tools"])
      expect(all.listing.language.map((l) => l.value)).toEqual(['Common', 'Elvish'])
      expect(all.open.map((o) => o.spec.count)).toEqual([2])
      expect(all.open[0].block.card.label).toBe('Background · Acolyte')
    })

    it('counts a pick against its source and charges a stranger to non-standard', () => {
      const sources = {
        ...wizardSources(),
        background: background({ languageProficiencies: [{ anyStandard: 2 }] }),
      }
      const all = proficiencies(sources, {
        picks: { language: { Dwarvish: 'bg', Sylvan: 'manual' } },
      })
      expect(all.open[0].left).toBe(1)
      const dwarvish = all.listing.language.find((l) => l.value === 'Dwarvish')
      expect(dwarvish?.sources[0].label).toBe('Acolyte')
      const sylvan = all.listing.language.find((l) => l.value === 'Sylvan')
      expect(sylvan?.sources[0].label).toBe('Non-standard (DM approval)')
    })

    it('takes the alternative the player chose', () => {
      const sources = {
        ...wizardSources(),
        background: background({
          toolProficiencies: [{ "smith's tools": true }, { "mason's tools": true }],
        }),
      }
      const id = 'bg|toolProficiencies'
      expect(proficiencies(sources).listing.tool[0].value).toBe("Smith's Tools")
      expect(proficiencies(sources, { alt: { [id]: 1 } }).listing.tool[0].value).toBe(
        "Mason's Tools",
      )
    })

    it('switches on an optional block only when the player does', () => {
      const artificer = loadedClass('Artificer', [], ['simple'])
      artificer.entry.startingProficiencies = {
        weapons: ['simple', { proficiency: 'firearms', optional: true }],
      }
      const c = createCharacter('A')
      c.classes = [{ name: 'Artificer', source: 'TCE', level: 1 }]
      artificer.entry.source = 'TCE'
      const sources = collectSources(c, deps([artificer]))
      expect(proficiencies(sources).listing.weapon.map((l) => l.value)).toEqual([
        'Simple weapons',
      ])
      const on = proficiencies(sources, {
        alt: { 'class:Artificer|TCE|weaponProficiencies|optional0': 1 },
      })
      expect(on.listing.weapon.map((l) => l.value)).toEqual([
        'Simple weapons',
        'Firearms',
      ])
    })

    it('makes the saving throw of Resilient the ability placed in the feat', () => {
      const resilient = {
        ...featOf('Resilient', 'PHB'),
        savingThrowProficiencies: [
          { choose: { from: ['str', 'dex', 'con', 'int', 'wis', 'cha'] } },
        ],
      }
      const base = wizardSources()
      const source = { kind: 'feat' as const, tag: 'feat:asi1', label: 'Resilient' }
      const withFeat = (increases?: Partial<Record<'con', number>>) => ({
        ...base,
        feats: [{ feat: resilient, source, increases }],
      })
      const chosen = proficiencies(withFeat({ con: 1 }))
      expect(chosen.listing.save.map((l) => l.value)).toContain('Constitution')
      expect(chosen.open).toEqual([])
      const unplaced = proficiencies(withFeat())
      expect(unplaced.open).toHaveLength(1)
    })
  })
})
