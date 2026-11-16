import { describe, expect, it } from 'vitest'
import type { LoadedClass } from '../data/class'
import { build, deps, loadedClass } from '../test/derivedFixtures'
import { featureSkillSources } from './featureGrants'
import { grantBlocks } from './grantBlocks'
import { collectSources } from './sources'

const subclassFeature = (
  className: string,
  shortName: string,
  name: string,
  level: number,
  source = 'XGE',
) => ({
  name,
  source,
  className,
  classSource: 'PHB',
  subclassShortName: shortName,
  subclassSource: source,
  level,
  entries: [`${name}.`],
})

const withSubclass = (
  className: string,
  shortName: string,
  level: number,
  source = 'XGE',
) => {
  const c = build(className, level, {}, [])
  c.classes[0].subclass = { name: shortName, shortName, source }
  return c
}

describe('the skills, languages and tools a feature gives in text', () => {
  it('gives a pick of three skills to a Lore bard from 3rd level', () => {
    const bard = loadedClass('Bard', [], [], {
      subclassFeature: [subclassFeature('Bard', 'Lore', 'Bonus Proficiencies', 3, 'PHB')],
    })
    const at = (level: number) =>
      featureSkillSources(
        collectSources(withSubclass('Bard', 'Lore', level, 'PHB'), deps([bard])),
      )
    expect(at(2)).toEqual([])
    expect(at(3)).toEqual([
      {
        tag: 'class:Bard|PHB|Bonus Proficiencies',
        label: 'Class - Bard, Lore Bonus Proficiencies',
        kind: 'class',
        fixed: [],
        choices: [{ count: 3, from: expect.arrayContaining(['arcana', 'stealth']) }],
      },
    ])
  })

  it("picks from the class's own skill list, once more at the level the text says", () => {
    const base = loadedClass('Barbarian', [], [], {
      classFeature: [
        {
          name: 'Primal Knowledge',
          source: 'TCE',
          className: 'Barbarian',
          classSource: 'PHB',
          level: 3,
          entries: ['Skills.'],
          isClassFeatureVariant: true,
        },
      ],
    })
    const barbarian: LoadedClass = {
      ...base,
      entry: {
        ...base.entry,
        startingProficiencies: {
          skills: [{ choose: { from: ['athletics', 'survival'], count: 2 } }],
        },
      },
    }
    const at = (level: number) => {
      const c = build('Barbarian', level, {}, [])
      c.selectedBooks = ['PHB', 'TCE']
      return featureSkillSources(collectSources(c, deps([barbarian])))
    }
    expect(at(3)[0].choices).toEqual([{ count: 1, from: ['athletics', 'survival'] }])
    expect(at(10)[0].choices).toEqual([
      { count: 1, from: ['athletics', 'survival'] },
      { count: 1, from: ['athletics', 'survival'] },
    ])
  })

  it('lets a Cavalier spend one pick on a skill of its list or on a language', () => {
    const fighter = loadedClass('Fighter', [], [], {
      subclassFeature: [subclassFeature('Fighter', 'Cavalier', 'Bonus Proficiency', 3)],
    })
    const sources = collectSources(
      withSubclass('Fighter', 'Cavalier', 3),
      deps([fighter]),
    )
    const [skills] = featureSkillSources(sources)
    expect(skills).toMatchObject({
      tag: 'class:Fighter|PHB|Bonus Proficiency',
      shares: ['language'],
      choices: [
        {
          count: 1,
          from: ['animal handling', 'history', 'insight', 'performance', 'persuasion'],
        },
      ],
    })
    const [block] = grantBlocks(sources).filter((b) => b.card.tag === skills.tag)
    expect(block.field).toBe('skillToolLanguageProficiencies')
    expect(block.read.alternatives[0].picks[0].kinds).toEqual(['skill', 'language'])
  })

  it('gives a Scout its two skills with expertise in them', () => {
    const rogue = loadedClass('Rogue', [], [], {
      subclassFeature: [subclassFeature('Rogue', 'Scout', 'Survivalist', 3)],
    })
    const sources = collectSources(withSubclass('Rogue', 'Scout', 3), deps([rogue]))
    expect(featureSkillSources(sources)[0].fixed).toEqual(['nature', 'survival'])
    const expertise = grantBlocks(sources).filter((b) => b.field === 'expertise')
    expect(expertise.map((b) => b.read.alternatives[0].fixed.map((v) => v.key))).toEqual([
      ['nature', 'survival'],
    ])
  })
})
