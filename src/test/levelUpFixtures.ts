// Classes for the Level up tests: each level asks for something different.

import type { LoadedClass } from '../data/class'

const feature = (name: string, level: number, className = 'Knight') => ({
  name,
  source: 'PHB',
  className,
  classSource: 'PHB',
  level,
  entries: [`${name} text.`],
})

/** A class with a feature at 1, its subclass at 3 and an ability score improvement at 4. */
export const KNIGHT: LoadedClass = {
  entry: {
    name: 'Knight',
    source: 'PHB',
    hd: { number: 1, faces: 10 },
    classFeatures: [
      'Second Wind|Knight||1',
      { classFeature: 'Knightly Order|Knight||3', gainSubclassFeature: true },
      'Ability Score Improvement|Knight||4',
    ],
    multiclassing: { requirements: { str: 13 } },
    subclassTitle: 'Knightly Order',
  },
  file: {
    classFeature: [
      feature('Second Wind', 1),
      feature('Knightly Order', 3),
      feature('Ability Score Improvement', 4),
    ],
    subclass: [
      {
        name: 'Order of the Rose',
        shortName: 'Rose',
        source: 'PHB',
        className: 'Knight',
        classSource: 'PHB',
        subclassFeatures: [],
      },
    ],
  },
}

/** A known caster: one more cantrip at 4, one more spell each level. */
export const SEER: LoadedClass = {
  entry: {
    name: 'Seer',
    source: 'PHB',
    hd: { number: 1, faces: 6 },
    classFeatures: ['Sight|Seer||1'],
    spellcastingAbility: 'wis',
    casterProgression: 'full',
    cantripProgression: [2, 2, 2, 3, 3],
    spellsKnownProgression: [2, 3, 4, 5, 6],
    multiclassing: { requirements: { wis: 13 } },
  },
  file: { classFeature: [feature('Sight', 1, 'Seer')] },
}
