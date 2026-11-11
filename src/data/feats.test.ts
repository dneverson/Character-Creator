import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchData } from './dataClient'
import {
  ASI_OPTIONS,
  expandVersions,
  featCategoryDescription,
  featCategoryLabel,
  featGrantLabel,
  featKey,
  featRefText,
  featsFromEntries,
  loadFeats,
  parseFeatGrants,
  prerequisiteText,
  UNCATEGORIZED_DESCRIPTION,
  UNCATEGORIZED_LABEL,
  type FeatEntry,
} from './feats'
import { SKILL_KEYS } from './skills'
import { ABILITIES } from '../dice/dice'
import { parseAbilityOptions } from './abilityOptions'

vi.mock('./dataClient', () => ({ fetchData: vi.fn() }))
const mockFetch = vi.mocked(fetchData)

// Mirrors the real Magic Initiate (XPHB) shape: one version per spell list.
const magicInitiate: FeatEntry = {
  name: 'Magic Initiate',
  source: 'XPHB',
  category: 'O',
  repeatable: true,
  entries: ['You learn two cantrips of your choice from the {{class}} spell list.'],
  _versions: [
    { name: 'Magic Initiate; Cleric', _mod: {} },
    { name: 'Magic Initiate; Wizard', _mod: {} },
  ],
}

// Mirrors the real Strike of the Giants (BGG) shape: versions swap an entry by
// index and remove the other strikes by name.
const strike: FeatEntry = {
  name: 'Strike of the Giants',
  source: 'BGG',
  prerequisite: [{ level: 4 }],
  entries: [
    'Intro',
    { type: 'entries', name: 'Fire Strike' },
    { type: 'entries', name: 'Frost Strike' },
  ],
  _versions: [
    {
      name: 'Strike of the Giants; Fire Strike',
      _mod: {
        entries: [
          { mode: 'replaceArr', replace: { index: 0 }, items: 'Fire intro' },
          { mode: 'removeArr', names: 'Frost Strike' },
        ],
      },
    },
  ],
}

// Mirrors the real Tough (XPHB): no ability increase, +2 HP per level.
const tough: FeatEntry = { name: 'Tough', source: 'XPHB', category: 'O' }

// Mirrors the real Boon of Fortitude (XPHB): +1 any to 30, +40 HP.
const fortitude: FeatEntry = {
  name: 'Boon of Fortitude',
  source: 'XPHB',
  category: 'EB',
  prerequisite: [{ level: 19 }],
  ability: [{ choose: { from: ['str', 'dex', 'con', 'int', 'wis', 'cha'] }, max: 30 }],
}

// Mirrors the real Resilient (PHB): choice with a printed restriction.
const resilient: FeatEntry = {
  name: 'Resilient',
  source: 'PHB',
  ability: [
    {
      choose: {
        from: ['str', 'dex', 'con', 'int', 'wis', 'cha'],
        amount: 1,
        entry: 'Increase an ability you are not proficient in saving throws with.',
      },
    },
  ],
}

// A feat offering alternative fixed increases, like Athlete's hidden options.
const alternatives: FeatEntry = {
  name: 'Alternatives',
  source: 'TST',
  ability: [{ str: 1 }, { dex: 1, hidden: true }],
}

// Mirrors the real Skilled (XPHB): three skills or tools, any combination.
const skilled: FeatEntry = {
  name: 'Skilled',
  source: 'XPHB',
  category: 'O',
  repeatable: true,
  skillToolLanguageProficiencies: [
    { choose: [{ from: ['anySkill', 'anyTool'], count: 3 }] },
  ],
}

// A feat with fixed skills and armor/weapon proficiencies.
const proficient: FeatEntry = {
  name: 'Proficient',
  source: 'TST',
  skillProficiencies: [{ athletics: true }],
  armorProficiencies: [{ medium: true }],
  weaponProficiencies: [{ martial: true }],
}

function byLabel(entries: FeatEntry[]) {
  return new Map(featsFromEntries(entries).map((f) => [f.label, f]))
}

describe('expandVersions', () => {
  it('returns a feat without versions unchanged', () => {
    expect(expandVersions(tough)).toEqual([tough])
  })

  it('makes each version a standalone feat, inheriting the base', () => {
    const [cleric, wizard] = expandVersions(magicInitiate)
    expect(cleric.name).toBe('Magic Initiate; Cleric')
    expect(cleric.source).toBe('XPHB')
    expect(cleric.category).toBe('O')
    expect(cleric.repeatable).toBe(true)
    expect(cleric._versions).toBeUndefined()
    expect(cleric._copy).toBeUndefined()
    expect(wizard.name).toBe('Magic Initiate; Wizard')
  })

  it("applies a version's index replace and name removal", () => {
    const [fire] = expandVersions(strike)
    expect(fire.entries).toEqual(['Fire intro', { type: 'entries', name: 'Fire Strike' }])
    expect(fire.prerequisite).toEqual([{ level: 4 }])
  })
})

describe('featsFromEntries', () => {
  it('labels versions with parentheses and keeps the base name', () => {
    const feats = byLabel([magicInitiate, strike])
    const cleric = feats.get('Magic Initiate (Cleric)')
    expect(cleric?.baseName).toBe('Magic Initiate')
    expect(cleric?.key).toBe('magic initiate; cleric|xphb')
    expect(feats.get('Strike of the Giants (Fire Strike)')?.baseName).toBe(
      'Strike of the Giants',
    )
  })

  it('sorts by label', () => {
    const labels = featsFromEntries([tough, magicInitiate, fortitude]).map((f) => f.label)
    expect(labels).toEqual([
      'Boon of Fortitude',
      'Magic Initiate (Cleric)',
      'Magic Initiate (Wizard)',
      'Tough',
    ])
  })

  it('defaults empty grants, prerequisites and entries', () => {
    const [feat] = featsFromEntries([tough])
    expect(feat.edition).toBe('one')
    expect(feat.prerequisites).toEqual([])
    expect(feat.abilityOptions).toEqual([])
    expect(feat.repeatable).toBe(false)
    expect(feat.skills).toEqual({ fixed: [], choices: [] })
    expect(feat.armorProficiencies).toEqual([])
    expect(feat.weaponProficiencies).toEqual([])
    expect(feat.entries).toEqual([])
  })

  it('parses a choice with a cap, defaulting count and amount to 1', () => {
    const [feat] = featsFromEntries([fortitude])
    expect(feat.abilityOptions).toEqual([
      { fixed: {}, amounts: [1], from: [...ABILITIES], max: 30 },
    ])
  })

  it('keeps a printed restriction on a choice as a note', () => {
    const [feat] = featsFromEntries([resilient])
    expect(feat.abilityOptions[0].max).toBeUndefined()
    expect(feat.abilityOptions[0].note).toBe(
      'Increase an ability you are not proficient in saving throws with.',
    )
  })

  it('keeps each alternative fixed increase as its own option', () => {
    const [feat] = featsFromEntries([alternatives])
    expect(feat.abilityOptions).toEqual([
      { fixed: { str: 1 }, amounts: [], from: [] },
      { fixed: { dex: 1 }, amounts: [], from: [] },
    ])
  })

  it('ignores unknown abilities in a choice and non-object ability blocks', () => {
    const odd: FeatEntry = {
      name: 'Odd',
      source: 'TST',
      ability: [null, 'str', { choose: { from: ['str', 'luck'] } }],
    }
    const [feat] = featsFromEntries([odd])
    expect(feat.abilityOptions).toEqual([{ fixed: {}, amounts: [1], from: ['str'] }])
  })

  it('counts Skilled as a choice of three from every skill', () => {
    const [feat] = featsFromEntries([skilled])
    expect(feat.skills).toEqual({ fixed: [], choices: [{ count: 3, from: SKILL_KEYS }] })
  })

  it('passes through fixed skills and armor/weapon proficiencies', () => {
    const [feat] = featsFromEntries([proficient])
    expect(feat.skills.fixed).toEqual(['athletics'])
    expect(feat.armorProficiencies).toEqual([{ medium: true }])
    expect(feat.weaponProficiencies).toEqual([{ martial: true }])
  })

  it('carries the other grants as the data has them, and only when present', () => {
    const resistant: FeatEntry = {
      name: 'Resistant',
      source: 'TST',
      resist: ['fire'],
      senses: [{ darkvision: 60 }],
      additionalSpells: [{ innate: {} }],
      expertise: [{ anyProficientSkill: 1 }],
    }
    const [feat] = featsFromEntries([resistant])
    expect(feat).toMatchObject({
      resist: ['fire'],
      senses: [{ darkvision: 60 }],
      additionalSpells: [{ innate: {} }],
      expertise: [{ anyProficientSkill: 1 }],
    })
    const [plain] = featsFromEntries([tough])
    expect(plain).not.toHaveProperty('resist')
    expect(plain.languageProficiencies).toEqual([])
  })

  it('derives the edition from the category and reads Elemental Adept as repeatable', () => {
    const feats = byLabel([
      tough,
      { name: 'Grappler', source: 'PHB' },
      { name: 'Elemental Adept', source: 'PHB' },
    ])
    expect(feats.get('Tough')?.edition).toBe('one')
    expect(feats.get('Grappler')?.edition).toBe('classic')
    expect(feats.get('Elemental Adept')?.repeatable).toBe(true)
    expect(feats.get('Grappler')?.repeatable).toBe(false)
  })

  it('mirrors the 2024 Ability Score Improvement blocks', () => {
    expect(ASI_OPTIONS).toEqual(
      parseAbilityOptions([
        { choose: { from: [...ABILITIES], amount: 2 }, hidden: true },
        { choose: { from: [...ABILITIES], count: 2 }, hidden: true },
      ]),
    )
    expect(ASI_OPTIONS.map((o) => o.amounts)).toEqual([[2], [1, 1]])
  })

  it('sets hit-point increases only for Tough and Boon of Fortitude', () => {
    const feats = byLabel([tough, fortitude, resilient])
    expect(feats.get('Tough')?.hp).toEqual({ perLevel: 2, flat: 0 })
    expect(feats.get('Boon of Fortitude')?.hp).toEqual({ perLevel: 0, flat: 40 })
    expect(feats.get('Resilient')?.hp).toEqual({ perLevel: 0, flat: 0 })
  })
})

describe('loadFeats', () => {
  beforeEach(() => mockFetch.mockReset())

  it('resolves _copy, expands versions and sorts', async () => {
    const copied: FeatEntry = {
      name: 'Tough Copy',
      source: 'TST',
      _copy: { name: 'Tough', source: 'XPHB' },
    }
    mockFetch.mockResolvedValueOnce({ feat: [copied, magicInitiate, tough] })
    const feats = await loadFeats()
    expect(mockFetch).toHaveBeenCalledWith('feats.json')
    expect(feats.map((f) => f.label)).toEqual([
      'Magic Initiate (Cleric)',
      'Magic Initiate (Wizard)',
      'Tough',
      'Tough Copy',
    ])
    expect(feats.find((f) => f.label === 'Tough Copy')?.category).toBe('O')
  })
})

describe('feat categories', () => {
  it('decodes known codes in full', () => {
    expect(featCategoryLabel('O')).toBe('Origin')
    expect(featCategoryLabel('FS:P')).toBe('Fighting Style Replacement (Paladin)')
    expect(featCategoryDescription('EB')).toMatch(/Level 19/)
  })

  it('labels 2014 feats as uncategorized', () => {
    expect(featCategoryLabel(undefined)).toBe(UNCATEGORIZED_LABEL)
    expect(featCategoryDescription(undefined)).toBe(UNCATEGORIZED_DESCRIPTION)
  })

  it('falls back to the raw code for an unknown category', () => {
    expect(featCategoryLabel('ZZ')).toBe('ZZ')
    expect(featCategoryDescription('ZZ')).toBe('')
  })
})

describe('featKey and featRefText', () => {
  it('lowercases the key', () => {
    expect(featKey('Tough', 'XPHB')).toBe('tough|xphb')
  })

  it('prefers the display part and title-cases minor words correctly', () => {
    expect(
      featRefText('strike of the giants|BGG|strike of the giants (fire strike)'),
    ).toBe('Strike of the Giants (Fire Strike)')
    expect(featRefText('grappler|phb')).toBe('Grappler')
  })
})

describe('prerequisiteText', () => {
  it('is empty without prerequisites', () => {
    expect(prerequisiteText([])).toBe('')
    expect(prerequisiteText([{}])).toBe('')
  })

  it('joins parts with commas and alternatives with "; or"', () => {
    expect(
      prerequisiteText([
        { level: 4, ability: [{ str: 13 }] },
        { level: 4, ability: [{ dex: 13 }] },
      ]),
    ).toBe('Level 4, Strength 13 or higher; or Level 4, Dexterity 13 or higher')
  })

  it('describes class levels', () => {
    expect(prerequisiteText([{ level: { level: 5, class: { name: 'Fighter' } } }])).toBe(
      'Fighter level 5',
    )
  })

  it('shares a common minimum score, else lists each', () => {
    expect(prerequisiteText([{ ability: [{ str: 13 }, { dex: 13 }] }])).toBe(
      'Strength or Dexterity 13 or higher',
    )
    expect(prerequisiteText([{ ability: [{ int: 13 }, { wis: 15 }] }])).toBe(
      'Intelligence 13 or Wisdom 15 or higher',
    )
  })

  it('describes races, backgrounds, features and feats', () => {
    expect(
      prerequisiteText([
        {
          race: [
            { name: 'elf' },
            { name: 'elf', subrace: 'high' },
            { name: 'dwarf', displayEntry: '{@race Dwarf|PHB}' },
          ],
        },
      ]),
    ).toBe('Elf or Elf (High) or Dwarf')
    expect(
      prerequisiteText([
        {
          background: [
            { name: 'Sage' },
            { name: 'x', displayEntry: '{@background Noble}' },
          ],
        },
      ]),
    ).toBe('Sage or Noble background')
    expect(prerequisiteText([{ feature: ['Fighting Style', 'Pact Boon'] }])).toBe(
      'Fighting Style or Pact Boon feature',
    )
    expect(prerequisiteText([{ feat: ['initiate of high sorcery|dsotdq'] }])).toBe(
      'Initiate of High Sorcery feat',
    )
  })

  it('describes feat categories and exclusive categories', () => {
    expect(prerequisiteText([{ featCategory: ['FS'] }])).toBe('Fighting Style feat')
    expect(prerequisiteText([{ exclusiveFeatCategory: ['D'] }])).toBe(
      'No other Dragonmark feat',
    )
  })

  it('describes each spellcasting flavor', () => {
    expect(prerequisiteText([{ spellcasting: true }])).toBe(
      'The ability to cast at least one spell',
    )
    expect(prerequisiteText([{ spellcasting2020: true }])).toBe(
      'Spellcasting or Pact Magic feature',
    )
    expect(prerequisiteText([{ spellcastingFeature: true }])).toBe('Spellcasting feature')
  })

  it('describes armor, shield and weapon proficiencies', () => {
    expect(
      prerequisiteText([
        {
          proficiency: [
            { armor: 'medium' },
            { armor: 'shield' },
            { weapon: 'martial' },
            { weaponGroup: 'firearms' },
          ],
        },
      ]),
    ).toBe(
      'Proficiency with medium armor or shields or martial weapons or firearms weapons',
    )
  })

  it('names the tools of a tool proficiency, not "undefined weapons"', () => {
    expect(
      prerequisiteText([
        {
          level: 4,
          proficiency: [
            { tool: ["calligrapher's supplies"] },
            { tool: ["painter's supplies"] },
          ],
        },
      ]),
    ).toBe("Level 4, Proficiency with Calligrapher's Supplies or Painter's Supplies")
  })

  it('passes through campaign and free-text prerequisites', () => {
    expect(
      prerequisiteText([
        {
          campaign: ['Dragonlance'],
          other: 'Membership in a guild',
          otherSummary: { entry: 'A special gift' },
        },
      ]),
    ).toBe('Dragonlance campaign, Membership in a guild, A special gift')
  })
})

describe('parseFeatGrants', () => {
  it('reads named feats, any-feat counts, and category grants', () => {
    expect(parseFeatGrants([{ 'Alert|XPHB': true }])).toEqual([
      { named: ['alert|xphb'], categories: [] },
    ])
    expect(parseFeatGrants([{ any: 2 }])).toEqual([
      { named: [], categories: 'any' },
      { named: [], categories: 'any' },
    ])
    expect(parseFeatGrants([{ anyFromCategory: { category: ['O'], count: 2 } }])).toEqual(
      [
        { named: [], categories: ['O'] },
        { named: [], categories: ['O'] },
      ],
    )
    expect(parseFeatGrants([{ anyFromCategory: { category: ['DG', 7] } }])).toEqual([
      { named: [], categories: ['DG'] },
    ])
  })

  it('defaults malformed counts and categories and skips unknown keys', () => {
    expect(
      parseFeatGrants([
        { any: true, anyFromCategory: { category: 'O' }, note: true, 'x|y': false },
      ]),
    ).toEqual([
      { named: [], categories: 'any' },
      { named: [], categories: [] },
    ])
  })

  it('merges alternatives into one grant offering all of them', () => {
    expect(
      parseFeatGrants([
        { 'lucky|phb': true },
        { 'magic initiate|phb': true },
        { 'lucky|phb': true },
        { anyFromCategory: { category: ['DG'] } },
        { anyFromCategory: { category: ['DG', 'O'] } },
      ]),
    ).toEqual([{ named: ['lucky|phb', 'magic initiate|phb'], categories: ['DG', 'O'] }])
    expect(parseFeatGrants([{ 'tough|phb': true }, { any: 1 }])).toEqual([
      { named: ['tough|phb'], categories: 'any' },
    ])
  })

  it('ignores non-object blocks and a missing list', () => {
    expect(parseFeatGrants(['alert', null, 3])).toEqual([])
    expect(parseFeatGrants(undefined)).toEqual([])
  })
})

describe('featGrantLabel', () => {
  it('names the feats a grant gives, and the alternatives between them', () => {
    expect(featGrantLabel([{ named: ['tough|phb'], categories: [] }])).toBe('Tough')
    expect(
      featGrantLabel([{ named: ['lucky|phb', 'magic initiate|phb'], categories: [] }]),
    ).toBe('Lucky or Magic Initiate')
    expect(featGrantLabel([{ named: ['tough|phb'], categories: 'any' }])).toBe(
      'Tough or 1 feat of your choice',
    )
  })

  it('counts free choices of the same kind together', () => {
    expect(
      featGrantLabel([
        { named: [], categories: 'any' },
        { named: [], categories: 'any' },
        { named: [], categories: ['O'] },
        { named: [], categories: ['DG', 'O'] },
      ]),
    ).toBe(
      '2 feats of your choice, 1 Origin feat of your choice, 1 Dark Gift or Origin feat of your choice',
    )
  })

  it('is empty when nothing is granted', () => {
    expect(featGrantLabel([])).toBe('')
    expect(featGrantLabel([{ named: [], categories: [] }])).toBe('')
  })
})
