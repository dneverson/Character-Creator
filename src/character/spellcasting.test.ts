import { describe, expect, it } from 'vitest'
import { characterCasters } from './spellcasting'
import { createCharacter } from './model'
import type { LoadedClass, SubclassEntry } from '../data/class'

const eldritchKnight: SubclassEntry = {
  name: 'Eldritch Knight',
  shortName: 'Eldritch Knight',
  source: 'XPHB',
  className: 'Fighter',
  classSource: 'XPHB',
  edition: 'one',
  subclassFeatures: [],
  casterProgression: '1/3',
  spellcastingAbility: 'int',
  cantripProgression: [0, 0, 2, 2, 2, 2, 2],
  preparedSpellsProgression: [0, 0, 3, 4, 4, 4, 5],
}
const champion: SubclassEntry = {
  name: 'Champion',
  shortName: 'Champion',
  source: 'XPHB',
  className: 'Fighter',
  classSource: 'XPHB',
  edition: 'one',
  subclassFeatures: [],
}

const fighter: LoadedClass = {
  entry: { name: 'Fighter', source: 'XPHB', edition: 'one', classFeatures: [] },
  file: { subclass: [eldritchKnight, champion] },
}
const wizard: LoadedClass = {
  entry: {
    name: 'Wizard',
    source: 'XPHB',
    edition: 'one',
    classFeatures: [],
    casterProgression: 'full',
    spellcastingAbility: 'int',
    cantripProgression: [3, 3, 3],
    preparedSpellsProgression: [4, 5, 6],
  },
  file: {},
}
const classByKey = new Map([
  ['Fighter|XPHB', fighter],
  ['Wizard|XPHB', wizard],
])

function characterWith(
  classes: { name: string; level: number; subclass?: string }[],
  int = 14,
) {
  const c = createCharacter('Test')
  c.abilities = { ...c.abilities, int: { base: int, other: 0 } }
  c.classes = classes.map(({ name, level, subclass }) => ({
    name,
    source: 'XPHB',
    level,
    subclass: subclass
      ? { name: subclass, shortName: subclass, source: 'XPHB' }
      : undefined,
  }))
  return c
}

describe('characterCasters', () => {
  it('leaves out classes that do not cast', () => {
    expect(
      characterCasters(characterWith([{ name: 'Fighter', level: 5 }]), classByKey),
    ).toEqual([])
    expect(
      characterCasters(
        characterWith([{ name: 'Fighter', level: 5, subclass: 'Champion' }]),
        classByKey,
      ),
    ).toEqual([])
  })

  it('makes an Eldritch Knight a caster under the class key, with the subclass ability', () => {
    const [knight] = characterCasters(
      characterWith([{ name: 'Fighter', level: 7, subclass: 'Eldritch Knight' }], 16),
      classByKey,
    )
    expect(knight).toMatchObject({
      classKey: 'Fighter|XPHB',
      name: 'Fighter (Eldritch Knight)',
      subclassKey: 'Fighter|XPHB|Eldritch Knight',
      ability: 'int',
      cantripsKnown: 2,
      preparedMax: 5,
    })
  })

  it('keeps a plain caster beside a casting subclass, in class order', () => {
    const casters = characterCasters(
      characterWith([
        { name: 'Wizard', level: 3 },
        { name: 'Fighter', level: 3, subclass: 'Eldritch Knight' },
      ]),
      classByKey,
    )
    expect(casters.map((c) => c.classKey)).toEqual(['Wizard|XPHB', 'Fighter|XPHB'])
    expect(casters[0].preparedMax).toBe(6)
  })

  it('skips a class the data does not have', () => {
    expect(
      characterCasters(characterWith([{ name: 'Wizard', level: 3 }]), new Map()),
    ).toEqual([])
  })

  it('ignores a chosen subclass the class does not list', () => {
    const casters = characterCasters(
      characterWith([{ name: 'Fighter', level: 7, subclass: 'Battle Master' }]),
      classByKey,
    )
    expect(casters).toEqual([])
  })
})
