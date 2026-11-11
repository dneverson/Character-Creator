import { describe, expect, it } from 'vitest'
import { createCharacter, type Character } from './model'
import { nameIndex, reconcileNames } from './names'

// The full content: book names, marked with the SRD's name where that differs.
const full = nameIndex([
  { name: "Melf's Acid Arrow", source: 'PHB', srdName: 'Acid Arrow' },
  { name: 'Fireball', source: 'PHB' },
  {
    name: "Quaal's Feather Token, Anchor",
    source: 'DMG',
    srdName: 'Feather Token, Anchor',
  },
  { name: 'Longsword', source: 'PHB' },
])

// The free rules: the same entries under the SRD's names, with no mark.
const free = nameIndex([
  { name: 'Acid Arrow', source: 'PHB' },
  { name: 'Fireball', source: 'PHB' },
  { name: 'Feather Token, Anchor', source: 'DMG' },
  { name: 'Longsword', source: 'PHB' },
])

function character(mutate: (c: Character) => void): Character {
  const c = createCharacter('Mialee')
  mutate(c)
  return c
}

const builtOnFreeRules = () =>
  character((c) => {
    c.classes = [{ name: 'Wizard', source: 'PHB', level: 3 }]
    c.spells = {
      'Wizard|PHB': {
        cantrips: [],
        spells: [{ name: 'Acid Arrow', source: 'PHB', level: 2 }],
        spellbook: [
          { name: 'Acid Arrow', source: 'PHB', level: 2 },
          { name: 'Fireball', source: 'PHB', level: 3 },
        ],
      },
    }
    c.equipment.items = [
      { name: 'Feather Token, Anchor', source: 'DMG', quantity: 2 },
      { name: 'Longsword', source: 'PHB', quantity: 1 },
    ]
  })

describe('reconcileNames', () => {
  it('renames picks made on the free rules to the names the books use', () => {
    const before = builtOnFreeRules()
    const after = reconcileNames(before, full)

    expect(after.spells['Wizard|PHB'].spells).toEqual([
      { name: "Melf's Acid Arrow", source: 'PHB', srdName: 'Acid Arrow', level: 2 },
    ])
    expect(after.spells['Wizard|PHB'].spellbook).toEqual([
      { name: "Melf's Acid Arrow", source: 'PHB', srdName: 'Acid Arrow', level: 2 },
      { name: 'Fireball', source: 'PHB', level: 3 },
    ])
    expect(after.equipment.items).toEqual([
      {
        name: "Quaal's Feather Token, Anchor",
        source: 'DMG',
        srdName: 'Feather Token, Anchor',
        quantity: 2,
      },
      { name: 'Longsword', source: 'PHB', quantity: 1 },
    ])
  })

  it('leaves everything else of the character as it was, object for object', () => {
    const before = builtOnFreeRules()
    const after = reconcileNames(before, full)

    expect(after).not.toBe(before)
    expect(after.classes).toBe(before.classes)
    expect(after.abilities).toBe(before.abilities)
    expect(after.equipment.currency).toBe(before.equipment.currency)
    expect(after.equipment.items[1]).toBe(before.equipment.items[1])
    expect(after.updatedAt).toBe(before.updatedAt)
  })

  it('leaves the history as it was written, under the names of the time', () => {
    const before = builtOnFreeRules()
    const added = { name: 'Feather Token, Anchor', source: 'DMG', quantity: 2 }
    before.history.push({
      id: 'e1',
      at: 5,
      by: 'device',
      changes: [
        { path: ['equipment', 'items', 'Feather Token, Anchor|DMG'], after: added },
      ],
    })
    const after = reconcileNames(before, full)

    expect(after.equipment.items[0].name).toBe("Quaal's Feather Token, Anchor")
    expect(after.history).toBe(before.history)
    expect(after.history[1].changes[0].after).toBe(added)
  })

  it('marks a pick that goes by a book name with the name the SRD gives it', () => {
    const before = character((c) => {
      c.equipment.items = [
        { name: "Quaal's Feather Token, Anchor", source: 'DMG', quantity: 1 },
      ]
    })
    expect(reconcileNames(before, full).equipment.items).toEqual([
      {
        name: "Quaal's Feather Token, Anchor",
        source: 'DMG',
        srdName: 'Feather Token, Anchor',
        quantity: 1,
      },
    ])
  })

  it('renames a marked pick to the SRD name when the content has only that', () => {
    const built = builtOnFreeRules()
    const onFullContent = reconcileNames(built, full)
    const backOnFreeRules = reconcileNames(onFullContent, free)
    expect(backOnFreeRules).toEqual(built)
    expect(backOnFreeRules.equipment.items[0]).not.toHaveProperty('srdName')
  })

  it('returns the character itself when every pick is already named right', () => {
    const onFreeRules = builtOnFreeRules()
    expect(reconcileNames(onFreeRules, free)).toBe(onFreeRules)

    const onFullContent = reconcileNames(onFreeRules, full)
    expect(reconcileNames(onFullContent, full)).toBe(onFullContent)
  })

  it('leaves a pick the content does not know as it is', () => {
    const before = character((c) => {
      c.equipment.items = [
        // Homebrew, or a book that is not loaded.
        { name: 'Moonblade of the Vale', source: 'HOME', quantity: 1 },
        // Marked, but the content has it under neither name.
        { name: 'Lost Relic', source: 'DMG', srdName: 'Relic', quantity: 1 },
      ]
      c.wildShapes = [{ name: 'Wolf', source: 'MM' }]
    })
    expect(reconcileNames(before, full)).toBe(before)
    expect(reconcileNames(before, free)).toBe(before)
    // Nothing loaded at all: nothing to go by.
    expect(reconcileNames(before, nameIndex([]))).toBe(before)
  })

  it('drops a mark the content no longer gives the entry', () => {
    const before = character((c) => {
      c.equipment.items = [
        { name: 'Longsword', source: 'PHB', srdName: 'Blade', quantity: 1 },
      ]
    })
    const after = reconcileNames(before, full)
    expect(after.equipment.items).toEqual([
      { name: 'Longsword', source: 'PHB', quantity: 1 },
    ])
    expect(after.equipment.items[0]).not.toHaveProperty('srdName')
  })

  it('finds a pick wherever the character keeps it', () => {
    // A place no part of the model lists: the walk is by shape, not by field.
    const before = {
      ...builtOnFreeRules(),
      attuned: { slots: [{ item: { name: 'Feather Token, Anchor', source: 'DMG' } }] },
    }
    const after = reconcileNames(before, full) as typeof before
    expect(after.attuned.slots[0].item).toEqual({
      name: "Quaal's Feather Token, Anchor",
      source: 'DMG',
      srdName: 'Feather Token, Anchor',
    })
  })

  it('does not take a name without a source, or a mark that is not text, for a pick', () => {
    const before = {
      ...character(() => {}),
      // The character's own name is not a pick, even when it reads like one.
      name: 'Acid Arrow',
      odd: { name: 'Acid Arrow', source: 'PHB', srdName: 7 },
    }
    expect(reconcileNames(before, full)).toBe(before)
  })
})
