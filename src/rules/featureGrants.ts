// The skills, languages and tools that a class or subclass feature gives in its text only,
// most of them a choice of the player (a Lore bard's three skills, a ranger's languages of
// favored enemies). The data lists these for species, backgrounds and feats; for features
// the books only write them in words, so each is a row here, written as the data would
// write it, and read by the same reader as every other grant: its picks are cards like
// the others, and what it gives is on the sheet. Fixed armor, weapons, tools and
// languages a feature gives are in proficiencyGrants.ts. The audit in
// featureGrants.test.ts fails when a book adds such a feature that is neither here nor
// excused with its reason.

import type { Holder } from './holder'

export interface FeatureGrant {
  holder: Holder
  /**
   * The name of the card its picks are on. The rows of a feature and of its improvements
   * share one (a ranger's Favored Enemy languages at 1st, 6th and 14th level).
   */
  card: string
  /** The class level it arrives at, when it is later than the feature's own. */
  level?: number
  /**
   * A feature it goes with: an improvement shared by two features gives this grant only
   * while the one it improves is had (no enemy's language once Favored Enemy is given up).
   */
  needs?: Holder
  /** The rule in plain words. */
  text: string
  skillProficiencies?: unknown[]
  languageProficiencies?: unknown[]
  toolProficiencies?: unknown[]
  /** A skill or a language (or tool) from one budget, as the data writes Skilled. */
  skillToolLanguageProficiencies?: unknown[]
  expertise?: unknown[]
  /** Skills of the holder's class list at 1st level: how many, and skills added to it. */
  classSkills?: { count: number; plus?: string[] }
}

const classFeature = (className: string, source: string, name: string): Holder => ({
  classFeature: { className, source, name },
})

const subclass = (
  className: string,
  shortName: string,
  source: string,
  name: string,
): Holder => ({ subclassFeature: { className, shortName, source, name } })

const FAVORED_ENEMY = classFeature('Ranger', 'PHB', 'Favored Enemy')

const choose = (count: number, ...from: string[]) => [{ choose: { from, count } }]
const anyLanguage = (count: number) => [{ any: count }]
const fixed = (...keys: string[]) => [Object.fromEntries(keys.map((k) => [k, true]))]
/** One pick that is a skill of a list or a language: the language half's block. */
const SKILL_OR_LANGUAGE = [{ choose: { from: ['anySkill', 'anyLanguage'], count: 1 } }]

export const FEATURE_GRANTS: readonly FeatureGrant[] = [
  // ---- Barbarian ----------------------------------------------------------------------
  {
    holder: classFeature('Barbarian', 'TCE', 'Primal Knowledge'),
    card: 'Primal Knowledge',
    text: 'Primal Knowledge: a skill of the barbarian list at 3rd level.',
    classSkills: { count: 1 },
  },
  {
    holder: classFeature('Barbarian', 'TCE', 'Primal Knowledge'),
    card: 'Primal Knowledge',
    level: 10,
    text: 'Primal Knowledge: another skill of the barbarian list at 10th level.',
    classSkills: { count: 1 },
  },
  {
    holder: classFeature('Barbarian', 'XPHB', 'Primal Knowledge'),
    card: 'Primal Knowledge',
    text: 'Primal Knowledge: another skill of the barbarian list.',
    classSkills: { count: 1 },
  },
  {
    holder: subclass('Barbarian', 'Totem Warrior', 'SCAG', 'Tiger'),
    card: 'Tiger',
    text: 'Tiger: two of Athletics, Acrobatics, Stealth and Survival.',
    skillProficiencies: choose(2, 'athletics', 'acrobatics', 'stealth', 'survival'),
  },
  // ---- Bard ---------------------------------------------------------------------------
  ...(['PHB', 'XPHB'] as const).map((source): FeatureGrant => ({
    holder: subclass('Bard', 'Lore', source, 'Bonus Proficiencies'),
    card: 'Bonus Proficiencies',
    text: 'College of Lore: three skills of your choice.',
    skillProficiencies: [{ any: 3 }],
  })),
  {
    holder: subclass('Bard', 'Moon', 'FRHoF', 'Primal Lore'),
    card: 'Primal Lore',
    text: 'College of the Moon: one of Animal Handling, Insight, Medicine, Nature, Perception or Survival.',
    skillProficiencies: choose(
      1,
      'animal handling',
      'insight',
      'medicine',
      'nature',
      'perception',
      'survival',
    ),
  },
  // ---- Cleric -------------------------------------------------------------------------
  {
    holder: subclass('Cleric', 'Knowledge', 'PHB', 'Blessings of Knowledge'),
    card: 'Blessings of Knowledge',
    text: 'Knowledge Domain: two languages, and two of Arcana, History, Nature and Religion.',
    languageProficiencies: anyLanguage(2),
    skillProficiencies: choose(2, 'arcana', 'history', 'nature', 'religion'),
  },
  {
    holder: subclass('Cleric', 'Knowledge', 'FRHoF', 'Blessings of Knowledge'),
    card: 'Blessings of Knowledge',
    text: "Knowledge Domain: a set of artisan's tools, and two of Arcana, History, Nature and Religion.",
    toolProficiencies: [{ anyArtisansTool: 1 }],
    skillProficiencies: choose(2, 'arcana', 'history', 'nature', 'religion'),
  },
  {
    holder: subclass('Cleric', 'Nature', 'PHB', 'Acolyte of Nature'),
    card: 'Acolyte of Nature',
    text: 'Nature Domain: one of Animal Handling, Nature and Survival.',
    skillProficiencies: choose(1, 'animal handling', 'nature', 'survival'),
  },
  {
    holder: subclass('Cleric', 'Strength (PSA)', 'PSA', 'Acolyte of Strength'),
    card: 'Acolyte of Strength',
    text: 'Strength Domain: one of Animal Handling, Athletics, Nature and Survival.',
    skillProficiencies: choose(1, 'animal handling', 'athletics', 'nature', 'survival'),
  },
  {
    holder: subclass('Cleric', 'Arcana', 'SCAG', 'Arcane Initiate'),
    card: 'Arcane Initiate',
    text: 'Arcana Domain: proficiency in Arcana.',
    skillProficiencies: fixed('arcana'),
  },
  {
    holder: subclass('Cleric', 'Arcana', 'AU', 'Student of Arcana'),
    card: 'Student of Arcana',
    text: 'Arcana Domain: Arcana, or a skill of the cleric list.',
    classSkills: { count: 1, plus: ['arcana'] },
  },
  {
    holder: subclass('Cleric', 'Order', 'TCE', 'Bonus Proficiencies'),
    card: 'Bonus Proficiencies',
    text: 'Order Domain: Intimidation or Persuasion.',
    skillProficiencies: choose(1, 'intimidation', 'persuasion'),
  },
  {
    holder: subclass('Cleric', 'Peace', 'TCE', 'Implement of Peace'),
    card: 'Implement of Peace',
    text: 'Peace Domain: Insight, Performance or Persuasion.',
    skillProficiencies: choose(1, 'insight', 'performance', 'persuasion'),
  },
  // ---- Fighter ------------------------------------------------------------------------
  {
    holder: subclass('Fighter', 'Battle Master', 'PHB', 'Student of War'),
    card: 'Student of War',
    text: "Battle Master: a set of artisan's tools.",
    toolProficiencies: [{ anyArtisansTool: 1 }],
  },
  {
    holder: subclass('Fighter', 'Battle Master', 'XPHB', 'Student of War'),
    card: 'Student of War',
    text: "Battle Master: a set of artisan's tools, and a skill of the fighter list.",
    toolProficiencies: [{ anyArtisansTool: 1 }],
    classSkills: { count: 1 },
  },
  {
    holder: subclass('Fighter', 'Cavalier', 'XGE', 'Bonus Proficiency'),
    card: 'Bonus Proficiency',
    text: 'Cavalier: one of Animal Handling, History, Insight, Performance and Persuasion, or a language.',
    skillProficiencies: choose(
      1,
      'animal handling',
      'history',
      'insight',
      'performance',
      'persuasion',
    ),
    skillToolLanguageProficiencies: SKILL_OR_LANGUAGE,
  },
  {
    holder: subclass('Fighter', 'Samurai', 'XGE', 'Bonus Proficiency'),
    card: 'Bonus Proficiency',
    text: 'Samurai: one of History, Insight, Performance and Persuasion, or a language.',
    skillProficiencies: choose(1, 'history', 'insight', 'performance', 'persuasion'),
    skillToolLanguageProficiencies: SKILL_OR_LANGUAGE,
  },
  {
    holder: subclass('Fighter', 'Arcane Archer', 'XGE', 'Arcane Archer Lore'),
    card: 'Arcane Archer Lore',
    text: 'Arcane Archer: Arcana or Nature.',
    skillProficiencies: choose(1, 'arcana', 'nature'),
  },
  {
    holder: subclass('Fighter', 'Arcane Archer', 'AU', 'Arcane Archer Lore'),
    card: 'Arcane Archer Lore',
    text: 'Arcane Archer: Arcana and Nature.',
    skillProficiencies: fixed('arcana', 'nature'),
  },
  {
    holder: subclass('Fighter', 'Banneret', 'FRHoF', 'Knightly Envoy'),
    card: 'Knightly Envoy',
    text: 'Banneret: a language, and one of Insight, Intimidation, Persuasion and Performance.',
    languageProficiencies: anyLanguage(1),
    skillProficiencies: choose(1, 'insight', 'intimidation', 'persuasion', 'performance'),
  },
  {
    holder: subclass('Fighter', 'Purple Dragon Knight (Banneret)', 'SCAG', 'Royal Envoy'),
    card: 'Royal Envoy',
    text: 'Purple Dragon Knight: proficiency in Persuasion, with expertise.',
    skillProficiencies: fixed('persuasion'),
    expertise: fixed('persuasion'),
  },
  // ---- Monk ---------------------------------------------------------------------------
  ...(['TCE', 'XPHB'] as const).map((source): FeatureGrant => ({
    holder: subclass('Monk', 'Mercy', source, 'Implements of Mercy'),
    card: 'Implements of Mercy',
    text: 'Mercy: proficiency in Insight and Medicine.',
    skillProficiencies: fixed('insight', 'medicine'),
  })),
  {
    holder: subclass('Monk', 'Drunken Master', 'XGE', 'Bonus Proficiencies'),
    card: 'Bonus Proficiencies',
    text: 'Drunken Master: proficiency in Performance.',
    skillProficiencies: fixed('performance'),
  },
  {
    holder: subclass('Monk', 'Mystic Brews', 'WoW', 'Bonus Proficiencies'),
    card: 'Bonus Proficiencies',
    text: 'Mystic Brews: proficiency in Performance.',
    skillProficiencies: fixed('performance'),
  },
  // ---- Mystic (Unearthed Arcana) ------------------------------------------------------
  {
    holder: subclass('Mystic', 'Awakened', 'UATheMysticClass', 'Awakened Talent'),
    card: 'Awakened Talent',
    text: 'Order of the Awakened: two of Animal Handling, Deception, Insight, Intimidation, Investigation, Perception and Persuasion.',
    skillProficiencies: choose(
      2,
      'animal handling',
      'deception',
      'insight',
      'intimidation',
      'investigation',
      'perception',
      'persuasion',
    ),
  },
  {
    holder: subclass('Mystic', 'Wu Jen', 'UATheMysticClass', "Hermit's Study"),
    card: "Hermit's Study",
    text: 'Order of the Wu Jen: two of Animal Handling, Arcana, History, Insight, Medicine, Nature, Perception, Religion and Survival.',
    skillProficiencies: choose(
      2,
      'animal handling',
      'arcana',
      'history',
      'insight',
      'medicine',
      'nature',
      'perception',
      'religion',
      'survival',
    ),
  },
  // ---- Paladin ------------------------------------------------------------------------
  {
    holder: subclass('Paladin', 'Noble Genies', 'FRHoF', "Genie's Splendor"),
    card: "Genie's Splendor",
    text: 'Noble Genies: one of Acrobatics, Intimidation, Performance and Persuasion.',
    skillProficiencies: choose(
      1,
      'acrobatics',
      'intimidation',
      'performance',
      'persuasion',
    ),
  },
  // ---- Ranger -------------------------------------------------------------------------
  {
    holder: FAVORED_ENEMY,
    card: 'Favored Enemy',
    text: 'Favored Enemy: a language spoken by your favored enemies.',
    languageProficiencies: anyLanguage(1),
  },
  {
    holder: classFeature(
      'Ranger',
      'PHB',
      'Favored Enemy and Natural Explorer improvements',
    ),
    card: 'Favored Enemy',
    needs: FAVORED_ENEMY,
    text: 'Favored Enemy: the language of the favored enemy of 6th level.',
    languageProficiencies: anyLanguage(1),
  },
  {
    holder: classFeature('Ranger', 'PHB', 'Favored Enemy improvement'),
    card: 'Favored Enemy',
    needs: FAVORED_ENEMY,
    text: 'Favored Enemy: the language of the favored enemy of 14th level.',
    languageProficiencies: anyLanguage(1),
  },
  ...(['TCE', 'XPHB'] as const).map((source): FeatureGrant => ({
    holder: classFeature('Ranger', source, 'Deft Explorer'),
    card: 'Deft Explorer',
    text: 'Deft Explorer: two languages of your choice.',
    languageProficiencies: anyLanguage(2),
  })),
  ...(['TCE', 'XPHB'] as const).map((source): FeatureGrant => ({
    holder: subclass('Ranger', 'Fey Wanderer', source, 'Otherworldly Glamour'),
    card: 'Otherworldly Glamour',
    text: 'Fey Wanderer: Deception, Performance or Persuasion.',
    skillProficiencies: choose(1, 'deception', 'performance', 'persuasion'),
  })),
  // ---- Rogue --------------------------------------------------------------------------
  {
    holder: classFeature('Rogue', 'XPHB', "Thieves' Cant"),
    card: "Thieves' Cant",
    text: "Thieves' Cant: one other language of your choice.",
    languageProficiencies: anyLanguage(1),
  },
  {
    holder: subclass('Rogue', 'Mastermind', 'XGE', 'Master of Intrigue'),
    card: 'Master of Intrigue',
    text: 'Mastermind: a gaming set and two languages of your choice.',
    languageProficiencies: anyLanguage(2),
    toolProficiencies: [{ anyGamingSet: 1 }],
  },
  {
    holder: subclass('Rogue', 'Scout', 'XGE', 'Survivalist'),
    card: 'Survivalist',
    text: 'Scout: proficiency in Nature and Survival, with expertise.',
    skillProficiencies: fixed('nature', 'survival'),
    expertise: fixed('nature', 'survival'),
  },
  // ---- Wizard -------------------------------------------------------------------------
  {
    holder: subclass(
      'Wizard',
      'Bladesinging',
      'TCE',
      'Training in War and Song (Bladesinging)',
    ),
    card: 'Training in War and Song',
    text: 'Bladesinging: proficiency in Performance.',
    skillProficiencies: fixed('performance'),
  },
  {
    holder: subclass('Wizard', 'Bladesinger', 'FRHoF', 'Training in War and Song'),
    card: 'Training in War and Song',
    text: 'Bladesinger: one of Acrobatics, Athletics, Performance and Persuasion.',
    skillProficiencies: choose(1, 'acrobatics', 'athletics', 'performance', 'persuasion'),
  },
  {
    holder: subclass('Wizard', 'Enchanter', 'AU', 'Enchanting Conversationalist'),
    card: 'Enchanting Conversationalist',
    text: 'Enchanter: Deception, Intimidation or Persuasion.',
    skillProficiencies: choose(1, 'deception', 'intimidation', 'persuasion'),
  },
]
