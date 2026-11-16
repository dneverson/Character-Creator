// What the data audit of the standing rules (src/rules/standingRules.test.ts) does not
// count, each with the reason: records of the book data whose text gives the character
// advantage or disadvantage that is not a standing note of a saving throw or a skill. The
// audit checks both ways: a record named here must still match, and none may be a row.

export const STANDING_COLLECTIONS_EXCUSED: Readonly<Record<string, string>> = {
  item: 'A magic item or a piece of equipment other than the standing items the table rules: not modelled yet.',
  itemGroup: 'A group of magic items: its items are the item rows, not modelled yet.',
  magicvariant: 'A generic variant of a magic item: not modelled yet.',
}

/** Records of the holder collections that are not a standing note, each with why. */
export const STANDING_TEXT_EXCUSED: Readonly<Record<string, string>> = {
  'background|Fisher|GoS':
    'A check with a tool or with no skill named, so there is no skill row to put it on.',
  'classFeature|Countercharm|PHB|Bard':
    'Held only after an action, for a time or while something is used: not standing.',
  'feat|Boon of Communication|FRHoF': 'It removes a disadvantage; it gives no advantage.',
  'feat|Cohort of Chaos|SatO':
    'A roll of another creature, an ally or a target: not a roll of the character.',
  'feat|Durable|XPHB': 'A death saving throw: the sheet has no row for it.',
  'feat|Enclave Magic|FRHoF':
    'A check with a tool or with no skill named, so there is no skill row to put it on.',
  'feat|Touch of Death|RHW': 'A death saving throw: the sheet has no row for it.',
  'feat|Vampire Hunter|ABH':
    'A check with a tool or with no skill named, so there is no skill row to put it on.',
  'optionalfeature|Cloud Rune|TCE':
    'Already a row of the class options in rules/optionEffects.ts.',
  'optionalfeature|Eldritch Mind|TCE':
    'Already a row of the class options in rules/optionEffects.ts.',
  'optionalfeature|Eldritch Mind|XPHB':
    'Already a row of the class options in rules/optionEffects.ts.',
  'optionalfeature|Extended Spell|XPHB':
    'Held only after an action, for a time or while something is used: not standing.',
  'optionalfeature|Frost Rune|TCE':
    'Already a row of the class options in rules/optionEffects.ts.',
  'optionalfeature|Hill Rune|TCE':
    'Already a row of the class options in rules/optionEffects.ts.',
  'optionalfeature|Stone Rune|TCE':
    'Already a row of the class options in rules/optionEffects.ts.',
  'optionalfeature|Storm Rune|TCE':
    'Already a row of the class options in rules/optionEffects.ts.',
  'race|Goliath|XPHB':
    'Held only after an action, for a time or while something is used: not standing.',
  'race|Kenku|MPMM':
    'A check with a tool or with no skill named, so there is no skill row to put it on.',
  'race|Kenku|VGM':
    'A check with a tool or with no skill named, so there is no skill row to put it on.',
  'race|Reborn|RHW': 'A death saving throw: the sheet has no row for it.',
  'race|Tortle|MPMM':
    'Held only after an action, for a time or while something is used: not standing.',
  'race|Tortle|TTP':
    'Held only after an action, for a time or while something is used: not standing.',
  'reward|Boon of the Unfettered|DMG':
    'A check with a tool or with no skill named, so there is no skill row to put it on.',
  'reward|Charm of the Black Rose|RHW':
    'Held only after an action, for a time or while something is used: not standing.',
  'reward|Fragment of Pity|CRCotN': 'A death saving throw: the sheet has no row for it.',
  'subclassFeature|Bladesong|FRHoF|Wizard|Bladesinger':
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Bladesong|TCE|Wizard|Bladesinging':
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Blessing of the Trickster|XPHB|Cleric|Trickery':
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Elder Champion|PHB|Paladin|Ancients':
    'A roll of another creature, an ally or a target: not a roll of the character.',
  'subclassFeature|Elegant Maneuver|XGE|Rogue|Swashbuckler':
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Exalted Champion|SCAG|Paladin|Crown':
    'Held only after an action, for a time or while something is used: not standing.',
  "subclassFeature|Giant's Might|TCE|Fighter|Rune Knight":
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Holy Nimbus|PHB|Paladin|Devotion':
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Holy Nimbus|XPHB|Paladin|Devotion':
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Lunar Empowerment|DSotDQ|Sorcerer|Lunar':
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Magical Ambush|PHB|Rogue|Arcane Trickster':
    'A roll of another creature, an ally or a target: not a roll of the character.',
  'subclassFeature|Magical Ambush|XPHB|Rogue|Arcane Trickster':
    'A roll of another creature, an ally or a target: not a roll of the character.',
  'subclassFeature|Peerless Athlete|TCE|Paladin|Glory':
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Peerless Athlete|XPHB|Paladin|Glory':
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Perfected Armor|EFA|Artificer|Armorer':
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Spirit Totem|XGE|Druid|Shepherd':
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Survivor|XPHB|Fighter|Champion':
    'A death saving throw: the sheet has no row for it.',
  'subclassFeature|Unbreakable Majesty|XGE|Bard|Glamour':
    'A roll of another creature, an ally or a target: not a roll of the character.',
  "subclassFeature|Watcher's Will|TCE|Paladin|Watchers":
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Wild Magic Surge|PHB|Sorcerer|Wild':
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Zealous Presence|XGE|Barbarian|Zealot':
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Zealous Presence|XPHB|Barbarian|Zealot':
    'Held only after an action, for a time or while something is used: not standing.',
  'subrace|Ixalan|PSX|Vampire':
    'Held only after an action, for a time or while something is used: not standing.',
}
