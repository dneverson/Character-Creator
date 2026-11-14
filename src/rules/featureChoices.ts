// The class and subclass features whose text lists other features as "options" that are
// not a choice the player makes when building: every option is gained (a Psi Warrior's
// powers), or one is chosen each time it is used (a Blade Flourish). Every other such list
// is a choice of the build (a Totem Spirit, a Hunter's Prey, a 2024 Divine Order), offered
// as a pick card. The audit in classOptions.audit.test.ts fails when a book adds a list
// that is neither offered nor here with its reason. Keys are the feature's data identity.

/** Lists of options that are not a build choice, with why. */
export const FEATURE_OPTIONS_NOT_CHOSEN: Record<string, string> = {
  'subclassFeature|Blade Flourish|XGE|Bard|Swords':
    'one flourish is chosen each time an attack hits, in play',
  'subclassFeature|Psionic Power|TCE|Fighter|Psi Warrior': 'every power is gained',
  'subclassFeature|Telekinetic Adept|TCE|Fighter|Psi Warrior': 'both are gained',
  'subclassFeature|Psionic Power|TCE|Rogue|Soulknife': 'both are gained',
  'subclassFeature|Soul Blades|TCE|Rogue|Soulknife': 'both are gained',
  'subclassFeature|Tipsy Sway|XGE|Monk|Drunken Master': 'both are gained',
  'subclassFeature|Tipsy Sway|WoW|Monk|Mystic Brews': 'both are gained',
  'subclassFeature|Path of the Kensei|XGE|Monk|Kensei': 'both are gained',
  "subclassFeature|Genie's Vessel|TCE|Warlock|Genie":
    'both uses of the vessel are gained',
  'subclassFeature|Soul Fragments|WoW|Demon Hunter|Demon Hunter':
    'every way of spending soul fragments is gained',
  'subclassFeature|Illidari Knowledge|WoW|Demon Hunter|Demon Hunter':
    'every way of spending soul fragments is gained',
  'subclassFeature|The Third Eye|PHB|Wizard|Divination':
    'one benefit is chosen each time it is used, until a rest',
  'subclassFeature|Master Transmuter|PHB|Wizard|Transmutation':
    'one benefit is chosen each time the stone is used',
}

/**
 * Lists whose option follows the one taken for an earlier feature (the Storm Herald's
 * environment is chosen once, for Storm Aura, and Storm Soul and Raging Storm use it):
 * no card of their own, and the option of the same name is the one held.
 */
export const FEATURE_CHOICE_FOLLOWS: Record<string, string> = {
  'subclassFeature|Storm Soul|XGE|Barbarian|Storm Herald': 'Storm Aura',
  'subclassFeature|Raging Storm|XGE|Barbarian|Storm Herald': 'Storm Aura',
}
