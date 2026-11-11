// Shared Beast fixture for tests: a complete Beast with every field defaulted,
// so each test states only what it exercises.

import type { Beast } from '../data/beasts'

export function makeBeast(overrides: Partial<Beast> & { name: string }): Beast {
  return {
    source: 'MM',
    edition: 'classic',
    size: ['M'],
    cr: '0',
    crValue: 0,
    hasCr: true,
    swarm: false,
    tags: [],
    ac: 10,
    hp: 1,
    speed: { walk: 30 },
    hasFly: false,
    hasSwim: false,
    abilities: { str: 10, dex: 10, con: 10, int: 2, wis: 10, cha: 5 },
    passive: 10,
    senses: [],
    skills: {},
    traits: [],
    actions: [],
    ...overrides,
  }
}
