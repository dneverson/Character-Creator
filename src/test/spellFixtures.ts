// Shared Spell fixture for tests: a complete Spell with every field defaulted,
// so each test states only what it exercises.

import type { Spell, SpellLists } from '../data/spells'

/** The lists a spell is on, from class keys ("Wizard|PHB"). */
export const listsOf = (...classes: string[]): SpellLists => ({
  classes,
  variants: {},
  subclasses: [],
})

export function makeSpell(overrides: Partial<Spell> & { name: string }): Spell {
  const source = overrides.source ?? 'PHB'
  return {
    key: `${overrides.name}|${source}`.toLowerCase(),
    source,
    aliases: [],
    edition: 'classic',
    level: 1,
    school: 'V',
    ritual: false,
    concentration: false,
    casting: '1 action',
    castingUnit: 'Action',
    castingMinutes: 0,
    range: '60 ft.',
    rangeFeet: 60,
    components: { v: true, s: true, m: false, royalty: false },
    duration: 'Instantaneous',
    durationKind: 'Instantaneous',
    damage: '',
    damageAverage: 0,
    damageTypes: [],
    healing: '',
    save: [],
    attack: '',
    conditions: [],
    creatureTypes: [],
    area: '',
    tags: [],
    upcast: '',
    cantripScaling: '',
    entries: [],
    lists: listsOf(),
    ...overrides,
  }
}
