// Shared Feat fixture for tests: a complete Feat with every field defaulted,
// so each test states only what it exercises.

import { featKey, type Feat } from '../data/feats'

export function makeFeat(overrides: Partial<Feat> & { name: string }): Feat {
  const source = overrides.source ?? 'XPHB'
  return {
    key: featKey(overrides.name, source),
    label: overrides.name,
    baseName: overrides.name,
    source,
    edition: 'classic',
    prerequisites: [],
    abilityOptions: [],
    repeatable: false,
    skills: { fixed: [], choices: [] },
    hp: { perLevel: 0, flat: 0 },
    entries: [],
    ...overrides,
  }
}
