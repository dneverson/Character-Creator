// Shared Item fixture for tests: a complete Item with every field defaulted, so
// each test states only what it exercises.

import type { Item } from '../data/items'

export function makeItem(overrides: Partial<Item> & { name: string }): Item {
  const source = overrides.source ?? 'PHB'
  return {
    key: `${overrides.name}|${source}`,
    source,
    edition: 'classic',
    kind: 'gear',
    magic: false,
    bonuses: [],
    spells: [],
    traits: [],
    details: [],
    groups: [],
    family: [],
    free: false,
    entries: [],
    ...overrides,
  }
}
