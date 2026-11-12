import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchData } from './dataClient'
import {
  parseSkillGrants,
  proficiencyBonus,
  skillByKey,
  skillLabel,
  SKILL_KEYS,
  loadSkillTexts,
} from './skills'

vi.mock('./dataClient', () => ({ fetchData: vi.fn() }))
vi.mock('./edition', () => ({
  loadBookEditions: async () => (source: string) =>
    source === 'XPHB' ? 'one' : 'classic',
}))
const mockFetch = vi.mocked(fetchData)

beforeEach(() => {
  loadSkillTexts.clear()
})

describe('loadSkillTexts', () => {
  it('keeps the text of each skill per rules edition', async () => {
    mockFetch.mockResolvedValue({
      skill: [
        { name: 'Stealth', source: 'PHB', entries: ['Hide.'] },
        { name: 'Stealth', source: 'XPHB', entries: ['Hide, 2024.'] },
        { name: 'Odd', source: 'PHB' },
      ],
    })
    const texts = await loadSkillTexts()
    expect(texts.get('stealth')).toEqual([
      { edition: 'classic', entries: ['Hide.'] },
      { edition: 'one', entries: ['Hide, 2024.'] },
    ])
    expect(texts.get('odd')).toEqual([{ edition: 'classic', entries: [] }])
  })
})

describe('parseSkillGrants', () => {
  it('returns empty grants for undefined or non-object blocks', () => {
    expect(parseSkillGrants(undefined)).toEqual({ fixed: [], choices: [] })
    expect(parseSkillGrants([null, 'x', 5] as unknown[])).toEqual({
      fixed: [],
      choices: [],
    })
  })

  it('collects fixed skills and de-duplicates them', () => {
    const { fixed, choices } = parseSkillGrants([
      { stealth: true, perception: true },
      { stealth: true }, // duplicate ignored
      { deception: false }, // not proficient -> skipped
    ])
    expect(fixed.sort()).toEqual(['perception', 'stealth'])
    expect(choices).toEqual([])
  })

  it('normalizes a choose grant and filters non-skill options', () => {
    const { choices } = parseSkillGrants([
      { choose: { from: ['arcana', 'notASkill', 'history'], count: 2 } },
    ])
    expect(choices).toEqual([{ count: 2, from: ['arcana', 'history'] }])
  })

  it('defaults choose count to 1 when omitted', () => {
    const { choices } = parseSkillGrants([{ choose: { from: ['nature'] } }])
    expect(choices).toEqual([{ count: 1, from: ['nature'] }])
  })

  it('expands an "any N" grant to all skills', () => {
    const { choices } = parseSkillGrants([{ any: 3 }])
    expect(choices).toHaveLength(1)
    expect(choices[0].count).toBe(3)
    expect(choices[0].from).toEqual(SKILL_KEYS)
  })
})

describe('proficiencyBonus', () => {
  it('follows the RAW progression and extends past level 20', () => {
    expect(proficiencyBonus(1)).toBe(2)
    expect(proficiencyBonus(4)).toBe(2)
    expect(proficiencyBonus(5)).toBe(3)
    expect(proficiencyBonus(17)).toBe(6)
    expect(proficiencyBonus(21)).toBe(7)
    expect(proficiencyBonus(0)).toBe(2) // clamped to level 1
  })
})

describe('skillByKey', () => {
  it('looks up a known skill and returns undefined otherwise', () => {
    expect(skillByKey('stealth')).toMatchObject({ label: 'Stealth', ability: 'dex' })
    expect(skillByKey('imaginary')).toBeUndefined()
  })
})

describe('skillLabel', () => {
  it('uses the known label or title-cases an unknown key', () => {
    expect(skillLabel('animal handling')).toBe('Animal Handling')
    expect(skillLabel('made up skill')).toBe('Made Up Skill')
  })
})
