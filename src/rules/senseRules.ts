// The senses that something the character holds gives and the data states in text only.
// The senses of a species and of a feat are data and are read from it. A row names its
// holder, so the audit in speedRules.test.ts can tell a sense covered here from one a book
// added.

import type { Holder } from './holder'

export interface SenseRule {
  holder: Holder
  label: string
  text: string
  /** The sense: a seeing rule of its own ("devil's sight") is a sense of the sheet too. */
  sense: 'darkvision' | 'blindsight' | 'truesight' | 'tremorsense' | "devil's sight"
  range: number
  /**
   * When the character already has the sense, its range grows by this many feet instead
   * (Umbral Sight). `fromRace`: only a species' sense counts as already had.
   */
  increase?: { range: number; fromRace?: boolean }
}

const classFeature = (className: string, source: string, name: string): Holder => ({
  classFeature: { className, source, name },
})

const subclassFeature = (
  className: string,
  shortName: string,
  source: string,
  name: string,
): Holder => ({ subclassFeature: { className, shortName, source, name } })

export const SENSE_RULES: readonly SenseRule[] = [
  {
    holder: { option: 'Blind Fighting|TCE' },
    label: 'Blind Fighting',
    text: 'Blind Fighting: you have blindsight with a range of 10 feet.',
    sense: 'blindsight',
    range: 10,
  },
  ...(['PHB', 'XPHB'] as const).map((source): SenseRule => ({
    holder: { option: `Devil's Sight|${source}` },
    label: "Devil's Sight",
    text: "Devil's Sight: you can see normally in darkness, both magical and nonmagical, to a distance of 120 feet.",
    sense: "devil's sight",
    range: 120,
  })),
  {
    holder: { option: 'Witch Sight|XPHB' },
    label: 'Witch Sight',
    text: 'Witch Sight: you have truesight with a range of 30 feet.',
    sense: 'truesight',
    range: 30,
  },
  {
    holder: { option: 'Stone Rune|TCE' },
    label: 'Stone Rune',
    text: 'Stone Rune: while wearing or carrying an object inscribed with this rune, you have darkvision out to a range of 120 feet.',
    sense: 'darkvision',
    range: 120,
  },
  {
    holder: classFeature('Ranger', 'XPHB', 'Feral Senses'),
    label: 'Feral Senses',
    text: 'Feral Senses: you have blindsight with a range of 30 feet.',
    sense: 'blindsight',
    range: 30,
  },
  {
    holder: classFeature('Demon Hunter', 'WoW', 'Improved Spectral Sight'),
    label: 'Improved Spectral Sight',
    text: 'Improved Spectral Sight: you have truesight with a range of 30 feet.',
    sense: 'truesight',
    range: 30,
  },
  {
    holder: subclassFeature('Demon Hunter', 'Demon Hunter', 'WoW', 'Spectral Sight'),
    label: 'Spectral Sight',
    text: 'Spectral Sight: you have blindsight with a range of 10 feet.',
    sense: 'blindsight',
    range: 10,
  },
  {
    holder: subclassFeature('Cleric', 'Twilight', 'TCE', 'Eyes of Night'),
    label: 'Eyes of Night',
    text: 'Eyes of Night: you have darkvision out to a range of 300 feet.',
    sense: 'darkvision',
    range: 300,
  },
  {
    holder: subclassFeature('Monk', 'Ascendant Dragon', 'FTD', 'Ascendant Aspect'),
    label: 'Ascendant Aspect',
    text: 'Ascendant Aspect: you gain blindsight out to 10 feet.',
    sense: 'blindsight',
    range: 10,
  },
  {
    holder: subclassFeature('Monk', 'Shadow', 'XPHB', 'Darkvision'),
    label: 'Darkvision (Warrior of Shadow)',
    text: 'Darkvision (Warrior of Shadow): you gain darkvision with a range of 60 feet. If you already have darkvision, its range increases by 60 feet.',
    sense: 'darkvision',
    range: 60,
    increase: { range: 60 },
  },
  {
    holder: subclassFeature('Ranger', 'Gloom Stalker', 'XGE', 'Umbral Sight'),
    label: 'Umbral Sight',
    text: 'Umbral Sight: you gain darkvision out to a range of 60 feet. If you already have darkvision from your race, its range increases by 30 feet.',
    sense: 'darkvision',
    range: 60,
    increase: { range: 30, fromRace: true },
  },
  {
    holder: subclassFeature('Ranger', 'Gloom Stalker', 'XPHB', 'Umbral Sight'),
    label: 'Umbral Sight',
    text: 'Umbral Sight: you gain darkvision with a range of 60 feet. If you already have darkvision when you gain this feature, its range increases by 60 feet.',
    sense: 'darkvision',
    range: 60,
    increase: { range: 60 },
  },
  {
    holder: subclassFeature('Sorcerer', 'Shadow', 'XGE', 'Eyes of the Dark'),
    label: 'Eyes of the Dark',
    text: 'Eyes of the Dark: you have darkvision with a range of 120 feet.',
    sense: 'darkvision',
    range: 120,
  },
  ...(['darkvision', 'blindsight'] as const).map((sense): SenseRule => ({
    holder: subclassFeature('Sorcerer', 'Shadow', 'RHW', 'Power of Shadow'),
    label: 'Power of Shadow',
    text: 'Power of Shadow: you have darkvision with a range of 120 feet and blindsight with a range of 10 feet.',
    sense,
    range: sense === 'darkvision' ? 120 : 10,
  })),
]
